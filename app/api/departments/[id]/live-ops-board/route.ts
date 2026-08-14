import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isSameOriginRequest } from "@/app/owner-auth";
import { audit, canDepartmentPermission, getDepartment } from "@/db/access";
import { boardSettingsFromForm, getDepartmentFoundation, saveFoundation } from "@/db/foundation";

function bounded(form: FormData, name: string, minimum: number, maximum: number, fallback: number) {
  const value = Number(form.get(name));
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.round(value))) : fallback;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const form = await request.formData();
  const supportId = String(form.get("support_session_id") || "").slice(0, 120);
  if (!(await canDepartmentPermission(user.userId, departmentId, "live_ops", supportId))) return new Response("This account cannot edit Live Operations", { status: 403 });
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });
  const current = await getDepartmentFoundation(departmentId);
  const settings = {
    ...current,
    ...boardSettingsFromForm(form, current),
    scope: "department" as const,
    department_id: departmentId,
    board_rotation_seconds: bounded(form, "board_rotation_seconds", 5, 300, current.board_rotation_seconds),
    response_duration_seconds: bounded(form, "response_duration_seconds", 5, 600, current.response_duration_seconds),
    is_override: true,
  };
  try {
    await saveFoundation(settings, user.userId);
    await audit(user.userId, departmentId, "live_ops_board_saved", `${department.name} Live Operations Board layout and display settings were saved.`);
    console.info(JSON.stringify({ level: "info", message: "Live Ops board saved", route: "/api/departments/[id]/live-ops-board", departmentId, durationMs: Date.now() - startedAt }));
    const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
    return Response.redirect(new URL(`/d/${department.slug}?module=live-ops&boardSaved=1${support}`, request.url), 303);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "Live Ops board save failed", route: "/api/departments/[id]/live-ops-board", departmentId, error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startedAt }));
    const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
    return Response.redirect(new URL(`/d/${department.slug}?module=live-ops&boardSaved=0${support}`, request.url), 303);
  }
}
