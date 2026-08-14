import { get } from "@vercel/blob";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isFleetCheckRecord } from "@/app/lib/fleet-checks";
import { canAccessDepartment, db } from "@/db/access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; checkId: string; itemId: string }> }) {
  const { id: departmentId, checkId, itemId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return new Response("Department access required", { status: 403 });
  const row = await db().prepare("SELECT data_json FROM stickney_record_overrides WHERE department_id=? AND record_type='fleet_check' AND source_record_id=? AND status='active'").bind(departmentId, checkId).first<{ data_json: string }>();
  let value: unknown = null;
  try { value = row ? JSON.parse(row.data_json) : null; } catch { value = null; }
  if (!isFleetCheckRecord(value)) return new Response("Evidence not found", { status: 404 });
  const item = value.items.find((candidate) => candidate.source_item_id === itemId);
  if (!item?.photo_url) return new Response("Evidence not found", { status: 404 });
  const object = await get(item.photo_url, { access: "private" });
  if (!object) return new Response("Evidence not found", { status: 404 });
  if (object.statusCode !== 200) return new Response(null, { status: 304 });
  return new Response(object.stream, {
    headers: {
      "content-type": item.photo_content_type || "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
