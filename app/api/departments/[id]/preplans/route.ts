import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canWriteDepartment, db, getDepartment, id, now } from "@/db/access";

function field(form: FormData, name: string, max = 500) { return String(form.get(name) || "").trim().slice(0, max); }

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
  const at = now();
  await db().prepare("INSERT INTO department_preplans (id,department_id,property_name,address,operational_summary,internal_notes,last_reviewed,status,visibility,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id("preplan"), departmentId, propertyName, address, field(form, "operational_summary", 2000), field(form, "internal_notes", 3000), field(form, "last_reviewed", 20) || null, "active", visibility, user.userId, at, at).run();
  await audit(user.userId, departmentId, "preplan_created", `${propertyName} was added as ${visibility === "mutual_aid" ? "shared view-only" : "department only"}.`);
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${department.slug}?module=preplans${support}`, request.url), 303);
}
