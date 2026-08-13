import { getOwnerBootstrapUser } from "@/app/chatgpt-auth";
import {
  createOwnerPassword,
  isSameOriginRequest,
  ownerCredentialExists,
  ownerSessionCookie,
  validateOwnerPassword,
} from "@/app/owner-auth";
import { audit, isOwner } from "@/db/access";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const user = await getOwnerBootstrapUser();
  if (!user || !(await isOwner(user.userId))) return new Response("Owner verification required", { status: 403 });
  if (await ownerCredentialExists(user.userId)) return Response.redirect(new URL("/owner/sign-in", request.url), 303);

  const form = await request.formData();
  const password = String(form.get("password") || "");
  const confirmation = String(form.get("password_confirmation") || "");
  const validation = validateOwnerPassword(password);
  if (validation || password !== confirmation) {
    const target = new URL("/owner", request.url);
    target.searchParams.set("password_error", password !== confirmation ? "match" : "length");
    return Response.redirect(target, 303);
  }

  let token: string;
  try {
    token = await createOwnerPassword(user, password);
  } catch {
    return Response.redirect(new URL("/owner/sign-in", request.url), 303);
  }

  await audit(user.userId, null, "owner_password_created", "Permanent platform-owner password and protected session were created.");
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/owner?password=created", request.url).toString(),
      "Set-Cookie": ownerSessionCookie(token, request.url),
    },
  });
}
