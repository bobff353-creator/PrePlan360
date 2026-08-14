const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeDepartmentSlug(value) {
  const slug = String(value ?? "").trim().toLowerCase();
  return SLUG_PATTERN.test(slug) ? slug : "";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function safeMemberReturnTo(value) {
  const requested = String(value ?? "");
  if (!requested.startsWith("/") || requested.startsWith("//")) return "/portal";
  try {
    const url = new URL(requested, "https://preplan.local");
    if (url.origin !== "https://preplan.local") return "/portal";
    if (url.pathname === "/department-access" || url.pathname.startsWith("/api/member/")) return "/portal";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/portal";
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function departmentSlugFromReturnTo(value) {
  const pathname = new URL(safeMemberReturnTo(value), "https://preplan.local").pathname;
  const match = pathname.match(/^\/d\/([^/]+)(?:\/|$)/);
  return normalizeDepartmentSlug(match?.[1]);
}

/**
 * Choose a tenant-safe landing page after a successful member login.
 * An explicit department-specific sign-in wins. Otherwise a requested
 * department page is honored only when it belongs to the signed-in member.
 *
 * @param {{ returnTo?: unknown; requestedDepartment?: unknown; membershipSlugs?: unknown[] }} input
 * @returns {string}
 */
export function memberLandingPath({ returnTo, requestedDepartment, membershipSlugs = [] }) {
  const safeReturnTo = safeMemberReturnTo(returnTo);
  const memberships = [...new Set(membershipSlugs.map(normalizeDepartmentSlug).filter(Boolean))];
  const allowed = new Set(memberships);
  const explicitSlug = normalizeDepartmentSlug(requestedDepartment);
  const returnSlug = departmentSlugFromReturnTo(safeReturnTo);

  if (explicitSlug && allowed.has(explicitSlug)) {
    return returnSlug === explicitSlug ? safeReturnTo : `/d/${explicitSlug}`;
  }
  if (returnSlug && allowed.has(returnSlug)) return safeReturnTo;
  if (memberships.length === 1) return `/d/${memberships[0]}`;
  return "/portal";
}
