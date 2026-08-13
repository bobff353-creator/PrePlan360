import { getOwnerBootstrapUser } from "@/app/chatgpt-auth";
import { isSameOriginRequest } from "@/app/owner-auth";
import { audit, db, now, ownerCount } from "@/db/access";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const user = await getOwnerBootstrapUser();
  if (!user) return new Response("Verified first-owner sign in required", { status: 401 });
  const form = await request.formData();
  if (form.get("confirm") !== "yes") return new Response("Confirmation required", { status: 400 });
  if (await ownerCount()) return Response.redirect(new URL("/owner", request.url), 303);
  const at = now();
  try {
    await db().prepare("INSERT INTO platform_users (id,email,display_name,platform_role,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,platform_role='platform_owner',updated_at=excluded.updated_at").bind(user.userId, user.email, user.displayName, "platform_owner", at, at).run();
  } catch {
    return Response.redirect(new URL("/owner", request.url), 303);
  }
  await audit(user.userId, null, "platform_owner_claimed", `Platform owner assigned to ${user.email}.`);
  return Response.redirect(new URL("/owner", request.url), 303);
}
