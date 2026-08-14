import { getChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, getDepartment } from "@/db/access";
import { downloadFermilabMedia } from "@/db/fermilab";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const { id: departmentId, mediaId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });

  const department = await getDepartment(departmentId);
  if (!department || department.slug !== "fermilab") return new Response("Fermilab department not found", { status: 404 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return new Response("Department access required", { status: 403 });

  try {
    const media = await downloadFermilabMedia(mediaId);
    if (!media || !media.contentType.startsWith("image/")) return new Response("Photo not found", { status: 404 });
    return new Response(await media.blob.arrayBuffer(), {
      headers: {
        "content-type": media.contentType,
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Photo unavailable", { status: 503 });
  }
}
