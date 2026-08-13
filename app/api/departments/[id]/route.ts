import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canAdminDepartment, db, getSupportSession, isOwner, now } from "@/db/access";

const FALLBACK_COLORS = {
  brand_primary: "#7f1d1d",
  brand_secondary: "#090d12",
  brand_accent: "#d4a017",
  brand_action: "#2563a6",
  brand_alert: "#d85a1f",
};

function color(form: FormData, name: keyof typeof FALLBACK_COLORS) {
  const value = String(form.get(name) || "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : FALLBACK_COLORS[name];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!(await canAdminDepartment(user.userId, id))) return new Response("Department administrator access required", { status: 403 });

  const owner = await isOwner(user.userId);
  const form = await request.formData();
  const supportId = String(form.get("support_session_id") || "");
  if (owner && supportId) {
    const session = await getSupportSession(supportId);
    if (!session || session.owner_user_id !== user.userId || session.department_id !== id || session.status !== "active") {
      return new Response("An active logged support session is required", { status: 403 });
    }
  }

  const name = String(form.get("name") || "").trim().slice(0, 120);
  const appTitle = String(form.get("app_title") || name).trim().slice(0, 120);
  const welcomeMessage = String(form.get("welcome_message") || "").trim().slice(0, 240);
  const weather = String(form.get("weather_location") || "").trim().slice(0, 160);
  const stations = Math.max(0, Math.min(99, Number(form.get("station_count")) || 0));
  const vehicles = Math.max(0, Math.min(999, Number(form.get("vehicle_count")) || 0));
  if (!name || !appTitle) return new Response("Department and app names are required", { status: 400 });

  const colors = Object.fromEntries(
    (Object.keys(FALLBACK_COLORS) as Array<keyof typeof FALLBACK_COLORS>).map((key) => [key, color(form, key)]),
  ) as typeof FALLBACK_COLORS;
  await db().prepare("UPDATE departments SET name=?,app_title=?,welcome_message=?,station_count=?,vehicle_count=?,weather_location=?,brand_primary=?,brand_secondary=?,brand_accent=?,brand_action=?,brand_alert=?,status='configured',updated_at=? WHERE id=?")
    .bind(name, appTitle, welcomeMessage, stations, vehicles, weather, colors.brand_primary, colors.brand_secondary, colors.brand_accent, colors.brand_action, colors.brand_alert, now(), id).run();
  await audit(user.userId, id, owner ? "owner_support_brand_change" : "department_brand_change", `${name} app branding and profile updated.`);
  const target = owner && supportId ? `/owner/support/${supportId}` : `/departments/${id}`;
  return Response.redirect(new URL(target, request.url), 303);
}
