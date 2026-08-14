import { getOwnerUser } from "@/app/chatgpt-auth";
import { isSameOriginRequest } from "@/app/owner-auth";
import { audit, getDepartment, isOwner } from "@/db/access";
import { boardSettingsFromForm, foundationModules, getDepartmentFoundation, getMasterFoundation, saveFoundation, type FoundationModuleKey } from "@/db/foundation";

const knownModules = new Set<FoundationModuleKey>(foundationModules.map((module) => module.key));

function bounded(form: FormData, name: string, minimum: number, maximum: number, fallback: number) {
  const number = Number(form.get(name));
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const user = await getOwnerUser();
  if (!user || !(await isOwner(user.userId))) return new Response("Owner access required", { status: 403 });
  const form = await request.formData();
  const requestedScope = String(form.get("scope") || "master");
  const departmentId = requestedScope === "department" ? String(form.get("department_id") || "").slice(0, 120) : "";
  const department = departmentId ? await getDepartment(departmentId) : null;
  if (requestedScope === "department" && !department) return new Response("Department not found", { status: 404 });
  if (String(form.get("action") || "save") === "inherit" && department) {
    const { db } = await import("@/db/access");
    await db().prepare("DELETE FROM department_foundation_settings WHERE department_id=?").bind(department.id).run();
    await audit(user.userId, department.id, "foundation_inherited", `${department.name} now inherits the owner foundation.`);
    return Response.redirect(new URL(`/owner/demo?department=${encodeURIComponent(department.id)}&saved=inherited`, request.url), 303);
  }
  const current = department ? await getDepartmentFoundation(department.id) : await getMasterFoundation();
  const order = String(form.get("module_order") || "").split(",").map((value) => value.trim()).filter((value): value is FoundationModuleKey => knownModules.has(value as FoundationModuleKey));
  const hidden = form.getAll("hidden_modules").map(String).filter((value): value is FoundationModuleKey => knownModules.has(value as FoundationModuleKey) && value !== "dashboard");
  const settings = {
    ...current,
    ...boardSettingsFromForm(form, current),
    scope: department ? "department" as const : "master" as const,
    department_id: department?.id ?? null,
    module_order: [...new Set([...order, ...foundationModules.map((module) => module.key)])],
    hidden_modules: [...new Set(hidden)],
    board_rotation_seconds: bounded(form, "board_rotation_seconds", 3, 300, current.board_rotation_seconds),
    response_duration_seconds: bounded(form, "response_duration_seconds", 3, 600, current.response_duration_seconds),
    shift_hours_on: bounded(form, "shift_hours_on", 1, 168, current.shift_hours_on),
    shift_hours_off: bounded(form, "shift_hours_off", 0, 336, current.shift_hours_off),
    shift_start_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(form.get("shift_start_time") || "")) ? String(form.get("shift_start_time")) : current.shift_start_time,
    minimum_staffing: bounded(form, "minimum_staffing", 0, 500, current.minimum_staffing),
    overtime_period_days: bounded(form, "overtime_period_days", 1, 366, current.overtime_period_days),
    overtime_threshold_hours: bounded(form, "overtime_threshold_hours", 1, 1000, current.overtime_threshold_hours),
    overtime_assignment_rule: String(form.get("overtime_assignment_rule") || "").trim().slice(0, 240) || current.overtime_assignment_rule,
    scheduling_notes: String(form.get("scheduling_notes") || "").trim().slice(0, 4000),
    overtime_notes: String(form.get("overtime_notes") || "").trim().slice(0, 4000),
    daily_log_equipment_accountability: form.has("daily_log_equipment_accountability"),
    is_override: true,
  };
  await saveFoundation(settings, user.userId);
  await audit(user.userId, department?.id ?? null, "foundation_saved", department ? `${department.name} foundation override was saved.` : "The owner master foundation was saved.");
  const query = department ? `?department=${encodeURIComponent(department.id)}&saved=yes` : "?saved=yes";
  return Response.redirect(new URL(`/owner/demo${query}`, request.url), 303);
}
