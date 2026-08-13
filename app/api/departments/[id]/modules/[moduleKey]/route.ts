import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canDepartmentPermission, db, getDepartment, id, now, type DepartmentPermission } from "@/db/access";

const editableModules: Record<string, DepartmentPermission> = { "live-ops": "live_ops", respond: "respond" };
const itemTypes = new Set(["incident", "apparatus", "station", "notice", "resource"]);
const operationalStatuses = new Set(["active", "ready", "attention", "closed", "offline", "draft"]);

function value(form: FormData, name: string, max: number) {
  return String(form.get(name) || "").trim().slice(0, max);
}

function safeLink(raw: string) {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 1000) : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; moduleKey: string }> }) {
  const { id: departmentId, moduleKey } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const permission = editableModules[moduleKey];
  if (!permission) return new Response("This module cannot be configured", { status: 404 });
  const form = await request.formData();
  const supportId = value(form, "support_session_id", 120);
  if (!(await canDepartmentPermission(user.userId, departmentId, permission, supportId))) return new Response("This account cannot edit this module", { status: 403 });
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });
  const action = value(form, "action", 30);
  const at = now();

  if (action === "save_config") {
    const heading = value(form, "heading", 160);
    const description = value(form, "description", 1500);
    const instructions = value(form, "instructions", 3000);
    await db().prepare("INSERT INTO department_module_configs (id,department_id,module_key,heading,description,instructions,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(department_id,module_key) DO UPDATE SET heading=excluded.heading,description=excluded.description,instructions=excluded.instructions,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(id("module"), departmentId, moduleKey, heading, description, instructions, user.userId, user.userId, at, at).run();
    await audit(user.userId, departmentId, "department_module_configured", `${moduleKey} workspace configuration was updated.`);
  } else if (action === "save_item") {
    const itemId = value(form, "item_id", 120);
    const title = value(form, "title", 200);
    if (!title) return new Response("A title is required", { status: 400 });
    const requestedType = value(form, "item_type", 40);
    const requestedStatus = value(form, "operational_status", 40);
    const itemType = itemTypes.has(requestedType) ? requestedType : "notice";
    const status = operationalStatuses.has(requestedStatus) ? requestedStatus : "ready";
    const summary = value(form, "summary", 5000);
    const location = value(form, "location", 300);
    const contact = value(form, "contact", 300);
    const linkUrl = safeLink(value(form, "link_url", 1000));
    const sortOrder = Math.max(-9999, Math.min(9999, Number(value(form, "sort_order", 8)) || 0));
    if (itemId) {
      const result = await db().prepare("UPDATE department_module_items SET item_type=?,title=?,operational_status=?,summary=?,location=?,contact=?,link_url=?,sort_order=?,updated_by=?,updated_at=? WHERE id=? AND department_id=? AND module_key=? AND record_status='active'").bind(itemType, title, status, summary, location, contact, linkUrl, sortOrder, user.userId, at, itemId, departmentId, moduleKey).run();
      if (!result.meta.changes) return new Response("Module item not found", { status: 404 });
    } else {
      await db().prepare("INSERT INTO department_module_items (id,department_id,module_key,item_type,title,operational_status,summary,location,contact,link_url,sort_order,record_status,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id("item"), departmentId, moduleKey, itemType, title, status, summary, location, contact, linkUrl, sortOrder, "active", user.userId, user.userId, at, at).run();
    }
    await audit(user.userId, departmentId, "department_module_item_saved", `${moduleKey} item “${title}” was saved.`);
  } else if (action === "archive_item") {
    const itemId = value(form, "item_id", 120);
    if (!itemId) return new Response("Module item not found", { status: 404 });
    const result = await db().prepare("UPDATE department_module_items SET record_status='archived',updated_by=?,updated_at=? WHERE id=? AND department_id=? AND module_key=? AND record_status='active'").bind(user.userId, at, itemId, departmentId, moduleKey).run();
    if (!result.meta.changes) return new Response("Module item not found", { status: 404 });
    await audit(user.userId, departmentId, "department_module_item_archived", `${moduleKey} item ${itemId} was archived and retained in history.`);
  } else {
    return new Response("Invalid module action", { status: 400 });
  }

  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${department.slug}?module=${moduleKey}${support}`, request.url), 303);
}
