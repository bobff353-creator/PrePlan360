import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canAdminDepartment, db, getDepartment, getSupportSession, isOwner, now } from "@/db/access";
import { del, get, put } from "@vercel/blob";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 3 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const department = await getDepartment(id);
  if (!department?.logo_key) return new Response("Logo not found", { status: 404 });
  const object = await get(department.logo_key, { access: "private" });
  if (!object) return new Response("Logo not found", { status: 404 });
  if (object.statusCode !== 200) return new Response(null, { status: 304 });
  return new Response(object.stream, {
    headers: {
      "content-type": department.logo_content_type || "image/png",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!(await canAdminDepartment(user.userId, id))) return new Response("Department administrator access required", { status: 403 });
  const owner = await isOwner(user.userId);
  const form = await request.formData();
  const supportId = String(form.get("support_session_id") || "");
  if (owner) {
    const session = await getSupportSession(supportId);
    if (!session || session.owner_user_id !== user.userId || session.department_id !== id || session.status !== "active") {
      return new Response("An active logged support session is required", { status: 403 });
    }
  }
  const file = form.get("logo");
  if (!(file instanceof File) || !file.size) return new Response("Choose a logo file", { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return new Response("Use a PNG, JPG, WebP, or GIF logo", { status: 415 });
  if (file.size > MAX_BYTES) return new Response("Logo must be 3 MB or smaller", { status: 413 });

  const department = await getDepartment(id);
  if (!department) return new Response("Department not found", { status: 404 });
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `department-logos/${id}/${crypto.randomUUID()}.${extension}`;
  const blob = await put(key, file, { access: "private", addRandomSuffix: false, contentType: file.type });
  await db().prepare("UPDATE departments SET logo_key=?,logo_content_type=?,updated_at=? WHERE id=?").bind(blob.url, file.type, now(), id).run();
  if (department.logo_key) await del(department.logo_key);
  await audit(user.userId, id, owner ? "owner_support_logo_change" : "department_logo_change", "Department app logo updated.");
  const target = owner ? `/owner/support/${supportId}` : `/departments/${id}`;
  return Response.redirect(new URL(target, request.url), 303);
}
