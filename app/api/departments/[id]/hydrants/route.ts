import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canWriteDepartment, db, getDepartment, id, now } from "@/db/access";

function field(form: FormData, name: string, max = 500) { return String(form.get(name) || "").trim().slice(0, max); }
function coordinate(form: FormData, name: string, min: number, max: number) { const raw = field(form, name, 30); if (!raw) return ""; const value = Number(raw); return Number.isFinite(value) && value >= min && value <= max ? String(value) : ""; }
function flow(form: FormData) { const raw = field(form, "flow_gpm", 20); if (!raw) return null; const value = Number(raw); return Number.isFinite(value) && value >= 0 ? Math.round(value) : null; }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const form = await request.formData();
  const supportId = field(form, "support_session_id", 100);
  if (!await canWriteDepartment(user.userId, departmentId, supportId)) return new Response("Department administrator or active owner-support access required", { status: 403 });
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });
  const hydrantNumber = field(form, "hydrant_number", 80);
  const location = field(form, "location", 240);
  if (!hydrantNumber || !location) return new Response("Hydrant number and location are required", { status: 400 });
  const visibility = form.get("mutual_aid") === "yes" ? "mutual_aid" : "department_only";
  const status = field(form, "status", 30) === "out_of_service" ? "out_of_service" : "in_service";
  const at = now();
  try {
    await db().prepare("INSERT INTO department_hydrants (id,department_id,hydrant_number,location,latitude,longitude,flow_gpm,operational_notes,internal_notes,last_inspected,status,visibility,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id("hydrant"), departmentId, hydrantNumber, location, coordinate(form, "latitude", -90, 90), coordinate(form, "longitude", -180, 180), flow(form), field(form, "operational_notes", 2000), field(form, "internal_notes", 3000), field(form, "last_inspected", 20) || null, status, visibility, user.userId, at, at).run();
  } catch {
    return new Response("That hydrant number already exists in this department", { status: 409 });
  }
  await audit(user.userId, departmentId, "hydrant_created", `${hydrantNumber} was added as ${visibility === "mutual_aid" ? "shared view-only" : "department only"}.`);
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${department.slug}?module=hydrants${support}`, request.url), 303);
}
