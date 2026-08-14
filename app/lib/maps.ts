type DepartmentMapKeySet = Record<string, string>;

function departmentKeys(): DepartmentMapKeySet {
  try {
    const value = JSON.parse(process.env.GOOGLE_MAPS_DEPARTMENT_KEYS_JSON || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function departmentMapConfig(departmentSlug: string) {
  const keys = departmentKeys();
  const browserKey = String(keys[departmentSlug] || keys.default || process.env.GOOGLE_MAPS_BROWSER_KEY || "").trim();
  return {
    configured: Boolean(browserKey),
    browserKey,
    mapId: String(process.env.GOOGLE_MAPS_MAP_ID || "").trim(),
  };
}

export function mapsConfigured() {
  const keys = departmentKeys();
  return Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY || Object.values(keys).some(Boolean));
}
