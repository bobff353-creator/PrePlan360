import { put } from "@vercel/blob";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  type FleetCheckItem,
  type FleetCheckMode,
  type FleetCheckRecord,
  type FleetWorkOrderRecord,
  fleetCheckValidation,
  isFleetCheckRecord,
  isFleetWorkOrderRecord,
} from "@/app/lib/fleet-checks";
import { audit, canAccessDepartment, canDepartmentPermission, db, id, now } from "@/db/access";

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const validResult = new Set(["pending", "pass", "fail", "missing", "na"]);
const validWorkOrderStatus = new Set(["open", "in_progress", "parts", "closed"]);
type OverlayRow = { source_record_id: string; data_json: string };

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

async function overlayRows(departmentId: string, recordType: "fleet_check" | "fleet_work_order") {
  return (await db().prepare("SELECT source_record_id,data_json FROM stickney_record_overrides WHERE department_id=? AND record_type=? AND status='active' ORDER BY updated_at DESC").bind(departmentId, recordType).all<OverlayRow>()).results;
}

async function upsertOverlay(departmentId: string, recordType: "fleet_check" | "fleet_work_order", recordId: string, data: unknown, userId: string, at: string) {
  await db().prepare("INSERT INTO stickney_record_overrides (id,department_id,record_type,source_record_id,data_json,status,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?,?,?) ON CONFLICT(department_id,record_type,source_record_id) DO UPDATE SET data_json=excluded.data_json,status='active',updated_by=excluded.updated_by,updated_at=excluded.updated_at")
    .bind(id("overlay"), departmentId, recordType, recordId, JSON.stringify(data), userId, userId, at, at).run();
}

async function responseData(departmentId: string) {
  const [checkRows, orderRows] = await Promise.all([overlayRows(departmentId, "fleet_check"), overlayRows(departmentId, "fleet_work_order")]);
  return {
    checks: checkRows.map((row) => parseJson(row.data_json)).filter(isFleetCheckRecord),
    workOrders: orderRows.map((row) => parseJson(row.data_json)).filter(isFleetWorkOrderRecord),
  };
}

