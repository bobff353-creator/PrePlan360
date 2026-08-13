import { audit } from "@/db/access";
import {
  isSameOriginRequest,
  ownerSessionCookie,
  verifyOwnerLogin,
} from "@/app/owner-auth";

function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/owner";
  return value.startsWith("/owner") ? value : "/owner";
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const form = await request.formData();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const returnTo = safeReturnTo(String(form.get("return_to") || "/owner"));
  const result = await verifyOwnerLogin(email, password);

  if (!result.ok) {
    const target = new URL("/owner/sign-in", request.url);
    target.searchParams.set("error", "invalid");
    target.searchParams.set("return_to", returnTo);
    return Response.redirect(target, 303);
  }

  await audit(result.user.userId, null, "owner_password_sign_in", "Platform owner signed in with the permanent owner password.");
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(returnTo, request.url).toString(),
      "Set-Cookie": ownerSessionCookie(result.token, request.url),
    },
  });
}
