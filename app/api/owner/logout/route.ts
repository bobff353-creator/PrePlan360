import { getOwnerSessionUser } from "@/app/owner-auth";
import {
  clearOwnerSessionCookies,
  isSameOriginRequest,
  revokeCurrentOwnerSession,
} from "@/app/owner-auth";
import { audit } from "@/db/access";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const user = await getOwnerSessionUser();
  await revokeCurrentOwnerSession();
  if (user) await audit(user.userId, null, "owner_signed_out", "Platform owner ended the password session.");
  const headers = new Headers({ Location: new URL("/", request.url).toString() });
  for (const cookie of clearOwnerSessionCookies(request.url)) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