function cleanText(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanItem(value: unknown): FleetCheckItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sourceItemId = cleanText(row.source_item_id, 180);
  const itemName = cleanText(row.item_name, 240);
  const result = cleanText(row.result, 20);
  const numeric = row.numeric_reading == null || row.numeric_reading === "" ? null : Number(row.numeric_reading);
  if (!sourceItemId || !itemName || !validResult.has(result)) return null;
  return {
    source_item_id: sourceItemId,
    item_name: itemName,
    category: cleanText(row.category, 120) || "Apparatus inventory",
    result: result as FleetCheckItem["result"],
    note: cleanText(row.note, 2000),
    numeric_reading: numeric,
    photo_url: null,
    photo_content_type: null,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return Response.json({ error: "Department access required" }, { status: 403 });
  return Response.json(await responseData(departmentId), { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const form = await request.formData();
  const supportId = cleanText(form.get("support_session_id"), 120);
  if (!(await canDepartmentPermission(user.userId, departmentId, "fleet", supportId))) return Response.json({ error: "Fleet editing permission required" }, { status: 403 });
  const action = cleanText(form.get("action"), 40);
  if (action === "update_work_order") return updateWorkOrder(departmentId, user.userId, user.displayName, form);
  if (action !== "save_check") return Response.json({ error: "Unsupported fleet action" }, { status: 400 });

  const raw = parseJson(String(form.get("payload") || ""));
  if (!raw || typeof raw !== "object") return Response.json({ error: "Invalid apparatus check" }, { status: 400 });
  const input = raw as Record<string, unknown>;
  const checkId = cleanText(input.id, 180) || id("fleet_check");
  const apparatusId = cleanText(input.apparatus_id, 180);
  const apparatusName = cleanText(input.apparatus_name, 120);
  const checkType = cleanText(input.check_type, 20) as FleetCheckMode;
  const status = cleanText(input.status, 20) === "completed" ? "completed" : "in_progress";
  const mapping = input.mapping === "department" || input.mapping === "active_inventory" ? input.mapping : "none";
  const incomingItems = Array.isArray(input.items) ? input.items.map(cleanItem).filter((item): item is FleetCheckItem => !!item).slice(0, 500) : [];
  if (!apparatusId || !apparatusName || !["daily", "weekly"].includes(checkType)) return Response.json({ error: "Choose an apparatus and check type" }, { status: 400 });

  const existingRow = await db().prepare("SELECT data_json FROM stickney_record_overrides WHERE department_id=? AND record_type='fleet_check' AND source_record_id=? AND status='active'").bind(departmentId, checkId).first<{ data_json: string }>();
  const existing = existingRow ? parseJson(existingRow.data_json) : null;
  const prior = isFleetCheckRecord(existing) ? existing : null;
  if (prior && prior.apparatus_id !== apparatusId) return Response.json({ error: "Apparatus check does not match this unit" }, { status: 409 });
  const priorItems = new Map((prior?.items ?? []).map((item) => [item.source_item_id, item]));
  const items: FleetCheckItem[] = [];
  for (let index = 0; index < incomingItems.length; index += 1) {
    const item = incomingItems[index];
    const old = priorItems.get(item.source_item_id);
    item.photo_url = old?.photo_url ?? null;
    item.photo_content_type = old?.photo_content_type ?? null;
    const evidence = form.get(`evidence_${index}`);
    if (evidence instanceof File && evidence.size) {
      if (!IMAGE_TYPES.has(evidence.type)) return Response.json({ error: `Use a phone photo, JPG, PNG, WebP, HEIC, or HEIF for ${item.item_name}.` }, { status: 415 });
      if (evidence.size > MAX_EVIDENCE_BYTES) return Response.json({ error: `Photo evidence for ${item.item_name} must be 8 MB or smaller.` }, { status: 413 });
      const extension = evidence.type.split("/")[1].replace("jpeg", "jpg");
      const key = `fleet-check-evidence/${departmentId}/${checkId}/${crypto.randomUUID()}.${extension}`;
      const blob = await put(key, evidence, { access: "private", addRandomSuffix: false, contentType: evidence.type });
      item.photo_url = blob.url;
      item.photo_content_type = evidence.type;
    }
    items.push(item);
  }

  const validation = fleetCheckValidation(items, status === "completed");
  if (validation) return Response.json({ error: validation }, { status: 400 });
  const at = now();
  const check: FleetCheckRecord = {
    id: checkId,
    apparatus_id: apparatusId,
    apparatus_name: apparatusName,
    check_type: checkType,
    status,
    mapping,
    started_by: prior?.started_by || user.displayName,
    started_at: prior?.started_at || at,
    completed_at: status === "completed" ? (prior?.completed_at || at) : null,
    updated_at: at,
    items,
  };
  await upsertOverlay(departmentId, "fleet_check", checkId, check, user.userId, at);

  for (const item of items.filter((row) => row.result === "fail" || row.result === "missing")) {
    const orderId = `${checkId}:${item.source_item_id}`;
    const priorOrderRow = await db().prepare("SELECT data_json FROM stickney_record_overrides WHERE department_id=? AND record_type='fleet_work_order' AND source_record_id=? AND status='active'").bind(departmentId, orderId).first<{ data_json: string }>();
    const priorOrderValue = priorOrderRow ? parseJson(priorOrderRow.data_json) : null;
    const priorOrder = isFleetWorkOrderRecord(priorOrderValue) ? priorOrderValue : null;
    const workOrder: FleetWorkOrderRecord = {
      id: orderId,
      check_id: checkId,
      source_item_id: item.source_item_id,
      apparatus_id: apparatusId,
      apparatus_name: apparatusName,
      item_name: item.item_name,
      result: item.result as "fail" | "missing",
      priority: item.result === "missing" ? "high" : "medium",
      status: priorOrder?.status || "open",
      note: item.note,
      photo_url: item.photo_url,
      photo_content_type: item.photo_content_type,
      reported_by: priorOrder?.reported_by || user.displayName,
      reported_at: priorOrder?.reported_at || at,
      updated_at: at,
    };
    await upsertOverlay(departmentId, "fleet_work_order", orderId, workOrder, user.userId, at);
  }
  await audit(user.userId, departmentId, status === "completed" ? "fleet_check_completed" : "fleet_check_saved", `${apparatusName} ${checkType} apparatus check ${status === "completed" ? "completed" : "saved in progress"}; source records preserved.`);
  return Response.json({ ...(await responseData(departmentId)), savedCheckId: checkId });
}

async function updateWorkOrder(departmentId: string, userId: string, displayName: string, form: FormData) {
  const orderId = cleanText(form.get("work_order_id"), 400);
  const status = cleanText(form.get("status"), 30);
  if (!orderId || !validWorkOrderStatus.has(status)) return Response.json({ error: "Choose a valid work-order status" }, { status: 400 });
  const row = await db().prepare("SELECT data_json FROM stickney_record_overrides WHERE department_id=? AND record_type='fleet_work_order' AND source_record_id=? AND status='active'").bind(departmentId, orderId).first<{ data_json: string }>();
  const value = row ? parseJson(row.data_json) : null;
  if (!isFleetWorkOrderRecord(value)) return Response.json({ error: "Work order not found" }, { status: 404 });
  const at = now();
  const updated: FleetWorkOrderRecord = { ...value, status: status as FleetWorkOrderRecord["status"], updated_at: at };
  await upsertOverlay(departmentId, "fleet_work_order", orderId, updated, userId, at);
  await audit(userId, departmentId, "fleet_work_order_updated", `${displayName} changed ${value.apparatus_name} ${value.item_name} to ${status.replaceAll("_", " ")}.`);
  return Response.json(await responseData(departmentId));
}
