import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canWriteDepartment, db, getDepartment, now } from "@/db/access";

function field(form: FormData, name: string, max = 100) { return String(form.get(name) || "").trim().slice(0, max); }
function coordinate(form: FormData, name: string, min: number, max: number) { const raw = field(form, name, 30); if (!raw) return ""; const value = Number(raw); return Number.isFinite(value) && value >= min && value <= max ? String(value) : ""; }
function footprint(form: FormData) {
  const raw = field(form, "footprint", 4000);
  if (!raw) return "[]";
  const points = raw.split(/[;\n]+/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [lat, lng] = line.split(/[\s,]+/).map(Number);
    return { lat, lng };
  });
  if (points.length < 3 || points.length > 40 || points.some(({ lat, lng }) => !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180)) return null;
  return JSON.stringify(points);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; recordId: string }> }) {
  const { id: departmentId, recordId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const form = await request.formData();
  const supportId = field(form, "support_session_id");
  if (!await canWriteDepartment(user.userId, departmentId, supportId)) return new Response("Department administrator or active owner-support access required", { status: 403 });
  const mode = field(form, "mode");
  const visibility = field(form, "visibility") === "mutual_aid" ? "mutual_aid" : "department_only";
  const [department, record] = await Promise.all([
    getDepartment(departmentId),
    db().prepare("SELECT property_name FROM department_preplans WHERE department_id=? AND id=?").bind(departmentId, recordId).first<{ property_name: string }>(),
  ]);
  if (!department || !record) return new Response("Preplan not found", { status: 404 });
  if (mode === "map") {
    const footprintJson = footprint(form);
    if (footprintJson === null) return new Response("Footprint must contain 3 to 40 valid latitude, longitude pairs", { status: 400 });
    await db().prepare("UPDATE department_preplans SET latitude=?,longitude=?,footprint_json=?,updated_at=? WHERE department_id=? AND id=?").bind(coordinate(form, "latitude", -90, 90), coordinate(form, "longitude", -180, 180), footprintJson, now(), departmentId, recordId).run();
    await audit(user.userId, departmentId, "preplan_map_changed", `${record.property_name} map location and footprint were updated.`);
  } else {
    await db().prepare("UPDATE department_preplans SET visibility=?,updated_at=? WHERE department_id=? AND id=?").bind(visibility, now(), departmentId, recordId).run();
    await audit(user.userId, departmentId, "preplan_visibility_changed", `${record.property_name} is now ${visibility === "mutual_aid" ? "shared view-only" : "department only"}.`);
  }
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${department.slug}?module=preplans${support}`, request.url), 303);
}
