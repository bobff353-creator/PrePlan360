import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canWriteDepartment, db, getDepartment, id, now } from "@/db/access";

function field(form: FormData, name: string, max = 500) { return String(form.get(name) || "").trim().slice(0, max); }
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const form = await request.formData();
  const supportId = field(form, "support_session_id", 100);
  if (!await canWriteDepartment(user.userId, departmentId, supportId)) return new Response("Department administrator or active owner-support access required", { status: 403 });
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });
  const propertyName = field(form, "property_name", 160);
  const address = field(form, "address", 240);
  if (!propertyName || !address) return new Response("Property name and address are required", { status: 400 });
  const visibility = form.get("mutual_aid") === "yes" ? "mutual_aid" : "department_only";
  const footprintJson = footprint(form);
  if (footprintJson === null) return new Response("Footprint must contain 3 to 40 valid latitude, longitude pairs", { status: 400 });
  const at = now();
  await db().prepare("INSERT INTO department_preplans (id,department_id,property_name,address,latitude,longitude,footprint_json,operational_summary,internal_notes,last_reviewed,status,visibility,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id("preplan"), departmentId, propertyName, address, coordinate(form, "latitude", -90, 90), coordinate(form, "longitude", -180, 180), footprintJson, field(form, "operational_summary", 2000), field(form, "internal_notes", 3000), field(form, "last_reviewed", 20) || null, "active", visibility, user.userId, at, at).run();
  await audit(user.userId, departmentId, "preplan_created", `${propertyName} was added as ${visibility === "mutual_aid" ? "shared view-only" : "department only"}.`);
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${department.slug}?module=preplans${support}`, request.url), 303);
}
