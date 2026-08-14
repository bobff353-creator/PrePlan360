import { getChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, getDepartment, getDepartmentModuleData } from "@/db/access";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return Response.json({ error: "Department access required" }, { status: 403 });
  if (!(await getDepartment(departmentId))) return Response.json({ error: "Department not found" }, { status: 404 });
  const data = await getDepartmentModuleData(departmentId, "live-ops");
  const item = data.items.find((candidate) => candidate.item_type === "incident" && candidate.operational_status === "active");
  return Response.json({ incident: item ? { id: item.id, title: item.title, location: item.location || item.summary, updatedAt: item.updated_at } : null }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
