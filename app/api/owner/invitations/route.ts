import { requireOwnerUser } from "@/app/chatgpt-auth";
import { createInvitedMember } from "@/app/member-auth";
import { isSameOriginRequest } from "@/app/owner-auth";
import { audit, db, getDepartment, id, isOwner, now, permissionsFromForm } from "@/db/access";

const roles = new Set(["viewer", "editor", "department_admin", "chief_admin"]);
function value(form: FormData, name: string, max = 254) { return String(form.get(name) || "").trim().slice(0, max); }

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const owner = await requireOwnerUser("/owner");
  if (!(await isOwner(owner.userId))) return new Response("Owner access required", { status: 403 });
  const form = await request.formData();
  const departmentId = value(form, "department_id", 120);
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });
  const email = value(form, "email").toLowerCase();
  const displayName = value(form, "display_name", 120);
  const role = value(form, "role", 40);
  const password = String(form.get("temporary_password") || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || !roles.has(role)) return new Response("A valid email and role are required", { status: 400 });
  const permissions = role === "editor" ? permissionsFromForm(form) : [];
  if (role === "editor" && !permissions.length) return new Response("Select at least one editor privilege", { status: 400 });

  const { user } = await createInvitedMember(email, displayName, password);
  const at = now();
  const invitationId = id("invite");
  const permissionText = permissions.length ? ` for ${permissions.join(", ")}` : "";
  await db().batch([
    db().prepare("INSERT INTO department_memberships (id,user_id,department_id,role,status,created_at,updated_at,permissions_json) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,department_id) DO UPDATE SET role=excluded.role,status='active',permissions_json=excluded.permissions_json,updated_at=excluded.updated_at").bind(id("member"), user.userId, departmentId, role, "active", at, at, JSON.stringify(permissions)),
    db().prepare("INSERT INTO department_invitations (id,department_id,email,display_name,role,permissions_json,token_hash,status,invited_by,expires_at,accepted_by,created_at,accepted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(invitationId, departmentId, email, displayName, role, JSON.stringify(permissions), `direct:${invitationId}`, "ready", owner.userId, new Date(Date.now() + 30 * 86400000).toISOString(), user.userId, at, at),
  ]);
  await audit(owner.userId, departmentId, "department_user_invited", `${email} received ${role.replaceAll("_", " ")} access${permissionText}.`);
  return Response.redirect(new URL(`/owner?department=${encodeURIComponent(departmentId)}&invite=ready`, request.url), 303);
}
