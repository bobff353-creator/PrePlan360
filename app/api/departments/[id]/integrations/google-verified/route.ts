import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canAdminDepartment, db, now } from "@/db/access";
import { ensureDepartmentIntegration, getDepartmentIntegration } from "@/app/lib/department-integrations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!(await canAdminDepartment(user.userId, id))) return new Response("Department administrator access required", { status: 403 });
  await ensureDepartmentIntegration(id, user.userId);
  const integration = await getDepartmentIntegration(id);
  const input = await request.json().catch(() => null) as { maps?: boolean; streetView?: boolean; routes?: boolean } | null;
  if (!input?.maps || (integration.street_view_enabled && !input.streetView) || (integration.routes_enabled && !input.routes)) return new Response("Every enabled Google service must pass.", { status: 400 });
  const at = now();
  await db().prepare("UPDATE department_integrations SET google_verified_at=?,google_verification_json=?,updated_by=?,updated_at=? WHERE department_id=?")
    .bind(at, JSON.stringify({ maps: true, streetView: Boolean(input.streetView), routes: Boolean(input.routes), verifiedAt: at }), user.userId, at, id).run();
  await audit(user.userId, id, "department_google_integration_verified", `Google Maps${integration.street_view_enabled ? ", Street View" : ""}${integration.routes_enabled ? ", and Routes" : ""} passed browser verification.`);
  return Response.json({ ok: true, verifiedAt: at });
}
