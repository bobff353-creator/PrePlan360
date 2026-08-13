import { requireOwnerUser } from "@/app/chatgpt-auth";
import { isSameOriginRequest } from "@/app/owner-auth";
import { audit, db, getDepartment, isOwner, now, permissionsFromForm } from "@/db/access";

const roles = new Set(["viewer", "editor", "department_admin", "chief_admin"]);
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const owner = await requireOwnerUser("/owner");
  if (!(await isOwner(owner.userId))) return new Response("Owner access required", { status: 403 });
  const form = await request.formData();
  const departmentId = String(form.get("department_id") || "");
  const membershipId = String(form.get("membership_id") || "");
  const action = String(form.get("action") || "save");
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });
  const row = await db().prepare("SELECT m.id,u.email FROM department_memberships m JOIN platform_users u ON u.id=m.user_id WHERE m.id=? AND m.department_id=?").bind(membershipId, departmentId).first<{ id: string; email: string }>();
  if (!row) return new Response("Membership not found", { status: 404 });
  const at = now();
  if (action === "suspend") {
    await db().prepare("UPDATE department_memberships SET status='suspended',updated_at=? WHERE id=? AND department_id=?").bind(at, membershipId, departmentId).run();
    await audit(owner.userId, departmentId, "department_user_suspended", `${row.email} access was suspended.`);
  } else if (action === "activate") {
    await db().prepare("UPDATE department_memberships SET status='active',updated_at=? WHERE id=? AND department_id=?").bind(at, membershipId, departmentId).run();
    await audit(owner.userId, departmentId, "department_user_activated", `${row.email} access was activated.`);
  } else {
    const role = String(form.get("role") || "viewer");
    if (!roles.has(role)) return new Response("Invalid role", { status: 400 });
    const permissions = role === "editor" ? permissionsFromForm(form) : [];
    if (role === "editor" && !permissions.length) return new Response("Select at least one editor privilege", { status: 400 });
    await db().prepare("UPDATE department_memberships SET role=?,permissions_json=?,status='active',updated_at=? WHERE id=? AND department_id=?").bind(role, JSON.stringify(permissions), at, membershipId, departmentId).run();
    const permissionText = permissions.length ? ` for ${permissions.join(", ")}` : "";
    await audit(owner.userId, departmentId, "department_user_privileges_changed", `${row.email} changed to ${role.replaceAll("_", " ")}${permissionText}.`);
  }
  return Response.redirect(new URL(`/owner?department=${encodeURIComponent(departmentId)}`, request.url), 303);
}
