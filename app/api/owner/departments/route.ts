import { getOwnerUser } from "@/app/chatgpt-auth";
import { isSameOriginRequest } from "@/app/owner-auth";
import { audit, cleanSlug, db, id, isOwner, now } from "@/db/access";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const user = await getOwnerUser();
  if (!user) return new Response("Owner sign in required", { status: 401 });
  if (!(await isOwner(user.userId))) return new Response("Owner access required", { status: 403 });
  const form = await request.formData();
  const name = String(form.get("name") || "").trim().slice(0, 120);
  const requestedSlug = String(form.get("slug") || "").trim();
  const slug = cleanSlug(requestedSlug || name);
  if (!name || !slug) return new Response("Department name required", { status: 400 });
  const departmentId = id("dept");
  const at = now();
  try {
    await db().prepare("INSERT INTO departments (id,name,slug,status,station_count,vehicle_count,weather_location,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(departmentId, name, slug, "setup", 1, 0, "", at, at).run();
  } catch {
    return new Response("That department shortcut is already in use.", { status: 409 });
  }
  await audit(user.userId, departmentId, "department_created", `${name} was created by the platform owner.`);
  return Response.redirect(new URL("/owner", request.url), 303);
}
