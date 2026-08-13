import { audit } from "@/db/access";
import { isSameOriginRequest } from "@/app/owner-auth";
import { memberSessionCookie, verifyMemberLogin } from "@/app/member-auth";

function safeReturnTo(value: string) { return value.startsWith("/") && !value.startsWith("//") ? value : "/portal"; }

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const form = await request.formData();
  const returnTo = safeReturnTo(String(form.get("return_to") || "/portal"));
  const result = await verifyMemberLogin(String(form.get("email") || ""), String(form.get("password") || ""));
  if (!result.ok) return Response.redirect(new URL(`/department-access?error=${result.reason}&return_to=${encodeURIComponent(returnTo)}`, request.url), 303);
  await audit(result.user.userId, null, "department_user_signed_in", `${result.user.email} signed in.`);
  return new Response(null, { status: 303, headers: { Location: new URL(returnTo, request.url).toString(), "Set-Cookie": memberSessionCookie(result.token, request.url) } });
}
