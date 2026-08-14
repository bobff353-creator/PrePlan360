import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canAccessDepartment, canDepartmentPermission, db, id, now } from "@/db/access";

type DailyLogNote = { id: string; at: string; text: string; author: string };
type DailyLogCall = {
  id: string;
  workDate: string;
  reportNumber: string;
  timeOut: string;
  timeIn: string;
  unitIds: string[];
  address: string;
  preplanId: string;
  type: string;
  notes: DailyLogNote[];
  createdAt: string;
  updatedAt: string;
};

type StoredItem = {
  id: string;
  summary: string;
  location: string;
  contact: string;
  updated_at: string;
};

const callTypes = new Set(["Fire", "EMS", "MVA", "HazMat", "Mutual Aid", "Structure Fire", "Special"]);

function text(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function military(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 4 ? digits : "";
}

function workDate(value: unknown) {
  const candidate = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : new Date().toISOString().slice(0, 10);
}

function normalizeAddress(value: unknown) {
  return String(value || "").toLowerCase().replace(/\b(street)\b/g, "st").replace(/\b(avenue)\b/g, "ave").replace(/\b(road)\b/g, "rd").replace(/\b(drive)\b/g, "dr").replace(/\b(boulevard)\b/g, "blvd").replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCall(item: StoredItem): DailyLogCall | null {
  try {
    const value = JSON.parse(item.summary) as Partial<DailyLogCall>;
    if (!value || typeof value !== "object") return null;
    return {
      id: item.id,
      workDate: workDate(value.workDate),
      reportNumber: text(value.reportNumber, 80),
      timeOut: military(value.timeOut),
      timeIn: military(value.timeIn),
      unitIds: Array.isArray(value.unitIds) ? [...new Set(value.unitIds.map((unit) => text(unit, 80)).filter(Boolean))].slice(0, 30) : text(item.contact, 2000).split(",").map((unit) => unit.trim()).filter(Boolean),
      address: text(value.address || item.location, 300),
      preplanId: text(value.preplanId, 120),
      type: callTypes.has(String(value.type)) ? String(value.type) : "EMS",
      notes: Array.isArray(value.notes) ? value.notes.flatMap((note) => {
        if (!note || typeof note !== "object") return [];
        const candidate = note as Partial<DailyLogNote>;
        const noteText = text(candidate.text, 1000);
        return noteText ? [{ id: text(candidate.id, 120) || id("note"), at: text(candidate.at, 40) || item.updated_at, text: noteText, author: text(candidate.author, 120) } satisfies DailyLogNote] : [];
      }).slice(-100) : [],
      createdAt: text(value.createdAt, 40) || item.updated_at,
      updatedAt: text(value.updatedAt, 40) || item.updated_at,
    };
  } catch {
    return null;
  }
}

async function itemForCall(departmentId: string, callId: string) {
  return db().prepare("SELECT id,summary,location,contact,updated_at FROM department_module_items WHERE id=? AND department_id=? AND module_key='daily-log' AND record_status='active'").bind(callId, departmentId).first<StoredItem>();
}

function normalizedCall(raw: unknown, existing: DailyLogCall | null, callId: string, at: string): DailyLogCall {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const requestedType = text(value.type, 40);
  const unitIds = Array.isArray(value.unitIds) ? [...new Set(value.unitIds.map((unit) => text(unit, 80)).filter(Boolean))].slice(0, 30) : existing?.unitIds || [];
  return {
    id: callId,
    workDate: workDate(value.workDate ?? existing?.workDate),
    reportNumber: text(value.reportNumber ?? existing?.reportNumber, 80),
    timeOut: military(value.timeOut ?? existing?.timeOut),
    timeIn: military(value.timeIn ?? existing?.timeIn),
    unitIds,
    address: text(value.address ?? existing?.address, 300),
    preplanId: text(value.preplanId ?? existing?.preplanId, 120),
    type: callTypes.has(requestedType) ? requestedType : existing?.type || "EMS",
    notes: existing?.notes || [],
    createdAt: existing?.createdAt || at,
    updatedAt: at,
  };
}

async function saveCall(departmentId: string, actorUserId: string, call: DailyLogCall, existing: boolean) {
  const title = call.reportNumber || `${call.type} response${call.timeOut ? ` · ${call.timeOut}` : ""}`;
  const status = call.timeIn ? "closed" : "active";
  const summary = JSON.stringify(call);
  if (existing) {
    await db().prepare("UPDATE department_module_items SET title=?,operational_status=?,summary=?,location=?,contact=?,updated_by=?,updated_at=? WHERE id=? AND department_id=? AND module_key='daily-log' AND record_status='active'").bind(title, status, summary, call.address, call.unitIds.join(", "), actorUserId, call.updatedAt, call.id, departmentId).run();
    return;
  }
  await db().prepare("INSERT INTO department_module_items (id,department_id,module_key,item_type,title,operational_status,summary,location,contact,link_url,sort_order,record_status,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(call.id, departmentId, "daily-log", "incident", title, status, summary, call.address, call.unitIds.join(", "), "", -Date.now(), "active", actorUserId, actorUserId, call.createdAt, call.updatedAt).run();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return new Response("Department access required", { status: 403 });
  const result = await db().prepare("SELECT id,summary,location,contact,updated_at FROM department_module_items WHERE department_id=? AND module_key='daily-log' AND record_status='active' ORDER BY updated_at DESC LIMIT 500").bind(departmentId).all<StoredItem>();
  const requestedAddress = normalizeAddress(new URL(request.url).searchParams.get("address"));
  const calls = result.results.map(parseCall).filter((call): call is DailyLogCall => Boolean(call)).filter((call) => !requestedAddress || normalizeAddress(call.address) === requestedAddress);
  return Response.json({ calls }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return new Response("Invalid request body", { status: 400 });
  const supportSessionId = text(body.supportSessionId, 120);
  if (!(await canDepartmentPermission(user.userId, departmentId, "duties", supportSessionId))) return new Response("This account cannot edit the Daily Log", { status: 403 });
  const action = text(body.action, 30);
  const at = now();

  if (action === "save") {
    const requestedId = text(body.callId, 120);
    const stored = requestedId ? await itemForCall(departmentId, requestedId) : null;
    if (requestedId && !stored) return new Response("Daily Log call not found", { status: 404 });
    const existing = stored ? parseCall(stored) : null;
    const call = normalizedCall(body.call, existing, requestedId || id("dailycall"), at);
    await saveCall(departmentId, user.userId, call, Boolean(stored));
    await audit(user.userId, departmentId, "daily_log_call_saved", `${call.reportNumber || call.type} was saved for ${call.workDate}.`);
    return Response.json({ call }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (action === "note") {
    const callId = text(body.callId, 120);
    const noteText = text(body.text, 1000);
    if (!callId || !noteText) return new Response("A call and note are required", { status: 400 });
    const stored = await itemForCall(departmentId, callId);
    const call = stored ? parseCall(stored) : null;
    if (!call) return new Response("Daily Log call not found", { status: 404 });
    call.notes = call.notes.concat({ id: id("note"), at, text: noteText, author: user.displayName }).slice(-100);
    call.updatedAt = at;
    await saveCall(departmentId, user.userId, call, true);
    await audit(user.userId, departmentId, "daily_log_call_note_added", `A timestamped note was added to ${call.reportNumber || call.type}.`);
    return Response.json({ call }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (action === "archive") {
    const callId = text(body.callId, 120);
    const stored = callId ? await itemForCall(departmentId, callId) : null;
    const call = stored ? parseCall(stored) : null;
    if (!call) return new Response("Daily Log call not found", { status: 404 });
    await db().prepare("UPDATE department_module_items SET record_status='archived',updated_by=?,updated_at=? WHERE id=? AND department_id=? AND module_key='daily-log' AND record_status='active'").bind(user.userId, at, callId, departmentId).run();
    await audit(user.userId, departmentId, "daily_log_call_archived", `${call.reportNumber || call.type} was archived and retained in history.`);
    return Response.json({ archived: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return new Response("Invalid Daily Log action", { status: 400 });
}
