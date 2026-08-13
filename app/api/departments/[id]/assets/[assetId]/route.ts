import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canWriteDepartment, db, getDepartment, getDepartmentAsset, id, now } from "@/db/access";

function text(form: FormData, name: string, max = 300) { return String(form.get(name) || "").trim().slice(0, max); }
function safeUrl(value: string) { if (!value) return ""; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 1000) : ""; } catch { return ""; } }
function nonnegative(form: FormData, name: string) { const raw = text(form, name, 30); if (!raw) return null; const value = Number(raw); return Number.isFinite(value) && value >= 0 ? Math.round(value) : null; }

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id: departmentId, assetId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const form = await request.formData();
  const supportId = text(form, "support_session_id", 100);
  if (!(await canWriteDepartment(user.userId, departmentId, supportId))) return new Response("Department administrator or active owner-support access required", { status: 403 });
  const [department, asset] = await Promise.all([getDepartment(departmentId), getDepartmentAsset(departmentId, assetId)]);
  if (!department || !asset) return new Response("Asset not found", { status: 404 });
  const action = text(form, "action", 30);
  const at = now();

  if (action === "resource") {
    const resourceType = text(form, "resource_type", 30);
    const label = text(form, "label", 120);
    const url = safeUrl(text(form, "url", 1000));
    if (!label || !url || !["manual", "parts", "service", "warranty", "recall", "other"].includes(resourceType)) return new Response("A valid resource label, type, and web link are required", { status: 400 });
    const database = db();
    await database.batch([
      database.prepare("INSERT INTO asset_resources (id,department_id,asset_id,resource_type,label,url,source,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id("resource"), departmentId, assetId, resourceType, label, url, "user_reviewed", user.userId, at),
      database.prepare("INSERT INTO asset_events (id,department_id,asset_id,event_type,detail,odometer,engine_hours,actor_user_id,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id("event"), departmentId, assetId, "resource_added", `Reviewed ${resourceType} link added: ${label}.`, asset.odometer, asset.engine_hours, user.userId, at),
    ]);
    await audit(user.userId, departmentId, "asset_resource_added", `${label} was reviewed and linked to ${asset.name}.`);
  } else if (action === "maintenance") {
    const task = text(form, "task", 180);
    if (!task) return new Response("Maintenance task required", { status: 400 });
    const sourceType = text(form, "source_type", 40) || "department_plan";
    const nextDue = text(form, "next_due", 20) || null;
    const database = db();
    await database.batch([
      database.prepare("INSERT INTO asset_maintenance (id,department_id,asset_id,task,source_type,source_url,interval_months,last_completed,next_due,status,notes,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id("maint"), departmentId, assetId, task, sourceType, safeUrl(text(form, "source_url", 1000)), nonnegative(form, "interval_months"), text(form, "last_completed", 20) || null, nextDue, text(form, "status", 20) || "planned", text(form, "notes", 1200), user.userId, at, at),
      database.prepare("INSERT INTO asset_events (id,department_id,asset_id,event_type,detail,odometer,engine_hours,actor_user_id,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id("event"), departmentId, assetId, "maintenance_added", `${task} added to the maintenance plan${nextDue ? `; due ${nextDue}` : ""}.`, asset.odometer, asset.engine_hours, user.userId, at),
    ]);
    await audit(user.userId, departmentId, "asset_maintenance_added", `${task} was added to ${asset.name}.`);
  } else if (action === "readings") {
    const status = text(form, "status", 30) || asset.status;
    if (!['in_service', 'reserve', 'out_of_service', 'maintenance', 'retired'].includes(status)) return new Response("Invalid asset status", { status: 400 });
    const odometer = nonnegative(form, "odometer");
    const engineHours = nonnegative(form, "engine_hours");
    const detail = `Status ${asset.status.replaceAll("_", " ")} → ${status.replaceAll("_", " ")}; readings saved.`;
    const database = db();
    await database.batch([
      database.prepare("UPDATE department_assets SET status=?,odometer=?,engine_hours=?,maintenance_notes=?,updated_at=? WHERE department_id=? AND id=?").bind(status, odometer, engineHours, text(form, "maintenance_notes", 2000), at, departmentId, assetId),
      database.prepare("INSERT INTO asset_events (id,department_id,asset_id,event_type,detail,odometer,engine_hours,actor_user_id,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id("event"), departmentId, assetId, "readings_updated", detail, odometer, engineHours, user.userId, at),
    ]);
    await audit(user.userId, departmentId, "asset_readings_updated", `${asset.name} status and readings were updated.`);
  } else {
    return new Response("Unsupported asset action", { status: 400 });
  }
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  const requestedReturn = text(form, "return_to", 500);
  const recordPrefix = `/d/${department.slug}/assets/${assetId}`;
  const returnTo = requestedReturn.startsWith(recordPrefix) ? requestedReturn : `/d/${department.slug}?module=fleet&asset=${assetId}${support}`;
  return Response.redirect(new URL(returnTo, request.url), 303);
}
