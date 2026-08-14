import { getChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, getDepartment } from "@/db/access";
import { getDepartmentFoundation } from "@/db/foundation";

export const dynamic = "force-dynamic";

const NOAA_RADAR_WMS = "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows";

function coordinatePair(latitudeValue: unknown, longitudeValue: unknown) {
  if (latitudeValue === null || longitudeValue === null || String(latitudeValue).trim() === "" || String(longitudeValue).trim() === "") return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function coordinates(value: string) {
  const direct = value.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (direct) return coordinatePair(direct[1], direct[2]);
  try {
    const url = new URL(value);
    return coordinatePair(
      url.searchParams.get("lat") || url.searchParams.get("latitude"),
      url.searchParams.get("lon") || url.searchParams.get("lng") || url.searchParams.get("longitude"),
    );
  } catch {
    return null;
  }
}

function radarUrl(latitude: number, longitude: number) {
  const latitudeRadius = 2.25;
  const longitudeRadius = Math.min(4.5, latitudeRadius / Math.max(0.35, Math.cos(latitude * Math.PI / 180)));
  const url = new URL(NOAA_RADAR_WMS);
  url.searchParams.set("service", "WMS");
  url.searchParams.set("version", "1.3.0");
  url.searchParams.set("request", "GetMap");
  url.searchParams.set("layers", "conus_bref_qcd");
  url.searchParams.set("styles", "radar_reflectivity");
  url.searchParams.set("format", "image/png");
  url.searchParams.set("transparent", "true");
  url.searchParams.set("crs", "CRS:84");
  url.searchParams.set("bbox", [longitude - longitudeRadius, latitude - latitudeRadius, longitude + longitudeRadius, latitude + latitudeRadius].map((value) => value.toFixed(5)).join(","));
  url.searchParams.set("width", "1280");
  url.searchParams.set("height", "720");
  return url;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return Response.json({ error: "Department access required" }, { status: 403 });

  const [department, foundation] = await Promise.all([
    getDepartment(departmentId),
    getDepartmentFoundation(departmentId),
  ]);
  if (!department) return Response.json({ error: "Department not found" }, { status: 404 });

  const point = coordinates(department.weather_location)
    || coordinates(foundation.live_board_alerts_url)
    || coordinates(foundation.live_board_weather_url)
    || coordinates(foundation.live_board_radar_url);
  if (!point) return Response.json({ error: "Department weather coordinates are not configured" }, { status: 422 });

  try {
    const response = await fetch(radarUrl(point.latitude, point.longitude), {
      cache: "no-store",
      headers: { "User-Agent": "PrePlan360/1.0 (https://preplan-360.vercel.app)" },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.toLowerCase().startsWith("image/png")) throw new Error(`NOAA radar request failed with ${response.status}`);
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/png",
        "X-PrePlan-Radar-Source": "NOAA NWS MRMS BREF QCD",
      },
    });
  } catch (error) {
    console.error("Department radar fetch failed", error);
    return Response.json({ error: "Official radar source temporarily unavailable" }, { status: 502 });
  }
}
