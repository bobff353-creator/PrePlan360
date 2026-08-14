import { getDepartmentIntegrationBySlug } from "@/app/lib/department-integrations";

type DepartmentMapKeySet = Record<string, string>;

function departmentKeys(): DepartmentMapKeySet {
  try {
    const value = JSON.parse(process.env.GOOGLE_MAPS_DEPARTMENT_KEYS_JSON || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export async function departmentMapConfig(departmentSlug: string) {
  const keys = departmentKeys();
  const integration = await getDepartmentIntegrationBySlug(departmentSlug);
  const fallbackKey = String(keys[departmentSlug] || keys.default || process.env.GOOGLE_MAPS_BROWSER_KEY || "").trim();
  const browserKey = String(integration?.google_browser_key || fallbackKey).trim();
  const enabled = integration ? Boolean(integration.maps_enabled) : Boolean(browserKey);
  return {
    configured: enabled && Boolean(browserKey),
    browserKey: enabled ? browserKey : "",
    mapId: String(integration?.google_map_id || process.env.GOOGLE_MAPS_MAP_ID || "").trim(),
    streetViewEnabled: integration ? Boolean(integration.street_view_enabled) : true,
    routesEnabled: integration ? Boolean(integration.routes_enabled) : false,
  };
}

export function mapsConfigured() {
  const keys = departmentKeys();
  return Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY || Object.values(keys).some(Boolean));
}
