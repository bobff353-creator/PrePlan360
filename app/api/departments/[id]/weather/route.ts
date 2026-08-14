import { getChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, getDepartment } from "@/db/access";
import { getDepartmentFoundation } from "@/db/foundation";

export const dynamic = "force-dynamic";

const NWS_HEADERS = {
  Accept: "application/geo+json",
  "User-Agent": "PrePlan360/1.0 (https://preplan-360.vercel.app)",
};

type NwsPeriod = {
  name?: unknown;
  startTime?: unknown;
  isDaytime?: unknown;
  temperature?: unknown;
  temperatureUnit?: unknown;
  shortForecast?: unknown;
  windSpeed?: unknown;
  windDirection?: unknown;
};

function text(value: unknown, limit = 500) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

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

function period(raw: NwsPeriod | undefined) {
  if (!raw) return null;
  const temperature = Number(raw.temperature);
  return {
    name: text(raw.name, 80),
    startTime: text(raw.startTime, 60),
    temperature: Number.isFinite(temperature) ? temperature : null,
    temperatureUnit: text(raw.temperatureUnit, 8),
    shortForecast: text(raw.shortForecast, 160),
    windSpeed: text(raw.windSpeed, 40),
    windDirection: text(raw.windDirection, 12),
  };
}

async function nwsJson(url: string, cache: RequestCache | { revalidate: number }) {
  const init: RequestInit & { next?: { revalidate: number } } = { headers: NWS_HEADERS };
  if (typeof cache === "string") init.cache = cache;
  else init.next = cache;
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`NWS request failed with ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
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
  if (!point) {
    return Response.json({
      configured: false,
      location: department.weather_location,
      reason: "Save verified latitude, longitude coordinates or a weather source link containing lat and lon.",
    });
  }

  const coordinate = `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
  try {
    const pointData = await nwsJson(`https://api.weather.gov/points/${coordinate}`, { revalidate: 21600 });
    const pointProperties = (pointData.properties || {}) as Record<string, unknown>;
    const forecastUrl = text(pointProperties.forecast, 1000);
    const hourlyUrl = text(pointProperties.forecastHourly, 1000);
    if (!forecastUrl || !hourlyUrl) throw new Error("NWS point metadata did not include forecast links");

    const [forecastData, hourlyData, alertData] = await Promise.all([
      nwsJson(forecastUrl, { revalidate: 300 }),
      nwsJson(hourlyUrl, { revalidate: 300 }),
      nwsJson(`https://api.weather.gov/alerts/active?point=${coordinate}`, "no-store"),
    ]);
    const forecastProperties = (forecastData.properties || {}) as Record<string, unknown>;
    const hourlyProperties = (hourlyData.properties || {}) as Record<string, unknown>;
    const forecastPeriods = Array.isArray(forecastProperties.periods) ? forecastProperties.periods as NwsPeriod[] : [];
    const daytime = forecastPeriods.filter((entry) => entry.isDaytime === true);
    const hourlyPeriods = Array.isArray(hourlyProperties.periods) ? hourlyProperties.periods as NwsPeriod[] : [];
    const features = Array.isArray(alertData.features) ? alertData.features as Array<Record<string, unknown>> : [];

    const alerts = features.slice(0, 25).map((feature) => {
      const properties = (feature.properties || {}) as Record<string, unknown>;
      const event = text(properties.event, 120);
      const severity = text(properties.severity, 40);
      return {
        id: text(feature.id || properties.id, 500),
        event,
        headline: text(properties.headline, 300),
        severity,
        urgency: text(properties.urgency, 40),
        expires: text(properties.expires || properties.ends, 80),
        description: text(properties.description, 2000),
        instruction: text(properties.instruction, 1500),
        senderName: text(properties.senderName, 160),
        priority: /^(Extreme|Severe)$/i.test(severity) || /(Warning|Watch)$/i.test(event),
      };
    }).sort((a, b) => Number(b.priority) - Number(a.priority));

    return Response.json({
      configured: true,
      source: "National Weather Service",
      location: department.weather_location,
      updatedAt: new Date().toISOString(),
      today: period(daytime[0] || forecastPeriods[0]),
      tomorrow: period(daytime[1] || forecastPeriods[1]),
      hourly: hourlyPeriods.slice(0, 5).map(period).filter(Boolean),
      alerts,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Department weather fetch failed", error);
    return Response.json({ configured: true, location: department.weather_location, error: "Weather source temporarily unavailable" }, { status: 502 });
  }
}
