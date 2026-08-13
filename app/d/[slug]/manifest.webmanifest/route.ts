import { getDepartmentBySlug } from "@/db/access";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const department = await getDepartmentBySlug(slug);
  if (!department) return new Response("Not found", { status: 404 });
  const name = department.app_title || department.name;
  const icon = department.logo_key ? new URL(`/api/departments/${department.id}/logo`, request.url).pathname : null;
  const manifest = {
    name,
    short_name: name.slice(0, 24),
    description: department.welcome_message || `${department.name} department operations app.`,
    start_url: `/d/${department.slug}`,
    scope: `/d/${department.slug}`,
    display: "standalone",
    background_color: department.brand_secondary,
    theme_color: department.brand_primary,
    icons: icon ? [{ src: icon, sizes: "any", type: department.logo_content_type || "image/png", purpose: "any maskable" }] : [],
  };
  return Response.json(manifest, { headers: { "cache-control": "private, max-age=300" } });
}
