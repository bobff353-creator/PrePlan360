import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canWriteDepartment, db, getDepartment, now } from "@/db/access";

function field(form: FormData, name: string, max = 100) { return String(form.get(name) || "").trim().slice(0, max); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string; recordId: string }> }) {
  const { id: departmentId, recordId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const form = await request.formData();
  const supportId = field(form, "support_session_id");
  if (!await canWriteDepartment(user.userId, departmentId, supportId)) return new Response("Department administrator or active owner-support access required", { status: 403 });
  const visibility = field(form, "visibility") === "mutual_aid" ? "mutual_aid" : "department_only";
  const [department, record] = await Promise.all([
    getDepartment(departmentId),
    db().prepare("SELECT hydrant_number FROM department_hydrants WHERE department_id=? AND id=?").bind(departmentId, recordId).first<{ hydrant_number: string }>(),
  ]);
  if (!department || !record) return new Response("Hydrant not found", { status: 404 });
  await db().prepare("UPDATE department_hydrants SET visibility=?,updated_at=? WHERE department_id=? AND id=?").bind(visibility, now(), departmentId, recordId).run();
  await audit(user.userId, departmentId, "hydrant_visibility_changed", `${record.hydrant_number} is now ${visibility === "mutual_aid" ? "shared view-only" : "department only"}.`);
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${department.slug}?module=hydrants${support}`, request.url), 303);
}
