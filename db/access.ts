import { database } from "@/db/runtime";
import type { ChatGPTUser } from "@/app/chatgpt-auth";

export type Department = { id: string; name: string; slug: string; status: string; station_count: number; vehicle_count: number; weather_location: string; app_title: string; welcome_message: string; brand_primary: string; brand_secondary: string; brand_accent: string; brand_action: string; brand_alert: string; logo_key: string | null; logo_content_type: string | null; updated_at: string };
export type AccessRequest = { id: string; user_id: string; email: string; display_name: string; department_name: string; requested_role: string; note: string; status: string; department_id: string | null; created_at: string };
export const departmentPermissions = ["live_ops", "respond", "staffing", "scheduling", "preplans", "fleet", "inventory", "duties", "documents", "phones", "hydrants", "settings", "members"] as const;
export type DepartmentPermission = typeof departmentPermissions[number];
export type Membership = Department & { membership_role: string; permissions_json: string };
export type DepartmentMember = { id: string; user_id: string; email: string; display_name: string; role: string; status: string; permissions_json: string; created_at: string; updated_at: string };
export type DepartmentInvitation = { id: string; department_id: string; email: string; display_name: string; role: string; permissions_json: string; status: string; expires_at: string; created_at: string; accepted_at: string | null };
export type SupportSession = { id: string; owner_user_id: string; department_id: string; reason: string; status: string; started_at: string; ended_at: string | null };
export type AuditEvent = { id: string; event_type: string; detail: string; created_at: string; actor_user_id: string };
export type DepartmentAsset = { id: string; department_id: string; asset_type: string; name: string; unit_number: string; category: string; manufacturer: string; model: string; model_year: number | null; vin: string | null; barcode: string | null; serial_number: string; status: string; location: string; odometer: number | null; engine_hours: number | null; manual_url: string; parts_url: string; maintenance_notes: string; vin_source: string | null; created_at: string; updated_at: string };
export type AssetResource = { id: string; asset_id: string; resource_type: string; label: string; url: string; source: string; created_at: string };
export type AssetMaintenance = { id: string; asset_id: string; task: string; source_type: string; source_url: string; interval_months: number | null; last_completed: string | null; next_due: string | null; status: string; notes: string; created_at: string; updated_at: string };
export type AssetEvent = { id: string; asset_id: string; event_type: string; detail: string; odometer: number | null; engine_hours: number | null; actor_user_id: string; occurred_at: string };
export type DepartmentPreplan = { id: string; department_id: string; property_name: string; address: string; latitude: string; longitude: string; footprint_json: string; operational_summary: string; internal_notes: string; last_reviewed: string | null; status: string; visibility: string; updated_at: string };
export type SharedPreplan = Omit<DepartmentPreplan, "internal_notes"> & { department_name: string };
export type DepartmentHydrant = { id: string; department_id: string; hydrant_number: string; location: string; latitude: string; longitude: string; flow_gpm: number | null; operational_notes: string; internal_notes: string; last_inspected: string | null; status: string; visibility: string; updated_at: string };
export type SharedHydrant = Omit<DepartmentHydrant, "internal_notes"> & { department_name: string };
export type DepartmentModuleConfig = { id: string; department_id: string; module_key: string; heading: string; description: string; instructions: string; updated_at: string };
export type DepartmentModuleItem = { id: string; department_id: string; module_key: string; item_type: string; title: string; operational_status: string; summary: string; location: string; contact: string; link_url: string; sort_order: number; updated_at: string };
export type DepartmentModuleData = { config: DepartmentModuleConfig | null; items: DepartmentModuleItem[] };
export type DepartmentScheduleRequest = {
  id: string;
  department_id: string;
  request_kind: "time_off" | "trade";
  requester_employee_id: string;
  requester_name: string;
  assignment_id: string;
  target_scope: "employee" | "department";
  target_employee_id: string;
  target_name: string;
  start_date: string;
  end_date: string;
  hours: number;
  leave_type: string;
  role: string;
  note: string;
  status: string;
  created_by: string;
  accepted_by: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export function db() { return database(); }
export function id(prefix: string) { return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`; }
export function now() { return new Date().toISOString(); }
export function cleanSlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50); }

export async function ownerCount() { const row = await db().prepare("SELECT COUNT(*) AS count FROM platform_users WHERE platform_role = 'platform_owner'").first<{ count: number }>(); return Number(row?.count ?? 0); }
export async function isOwner(userId: string) { return !!(await db().prepare("SELECT id FROM platform_users WHERE id = ? AND platform_role = 'platform_owner'").bind(userId).first()); }
export async function upsertIdentity(user: ChatGPTUser) { const at = now(); await db().prepare("INSERT INTO platform_users (id,email,display_name,platform_role,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, display_name=excluded.display_name, updated_at=excluded.updated_at").bind(user.userId,user.email,user.displayName,"department_user",at,at).run(); }
const departmentColumns = "id,name,slug,status,station_count,vehicle_count,weather_location,app_title,welcome_message,brand_primary,brand_secondary,brand_accent,brand_action,brand_alert,logo_key,logo_content_type,updated_at";
export async function listDepartments(): Promise<Department[]> { const result = await db().prepare(`SELECT ${departmentColumns} FROM departments ORDER BY name`).all<Department>(); return result.results; }
export async function getDepartment(departmentId: string): Promise<Department | null> { return db().prepare(`SELECT ${departmentColumns} FROM departments WHERE id = ?`).bind(departmentId).first<Department>(); }
export async function getDepartmentBySlug(slug: string): Promise<Department | null> { return db().prepare(`SELECT ${departmentColumns} FROM departments WHERE slug = ?`).bind(slug).first<Department>(); }
export async function listMemberships(userId: string): Promise<Membership[]> { const result = await db().prepare("SELECT d.id,d.name,d.slug,d.status,d.station_count,d.vehicle_count,d.weather_location,d.app_title,d.welcome_message,d.brand_primary,d.brand_secondary,d.brand_accent,d.brand_action,d.brand_alert,d.logo_key,d.logo_content_type,d.updated_at,m.role AS membership_role,m.permissions_json FROM department_memberships m JOIN departments d ON d.id=m.department_id WHERE m.user_id=? AND m.status='active' ORDER BY d.name").bind(userId).all<Membership>(); return result.results; }
export async function canAccessDepartment(userId: string, departmentId: string) { if (await isOwner(userId)) return true; return !!(await db().prepare("SELECT id FROM department_memberships WHERE user_id=? AND department_id=? AND status='active'").bind(userId,departmentId).first()); }
export async function canAdminDepartment(userId: string, departmentId: string) { if (await isOwner(userId)) return true; return !!(await db().prepare("SELECT id FROM department_memberships WHERE user_id=? AND department_id=? AND status='active' AND role IN ('department_admin','chief_admin')").bind(userId,departmentId).first()); }
export async function canWriteDepartment(userId: string, departmentId: string, supportSessionId = "") { if (await isOwner(userId)) { if (!supportSessionId) return true; const session = await getSupportSession(supportSessionId); return !!session && session.owner_user_id === userId && session.department_id === departmentId && session.status === "active"; } return canAdminDepartment(userId, departmentId); }
export async function canDepartmentPermission(userId: string, departmentId: string, permission: DepartmentPermission, supportSessionId = "") {
  if (await isOwner(userId)) return canWriteDepartment(userId, departmentId, supportSessionId);
  const membership = await db().prepare("SELECT role,permissions_json FROM department_memberships WHERE user_id=? AND department_id=? AND status='active'").bind(userId, departmentId).first<{ role: string; permissions_json: string }>();
  if (!membership) return false;
  if (["department_admin", "chief_admin"].includes(membership.role)) return true;
  return parsePermissions(membership.permissions_json).includes(permission);
}
export function parsePermissions(value: string | null | undefined): DepartmentPermission[] { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.filter((item): item is DepartmentPermission => departmentPermissions.includes(item as DepartmentPermission)) : []; } catch { return []; } }
export function permissionsFromForm(form: FormData): DepartmentPermission[] { return departmentPermissions.filter((permission) => form.getAll("permissions").map(String).includes(permission)); }
export async function listDepartmentMembers(departmentId: string): Promise<DepartmentMember[]> { const result = await db().prepare("SELECT m.id,m.user_id,u.email,u.display_name,m.role,m.status,m.permissions_json,m.created_at,m.updated_at FROM department_memberships m JOIN platform_users u ON u.id=m.user_id WHERE m.department_id=? ORDER BY CASE m.status WHEN 'active' THEN 0 ELSE 1 END,u.display_name,u.email").bind(departmentId).all<DepartmentMember>(); return result.results; }
export async function listDepartmentInvitations(departmentId: string): Promise<DepartmentInvitation[]> { const result = await db().prepare("SELECT id,department_id,email,display_name,role,permissions_json,status,expires_at,created_at,accepted_at FROM department_invitations WHERE department_id=? ORDER BY created_at DESC").bind(departmentId).all<DepartmentInvitation>(); return result.results; }
export async function listDepartmentAssets(departmentId: string): Promise<DepartmentAsset[]> { const result = await db().prepare("SELECT id,department_id,asset_type,name,unit_number,category,manufacturer,model,model_year,vin,barcode,serial_number,status,location,odometer,engine_hours,manual_url,parts_url,maintenance_notes,vin_source,created_at,updated_at FROM department_assets WHERE department_id=? ORDER BY asset_type,name").bind(departmentId).all<DepartmentAsset>(); return result.results; }
export async function getDepartmentAsset(departmentId: string, assetId: string): Promise<DepartmentAsset | null> { return db().prepare("SELECT id,department_id,asset_type,name,unit_number,category,manufacturer,model,model_year,vin,barcode,serial_number,status,location,odometer,engine_hours,manual_url,parts_url,maintenance_notes,vin_source,created_at,updated_at FROM department_assets WHERE department_id=? AND id=?").bind(departmentId, assetId).first<DepartmentAsset>(); }
export async function listAssetResources(departmentId: string, assetId: string): Promise<AssetResource[]> { const result = await db().prepare("SELECT id,asset_id,resource_type,label,url,source,created_at FROM asset_resources WHERE department_id=? AND asset_id=? ORDER BY created_at DESC").bind(departmentId, assetId).all<AssetResource>(); return result.results; }
export async function listAssetMaintenance(departmentId: string, assetId: string): Promise<AssetMaintenance[]> { const result = await db().prepare("SELECT id,asset_id,task,source_type,source_url,interval_months,last_completed,next_due,status,notes,created_at,updated_at FROM asset_maintenance WHERE department_id=? AND asset_id=? ORDER BY CASE status WHEN 'overdue' THEN 0 WHEN 'due' THEN 1 ELSE 2 END,next_due").bind(departmentId, assetId).all<AssetMaintenance>(); return result.results; }
export async function listAssetEvents(departmentId: string, assetId: string): Promise<AssetEvent[]> { const result = await db().prepare("SELECT id,asset_id,event_type,detail,odometer,engine_hours,actor_user_id,occurred_at FROM asset_events WHERE department_id=? AND asset_id=? ORDER BY occurred_at DESC LIMIT 250").bind(departmentId, assetId).all<AssetEvent>(); return result.results; }
export async function listPendingRequests(): Promise<AccessRequest[]> { const result = await db().prepare("SELECT id,user_id,email,display_name,department_name,requested_role,note,status,department_id,created_at FROM access_requests WHERE status='pending' ORDER BY created_at").all<AccessRequest>(); return result.results; }
export async function getSupportSession(sessionId: string): Promise<SupportSession | null> { return db().prepare("SELECT id,owner_user_id,department_id,reason,status,started_at,ended_at FROM support_sessions WHERE id=?").bind(sessionId).first<SupportSession>(); }
export async function listAudit(departmentId: string): Promise<AuditEvent[]> { const result = await db().prepare("SELECT id,event_type,detail,created_at,actor_user_id FROM audit_events WHERE department_id=? ORDER BY created_at DESC LIMIT 20").bind(departmentId).all<AuditEvent>(); return result.results; }
export async function listDepartmentScheduleRequests(departmentId: string): Promise<DepartmentScheduleRequest[]> { const result = await db().prepare("SELECT id,department_id,request_kind,requester_employee_id,requester_name,assignment_id,target_scope,target_employee_id,target_name,start_date,end_date,hours,leave_type,role,note,status,created_by,accepted_by,reviewed_by,created_at,updated_at FROM department_schedule_requests WHERE department_id=? ORDER BY created_at DESC LIMIT 500").bind(departmentId).all<DepartmentScheduleRequest>(); return result.results; }
export async function getDepartmentScheduleRequest(departmentId: string, requestId: string): Promise<DepartmentScheduleRequest | null> { return db().prepare("SELECT id,department_id,request_kind,requester_employee_id,requester_name,assignment_id,target_scope,target_employee_id,target_name,start_date,end_date,hours,leave_type,role,note,status,created_by,accepted_by,reviewed_by,created_at,updated_at FROM department_schedule_requests WHERE department_id=? AND id=?").bind(departmentId, requestId).first<DepartmentScheduleRequest>(); }
export async function audit(actorUserId: string, departmentId: string | null, eventType: string, detail: string) { await db().prepare("INSERT INTO audit_events (id,actor_user_id,department_id,event_type,detail,created_at) VALUES (?,?,?,?,?,?)").bind(id("audit"),actorUserId,departmentId,eventType,detail,now()).run(); }
export async function listDepartmentPreplans(departmentId: string): Promise<DepartmentPreplan[]> { const result = await db().prepare("SELECT id,department_id,property_name,address,latitude,longitude,footprint_json,operational_summary,internal_notes,last_reviewed,status,visibility,updated_at FROM department_preplans WHERE department_id=? ORDER BY property_name").bind(departmentId).all<DepartmentPreplan>(); return result.results; }
export async function listSharedPreplans(viewerDepartmentId: string): Promise<SharedPreplan[]> { const result = await db().prepare("SELECT p.id,p.department_id,p.property_name,p.address,p.latitude,p.longitude,p.footprint_json,p.operational_summary,p.last_reviewed,p.status,p.visibility,p.updated_at,d.name AS department_name FROM department_preplans p JOIN departments d ON d.id=p.department_id WHERE p.department_id<>? AND p.visibility='mutual_aid' AND p.status='active' AND d.status IN ('configured','active') ORDER BY d.name,p.property_name").bind(viewerDepartmentId).all<SharedPreplan>(); return result.results; }
export async function listDepartmentHydrants(departmentId: string): Promise<DepartmentHydrant[]> { const result = await db().prepare("SELECT id,department_id,hydrant_number,location,latitude,longitude,flow_gpm,operational_notes,internal_notes,last_inspected,status,visibility,updated_at FROM department_hydrants WHERE department_id=? ORDER BY hydrant_number").bind(departmentId).all<DepartmentHydrant>(); return result.results; }
export async function listSharedHydrants(viewerDepartmentId: string): Promise<SharedHydrant[]> { const result = await db().prepare("SELECT h.id,h.department_id,h.hydrant_number,h.location,h.latitude,h.longitude,h.flow_gpm,h.operational_notes,h.last_inspected,h.status,h.visibility,h.updated_at,d.name AS department_name FROM department_hydrants h JOIN departments d ON d.id=h.department_id WHERE h.department_id<>? AND h.visibility='mutual_aid' AND h.status='in_service' AND d.status IN ('configured','active') ORDER BY d.name,h.hydrant_number").bind(viewerDepartmentId).all<SharedHydrant>(); return result.results; }
export async function getDepartmentModuleData(departmentId: string, moduleKey: string): Promise<DepartmentModuleData> {
  const [config, items] = await Promise.all([
    db().prepare("SELECT id,department_id,module_key,heading,description,instructions,updated_at FROM department_module_configs WHERE department_id=? AND module_key=?").bind(departmentId, moduleKey).first<DepartmentModuleConfig>(),
    db().prepare("SELECT id,department_id,module_key,item_type,title,operational_status,summary,location,contact,link_url,sort_order,updated_at FROM department_module_items WHERE department_id=? AND module_key=? AND record_status='active' ORDER BY sort_order,title").bind(departmentId, moduleKey).all<DepartmentModuleItem>(),
  ]);
  return { config, items: items.results };
}
