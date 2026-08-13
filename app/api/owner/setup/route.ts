import { createFirstVercelOwner, isSameOriginRequest, ownerSessionCookie } from "@/app/owner-auth";
import { audit } from "@/db/access";

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") return new Response("First-owner setup is preview-only", { status: 403 });
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const form = await request.formData();
  const password = String(form.get("password") || "");
  if (password !== String(form.get("password_confirmation") || "")) return Response.redirect(new URL("/owner/sign-in?error=setup", request.url), 303);
  try {
    const result = await createFirstVercelOwner(String(form.get("email") || ""), String(form.get("display_name") || ""), password);
    await audit(result.user.userId, null, "platform_owner_created", "The permanent platform owner was created from a protected Vercel preview.");
    return new Response(null, { status: 303, headers: { Location: new URL("/owner", request.url).toString(), "Set-Cookie": ownerSessionCookie(result.token, request.url) } });
  } catch {
    return Response.redirect(new URL("/owner/sign-in?error=setup", request.url), 303);
  }
}
