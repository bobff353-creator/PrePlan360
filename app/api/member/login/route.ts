import { audit, listMemberships } from "@/db/access";
import { clearOwnerSessionCookies, isSameOriginRequest, revokeCurrentOwnerSession } from "@/app/owner-auth";
import { memberSessionCookie, verifyMemberLogin } from "@/app/member-auth";
import { memberLandingPath, safeMemberReturnTo } from "@/app/member-routing.mjs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const form = await request.formData();
  const returnTo = safeMemberReturnTo(form.get("return_to"));
  const requestedDepartment = String(form.get("department_slug") || "");
  const result = await verifyMemberLogin(String(form.get("email") || ""), String(form.get("password") || ""));
  if (!result.ok) {
    const target = new URL("/department-access", request.url);
    target.searchParams.set("error", result.reason);
    target.searchParams.set("return_to", returnTo);
    if (requestedDepartment) target.searchParams.set("department", requestedDepartment);
    return Response.redirect(target, 303);
  }
  const memberships = await listMemberships(result.user.userId);
  const landingPath = memberLandingPath({
    returnTo,
    requestedDepartment,
    membershipSlugs: memberships.map((membership) => membership.slug),
  });
  await revokeCurrentOwnerSession();
  await audit(result.user.userId, null, "department_user_signed_in", `${result.user.email} signed in.`);
  const headers = new Headers({ Location: new URL(landingPath, request.url).toString() });
  headers.append("Set-Cookie", memberSessionCookie(result.token, request.url));
  for (const cookie of clearOwnerSessionCookies(request.url)) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
