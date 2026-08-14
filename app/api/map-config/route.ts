import { departmentMapConfig } from "@/app/lib/maps";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const department = url.searchParams.get("department")?.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50) || "default";
  const config = departmentMapConfig(department);
  return Response.json(config, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
