import { getChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, getDepartment } from "@/db/access";
import { isStickneyEmployeeWithPhoto } from "@/db/stickney";

const sourceOrigin = "https://stickney-firehouse-manager.vercel.app";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; employeeId: string }> }) {
  const { id: departmentId, employeeId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const department = await getDepartment(departmentId);
  if (!department || department.slug !== "stickney") return new Response("Stickney department not found", { status: 404 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return new Response("Department access required", { status: 403 });
  if (!(await isStickneyEmployeeWithPhoto(employeeId))) return new Response("Employee photo not found", { status: 404 });

  const upstream = await fetch(`${sourceOrigin}/api/employee-photo/${encodeURIComponent(employeeId)}`, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new Response("Employee photo unavailable", { status: upstream.status === 404 ? 404 : 503 });
  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) return new Response("Employee photo unavailable", { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
