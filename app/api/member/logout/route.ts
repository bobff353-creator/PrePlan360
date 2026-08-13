import { clearMemberSessionCookies, revokeCurrentMemberSession } from "@/app/member-auth";
import { isSameOriginRequest } from "@/app/owner-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  await revokeCurrentMemberSession();
  const headers = new Headers({ Location: new URL("/", request.url).toString() });
  for (const cookie of clearMemberSessionCookies(request.url)) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
