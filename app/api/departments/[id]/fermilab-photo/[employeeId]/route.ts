import { getChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, getDepartment } from "@/db/access";
import { fermilabMedia } from "@/db/fermilab";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; employeeId: string }> }) {
  const { id: departmentId, employeeId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });

  const department = await getDepartment(departmentId);
  if (!department || department.slug !== "fermilab") return new Response("Fermilab department not found", { status: 404 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return new Response("Department access required", { status: 403 });

  const media = await fermilabMedia("employee_profiles", employeeId);
  if (!media) return new Response("Employee photo not found", { status: 404 });
  if (!media.contentType.startsWith("image/")) return new Response("Employee photo unavailable", { status: 502 });

  return new Response(media.file, {
    headers: {
      "content-type": media.contentType,
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `inline; filename="${media.filename.replace(/["\r\n]/g, "")}"`,
      "x-content-type-options": "nosniff",
    },
  });
}
