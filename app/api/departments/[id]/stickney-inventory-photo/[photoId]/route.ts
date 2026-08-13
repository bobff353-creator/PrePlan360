import { getChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, getDepartment } from "@/db/access";

const supabaseOrigin = "https://ukpdacqjmhvlhmrwxtcx.supabase.co";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id: departmentId, photoId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });

  const department = await getDepartment(departmentId);
  if (!department || department.slug !== "stickney") return new Response("Stickney department not found", { status: 404 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return new Response("Department access required", { status: 403 });
  if (!uuidPattern.test(photoId)) return new Response("Photo not found", { status: 404 });

  const secret = process.env.STICKNEY_DATABASE_SECRET;
  if (!secret) return new Response("Photo bridge unavailable", { status: 503 });

  const upstream = await fetch(`${supabaseOrigin}/functions/v1/stickney-private-media/${photoId}`, {
    headers: { "x-stickney-bridge-secret": secret },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) return new Response("Photo unavailable", { status: upstream.status === 404 ? 404 : 503 });

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) return new Response("Photo unavailable", { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
