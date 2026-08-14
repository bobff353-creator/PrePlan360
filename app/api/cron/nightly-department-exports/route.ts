import { timingSafeEqual } from "node:crypto";
import { deliverDepartmentExport } from "@/app/lib/department-export";
import { listEnabledNightlyExports } from "@/app/lib/department-integrations";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || "");
  const supplied = request.headers.get("authorization") || "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ ok: false, error: "Nightly export scheduler is not configured" }, { status: 503 });
  if (!authorized(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const integrations = await listEnabledNightlyExports();
  const results: Array<{ departmentId: string; status: "accepted" | "failed"; detail: string }> = [];
  for (const integration of integrations) {
    try {
      const delivered = await deliverDepartmentExport(integration, "nightly");
      results.push({ departmentId: integration.department_id, status: "accepted", detail: delivered.summary });
    } catch (error) {
      results.push({ departmentId: integration.department_id, status: "failed", detail: error instanceof Error ? error.message : "Export failed" });
    }
  }
  return Response.json({ ok: results.every((result) => result.status === "accepted"), attempted: results.length, accepted: results.filter((result) => result.status === "accepted").length, results });
}
