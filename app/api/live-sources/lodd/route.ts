const SOURCE_URL = "https://apps.usfa.fema.gov/firefighter-fatalities";

export const dynamic = "force-dynamic";

type LatestFatality = {
  id?: number;
  firstName?: string;
  nickname?: string | null;
  lastName?: string;
  deathDt?: string;
  fdCity?: string;
  stateAbbr?: string;
  fdName?: string;
};

async function officialJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "PrePlan360/1.0 (official public-safety source adapter)",
    },
  });
  if (!response.ok) throw new Error(`USFA source returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function GET() {
  const year = new Date().getUTCFullYear();
  try {
    const [yearResponse, latestResponse] = await Promise.all([
      officialJson<{ total?: number }>(`${SOURCE_URL}/api/fatalityDatums/page/1/search?deathDtRange=${year}`),
      officialJson<LatestFatality[]>(`${SOURCE_URL}/api/fatalityDatums/latest`),
    ]);
    if (!Array.isArray(latestResponse)) throw new Error("USFA latest-fatalities response was not a list");
    const total = Number(yearResponse.total);
    if (!Number.isFinite(total) || total < 0) throw new Error("USFA current-year total was unavailable");
    const recent = latestResponse.slice(0, 5).map((entry) => ({
      id: Number(entry.id) || 0,
      name: [entry.firstName, entry.nickname ? `“${entry.nickname}”` : "", entry.lastName].filter(Boolean).join(" "),
      department: String(entry.fdName || "Department not listed"),
      location: [entry.fdCity, entry.stateAbbr].filter(Boolean).join(", "),
      deathDate: entry.deathDt ? entry.deathDt.slice(0, 10) : "",
      url: entry.id ? `${SOURCE_URL}/details?id=${encodeURIComponent(String(entry.id))}` : SOURCE_URL,
    }));
    return Response.json({
      source: "U.S. Fire Administration",
      sourceUrl: SOURCE_URL,
      year,
      total: Math.round(total),
      recent,
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({
      source: "U.S. Fire Administration",
      sourceUrl: SOURCE_URL,
      year,
      total: 0,
      recent: [],
      updatedAt: new Date().toISOString(),
      error: "Official LODD source temporarily unavailable",
    }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
