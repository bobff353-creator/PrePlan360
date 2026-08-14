import { db, now } from "@/db/access";

export const foundationModules = [
  { key: "dashboard", label: "Home" },
  { key: "live-ops", label: "Live Operations" },
  { key: "respond", label: "Respond" },
  { key: "staffing", label: "Roster & Staffing" },
  { key: "scheduling", label: "Scheduling" },
  { key: "daily-log", label: "Daily Log" },
  { key: "preplans", label: "Pre-Plans" },
  { key: "fleet", label: "Apparatus" },
  { key: "inventory", label: "Inventory" },
  { key: "duties", label: "Daily Duties" },
  { key: "documents", label: "Policies & Box Cards" },
  { key: "phones", label: "Important Numbers" },
  { key: "hydrants", label: "Hydrants" },
  { key: "inspections", label: "Inspections · Coming Soon" },
] as const;

export const liveBoardWidgets = [
  { key: "summary", label: "Staffing and incident summary" },
  { key: "station", label: "Rotating station information" },
  { key: "apparatus", label: "Apparatus status" },
] as const;

export const liveBoardPanels = [
  { key: "equipment", label: "Equipment issues" },
  { key: "duty", label: "Current daily duty" },
  { key: "closecalls", label: "Firefighter close calls" },
  { key: "lodd", label: "U.S. firefighter LODD" },
  { key: "training", label: "Upcoming training" },
  { key: "weather", label: "Weather" },
  { key: "alerts", label: "Weather alerts" },
  { key: "radar", label: "Weather radar" },
] as const;

export type FoundationModuleKey = typeof foundationModules[number]["key"];
export type LiveBoardWidgetKey = typeof liveBoardWidgets[number]["key"];
export type LiveBoardPanelKey = typeof liveBoardPanels[number]["key"];
export type LiveBoardWidth = "third" | "half" | "full";
export type LiveBoardExternalLink = { id: string; title: string; url: string };

export type FoundationSettings = {
  scope: "master" | "department";
  department_id: string | null;
  module_order: FoundationModuleKey[];
  hidden_modules: FoundationModuleKey[];
  board_rotation_seconds: number;
  response_duration_seconds: number;
  live_board_title: string;
  live_board_order: string[];
  live_board_hidden: string[];
  live_board_widths: Record<string, LiveBoardWidth>;
  live_board_panels: LiveBoardPanelKey[];
  live_board_forecast_detail: "current" | "3" | "7";
  live_board_equipment_url: string;
  live_board_closecalls_url: string;
  live_board_lodd_url: string;
  live_board_training_url: string;
  live_board_source_refresh_minutes: number;
  live_board_weather_url: string;
  live_board_alerts_url: string;
  live_board_radar_url: string;
  live_board_radar_refresh_minutes: number;
  live_board_radar_display_seconds: number;
  live_board_severe_radar_seconds: number;
  live_board_show_next_shift: boolean;
  live_board_external_links: LiveBoardExternalLink[];
  shift_hours_on: number;
  shift_hours_off: number;
  shift_start_time: string;
  minimum_staffing: number;
  overtime_period_days: number;
  overtime_threshold_hours: number;
  overtime_assignment_rule: string;
  scheduling_notes: string;
  overtime_notes: string;
  daily_log_equipment_accountability: boolean;
  updated_at: string;
  is_override: boolean;
};

export type LiveBoardSettings = Pick<FoundationSettings,
  "live_board_title" | "live_board_order" | "live_board_hidden" | "live_board_widths" | "live_board_panels" |
  "live_board_forecast_detail" | "live_board_equipment_url" | "live_board_closecalls_url" | "live_board_lodd_url" |
  "live_board_training_url" | "live_board_source_refresh_minutes" | "live_board_weather_url" | "live_board_alerts_url" | "live_board_radar_url" |
  "live_board_radar_refresh_minutes" | "live_board_radar_display_seconds" | "live_board_severe_radar_seconds" |
  "live_board_show_next_shift" | "live_board_external_links">;

type FoundationRow = {
  department_id?: string | null;
  module_order_json: string;
  hidden_modules_json: string;
  board_rotation_seconds: number;
  response_duration_seconds: number;
  live_board_title: string;
  live_board_order_json: string;
  live_board_hidden_json: string;
  live_board_widths_json: string;
  live_board_panels_json: string;
  live_board_forecast_detail: string;
  live_board_equipment_url: string;
  live_board_closecalls_url: string;
  live_board_lodd_url: string;
  live_board_training_url: string;
  live_board_source_refresh_minutes: number;
  live_board_weather_url: string;
  live_board_alerts_url: string;
  live_board_radar_url: string;
  live_board_radar_refresh_minutes: number;
  live_board_radar_display_seconds: number;
  live_board_severe_radar_seconds: number;
  live_board_show_next_shift: number | boolean;
  live_board_external_links_json: string;
  shift_hours_on: number;
  shift_hours_off: number;
  shift_start_time: string;
  minimum_staffing: number;
  overtime_period_days: number;
  overtime_threshold_hours: number;
  overtime_assignment_rule: string;
  scheduling_notes: string;
  overtime_notes: string;
  daily_log_equipment_accountability: number | boolean;
  updated_at: string;
};

const defaultSettings: Omit<FoundationSettings, "scope" | "department_id" | "is_override"> = {
  module_order: foundationModules.map((module) => module.key),
  hidden_modules: [],
  board_rotation_seconds: 12,
  response_duration_seconds: 90,
  live_board_title: "Live Operations Board",
  live_board_order: liveBoardWidgets.map((widget) => widget.key),
  live_board_hidden: [],
  live_board_widths: { summary: "full", station: "half", apparatus: "half" },
  live_board_panels: ["equipment", "duty", "closecalls", "training"],
  live_board_forecast_detail: "3",
  live_board_equipment_url: "",
  live_board_closecalls_url: "",
  live_board_lodd_url: "https://apps.usfa.fema.gov/firefighter-fatalities",
  live_board_training_url: "",
  live_board_source_refresh_minutes: 5,
  live_board_weather_url: "",
  live_board_alerts_url: "",
  live_board_radar_url: "",
  live_board_radar_refresh_minutes: 5,
  live_board_radar_display_seconds: 30,
  live_board_severe_radar_seconds: 90,
  live_board_show_next_shift: true,
  live_board_external_links: [],
  shift_hours_on: 24,
  shift_hours_off: 48,
  shift_start_time: "07:00",
  minimum_staffing: 0,
  overtime_period_days: 14,
  overtime_threshold_hours: 212,
  overtime_assignment_rule: "Department-defined rotation",
  scheduling_notes: "Department policy and labor agreement control scheduling.",
  overtime_notes: "Department policy and labor agreement control overtime eligibility and assignment.",
  daily_log_equipment_accountability: true,
  updated_at: "",
};

function parseJson<T>(raw: string | undefined, fallback: T): T {
  try {
    return JSON.parse(raw || "") as T;
  } catch {
    return fallback;
  }
}

function validKeys(raw: string): FoundationModuleKey[] {
  const known = new Set<FoundationModuleKey>(foundationModules.map((module) => module.key));
  const values = parseJson<unknown>(raw, []);
  return Array.isArray(values) ? values.filter((value): value is FoundationModuleKey => typeof value === "string" && known.has(value as FoundationModuleKey)) : [];
}

function insertMissingModules(savedOrder: FoundationModuleKey[]) {
  const order = [...savedOrder];
  foundationModules.forEach((module, defaultIndex) => {
    if (order.includes(module.key)) return;
    const nextSaved = foundationModules.slice(defaultIndex + 1).map((entry) => entry.key).find((key) => order.includes(key));
    if (nextSaved) order.splice(order.indexOf(nextSaved), 0, module.key);
    else order.push(module.key);
  });
  return order;
}

function safeUrl(raw: unknown) {
  try {
    const value = String(raw || "").trim();
    if (!value) return "";
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 1000) : "";
  } catch {
    return "";
  }
}

function normalizeExternal(raw: unknown): LiveBoardExternalLink[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    const url = safeUrl(candidate.url);
    if (!url) return [];
    const requestedId = String(candidate.id || `external-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || `external-${index + 1}`;
    const id = seen.has(requestedId) ? `${requestedId}-${index + 1}` : requestedId;
    seen.add(id);
    return [{ id, title: String(candidate.title || "External display").trim().slice(0, 80) || "External display", url }];
  });
}

function normalizeBoard(row: FoundationRow | null): LiveBoardSettings {
  const external = normalizeExternal(parseJson<unknown>(row?.live_board_external_links_json, []));
  const known = [...liveBoardWidgets.map((widget) => widget.key), ...external.map((entry) => entry.id)];
  const knownSet = new Set(known);
  const savedOrder = parseJson<unknown>(row?.live_board_order_json, []);
  const order = Array.isArray(savedOrder) ? savedOrder.filter((value): value is string => typeof value === "string" && knownSet.has(value)) : [];
  const uniqueOrder = [...new Set([...order, ...known])];
  const savedHidden = parseJson<unknown>(row?.live_board_hidden_json, []);
  const hidden = Array.isArray(savedHidden) ? [...new Set(savedHidden.filter((value): value is string => typeof value === "string" && knownSet.has(value)))] : [];
  const savedWidths = parseJson<unknown>(row?.live_board_widths_json, {});
  const widths = Object.fromEntries(known.map((id) => {
    const requested = savedWidths && typeof savedWidths === "object" ? (savedWidths as Record<string, unknown>)[id] : undefined;
    const width: LiveBoardWidth = requested === "third" || requested === "half" || requested === "full" ? requested : id === "summary" ? "full" : "half";
    return [id, width];
  }));
  const knownPanels = new Set<LiveBoardPanelKey>(liveBoardPanels.map((panel) => panel.key));
  const savedPanels = parseJson<unknown>(row?.live_board_panels_json, defaultSettings.live_board_panels);
  const panels = Array.isArray(savedPanels) ? [...new Set(savedPanels.filter((value): value is LiveBoardPanelKey => typeof value === "string" && knownPanels.has(value as LiveBoardPanelKey)))] : [];
  const forecast = row?.live_board_forecast_detail;
  return {
    live_board_title: String(row?.live_board_title || defaultSettings.live_board_title).trim().slice(0, 80) || defaultSettings.live_board_title,
    live_board_order: uniqueOrder,
    live_board_hidden: hidden,
    live_board_widths: widths,
    live_board_panels: panels.length ? panels : ["equipment" as const],
    live_board_forecast_detail: forecast === "current" || forecast === "7" ? forecast : "3",
    live_board_equipment_url: safeUrl(row?.live_board_equipment_url),
    live_board_closecalls_url: safeUrl(row?.live_board_closecalls_url),
    live_board_lodd_url: safeUrl(row?.live_board_lodd_url) || defaultSettings.live_board_lodd_url,
    live_board_training_url: safeUrl(row?.live_board_training_url),
    live_board_source_refresh_minutes: Math.max(1, Math.min(120, Number(row?.live_board_source_refresh_minutes) || 5)),
    live_board_weather_url: safeUrl(row?.live_board_weather_url),
    live_board_alerts_url: safeUrl(row?.live_board_alerts_url),
    live_board_radar_url: safeUrl(row?.live_board_radar_url),
    live_board_radar_refresh_minutes: Math.max(1, Math.min(120, Number(row?.live_board_radar_refresh_minutes) || 5)),
    live_board_radar_display_seconds: Math.max(10, Math.min(180, Number(row?.live_board_radar_display_seconds) || 30)),
    live_board_severe_radar_seconds: Math.max(30, Math.min(300, Number(row?.live_board_severe_radar_seconds) || 90)),
    live_board_show_next_shift: row ? Boolean(row.live_board_show_next_shift) : true,
    live_board_external_links: external,
  };
}

function normalize(row: FoundationRow | null, scope: "master" | "department", departmentId: string | null, isOverride: boolean): FoundationSettings {
  const savedOrder = row ? validKeys(row.module_order_json) : [];
  const hidden = row ? validKeys(row.hidden_modules_json).filter((key) => key !== "dashboard") : [];
  return {
    ...defaultSettings,
    ...(row || {}),
    ...normalizeBoard(row),
    scope,
    department_id: departmentId,
    module_order: insertMissingModules(savedOrder),
    hidden_modules: hidden,
    minimum_staffing: Math.max(
      0,
      Math.min(500, Number(row?.minimum_staffing) || 0),
    ),
    daily_log_equipment_accountability: row ? Boolean(row.daily_log_equipment_accountability) : defaultSettings.daily_log_equipment_accountability,
    is_override: isOverride,
  };
}

const settingsColumns = "module_order_json,hidden_modules_json,board_rotation_seconds,response_duration_seconds,live_board_title,live_board_order_json,live_board_hidden_json,live_board_widths_json,live_board_panels_json,live_board_forecast_detail,live_board_equipment_url,live_board_closecalls_url,live_board_lodd_url,live_board_training_url,live_board_source_refresh_minutes,live_board_weather_url,live_board_alerts_url,live_board_radar_url,live_board_radar_refresh_minutes,live_board_radar_display_seconds,live_board_severe_radar_seconds,live_board_show_next_shift,live_board_external_links_json,shift_hours_on,shift_hours_off,shift_start_time,minimum_staffing,overtime_period_days,overtime_threshold_hours,overtime_assignment_rule,scheduling_notes,overtime_notes,daily_log_equipment_accountability,updated_at";

export async function getMasterFoundation(): Promise<FoundationSettings> {
  const row = await db().prepare(`SELECT ${settingsColumns} FROM platform_foundation_settings WHERE id='master'`).first<FoundationRow>();
  return normalize(row, "master", null, true);
}

export async function getDepartmentFoundation(departmentId: string): Promise<FoundationSettings> {
  const override = await db().prepare(`SELECT department_id,${settingsColumns} FROM department_foundation_settings WHERE department_id=?`).bind(departmentId).first<FoundationRow>();
  if (override) return normalize(override, "department", departmentId, true);
  const master = await getMasterFoundation();
  return { ...master, scope: "department", department_id: departmentId, is_override: false };
}

export function boardSettingsFromForm(form: FormData, current: FoundationSettings): LiveBoardSettings {
  const external = String(form.get("live_board_external_links") || "").split(/\r?\n/).flatMap((line, index) => {
    const separator = line.indexOf("|");
    const title = (separator >= 0 ? line.slice(0, separator) : "External display").trim().slice(0, 80) || "External display";
    const url = safeUrl(separator >= 0 ? line.slice(separator + 1) : line);
    return url ? [{ id: `external-${index + 1}`, title, url }] : [];
  });
  const known = [...liveBoardWidgets.map((widget) => widget.key), ...external.map((entry) => entry.id)];
  const knownSet = new Set(known);
  const order = String(form.get("live_board_order") || "").split(",").map((value) => value.trim()).filter((value) => knownSet.has(value));
  const visible = form.getAll("live_board_visible").map(String).filter((value) => knownSet.has(value));
  const hidden = form.has("live_board_visibility_marker") ? known.filter((value) => !visible.includes(value)) : form.getAll("live_board_hidden").map(String).filter((value) => knownSet.has(value));
  const widths: Record<string, LiveBoardWidth> = Object.fromEntries(known.map((id) => {
    const requested = String(form.get(`live_board_width_${id}`) || "");
    const width: LiveBoardWidth = requested === "third" || requested === "full" ? requested : "half";
    return [id, width];
  }));
  if (!form.has("live_board_width_summary")) widths.summary = current.live_board_widths.summary;
  const knownPanels = new Set<LiveBoardPanelKey>(liveBoardPanels.map((panel) => panel.key));
  const panels = form.getAll("live_board_panels").map(String).filter((value): value is LiveBoardPanelKey => knownPanels.has(value as LiveBoardPanelKey));
  const forecast = String(form.get("live_board_forecast_detail") || "");
  const sourceMinutes = Number(form.get("live_board_source_refresh_minutes"));
  const radarMinutes = Number(form.get("live_board_radar_refresh_minutes"));
  const radarSeconds = Number(form.get("live_board_radar_display_seconds"));
  const severeSeconds = Number(form.get("live_board_severe_radar_seconds"));
  return {
    live_board_title: String(form.get("live_board_title") || "").trim().slice(0, 80) || current.live_board_title,
    live_board_order: [...new Set([...order, ...known])],
    live_board_hidden: [...new Set(hidden)],
    live_board_widths: widths,
    live_board_panels: panels.length ? [...new Set(panels)] : ["equipment" as LiveBoardPanelKey],
    live_board_forecast_detail: forecast === "current" || forecast === "7" ? forecast : "3",
    live_board_equipment_url: safeUrl(form.get("live_board_equipment_url")),
    live_board_closecalls_url: safeUrl(form.get("live_board_closecalls_url")),
    live_board_lodd_url: safeUrl(form.get("live_board_lodd_url")) || current.live_board_lodd_url,
    live_board_training_url: safeUrl(form.get("live_board_training_url")),
    live_board_source_refresh_minutes: Number.isFinite(sourceMinutes) ? Math.max(1, Math.min(120, Math.round(sourceMinutes))) : current.live_board_source_refresh_minutes,
    live_board_weather_url: safeUrl(form.get("live_board_weather_url")),
    live_board_alerts_url: safeUrl(form.get("live_board_alerts_url")),
    live_board_radar_url: safeUrl(form.get("live_board_radar_url")),
    live_board_radar_refresh_minutes: Number.isFinite(radarMinutes) ? Math.max(1, Math.min(120, Math.round(radarMinutes))) : current.live_board_radar_refresh_minutes,
    live_board_radar_display_seconds: Number.isFinite(radarSeconds) ? Math.max(10, Math.min(180, Math.round(radarSeconds))) : current.live_board_radar_display_seconds,
    live_board_severe_radar_seconds: Number.isFinite(severeSeconds) ? Math.max(30, Math.min(300, Math.round(severeSeconds))) : current.live_board_severe_radar_seconds,
    live_board_show_next_shift: form.has("live_board_show_next_shift"),
    live_board_external_links: external,
  };
}

export async function saveFoundation(settings: FoundationSettings, actorUserId: string) {
  const columns = [
    "module_order_json", "hidden_modules_json", "board_rotation_seconds", "response_duration_seconds", "live_board_title",
    "live_board_order_json", "live_board_hidden_json", "live_board_widths_json", "live_board_panels_json", "live_board_forecast_detail",
    "live_board_equipment_url", "live_board_closecalls_url", "live_board_lodd_url", "live_board_training_url", "live_board_source_refresh_minutes",
    "live_board_weather_url", "live_board_alerts_url", "live_board_radar_url", "live_board_radar_refresh_minutes", "live_board_radar_display_seconds",
    "live_board_severe_radar_seconds", "live_board_show_next_shift", "live_board_external_links_json",
    "shift_hours_on", "shift_hours_off", "shift_start_time", "minimum_staffing", "overtime_period_days", "overtime_threshold_hours", "overtime_assignment_rule",
    "scheduling_notes", "overtime_notes", "daily_log_equipment_accountability", "updated_by", "updated_at",
  ];
  const values = [
    JSON.stringify(settings.module_order), JSON.stringify(settings.hidden_modules), settings.board_rotation_seconds, settings.response_duration_seconds, settings.live_board_title,
    JSON.stringify(settings.live_board_order), JSON.stringify(settings.live_board_hidden), JSON.stringify(settings.live_board_widths), JSON.stringify(settings.live_board_panels), settings.live_board_forecast_detail,
    settings.live_board_equipment_url, settings.live_board_closecalls_url, settings.live_board_lodd_url, settings.live_board_training_url, settings.live_board_source_refresh_minutes,
    settings.live_board_weather_url, settings.live_board_alerts_url, settings.live_board_radar_url, settings.live_board_radar_refresh_minutes,
    settings.live_board_radar_display_seconds, settings.live_board_severe_radar_seconds, settings.live_board_show_next_shift ? 1 : 0, JSON.stringify(settings.live_board_external_links),
    settings.shift_hours_on, settings.shift_hours_off, settings.shift_start_time, settings.minimum_staffing, settings.overtime_period_days, settings.overtime_threshold_hours,
    settings.overtime_assignment_rule, settings.scheduling_notes, settings.overtime_notes, settings.daily_log_equipment_accountability ? 1 : 0, actorUserId, now(),
  ];
  const assignments = columns.map((column) => `${column}=excluded.${column}`).join(",");
  if (settings.scope === "master") {
    await db().prepare(`INSERT INTO platform_foundation_settings (id,${columns.join(",")}) VALUES ('master',${columns.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${assignments}`).bind(...values).run();
    return;
  }
  await db().prepare(`INSERT INTO department_foundation_settings (department_id,${columns.join(",")}) VALUES (?,${columns.map(() => "?").join(",")}) ON CONFLICT(department_id) DO UPDATE SET ${assignments}`).bind(settings.department_id, ...values).run();
}

export function orderedVisibleModules(settings: FoundationSettings) {
  const catalog = new Map(foundationModules.map((entry) => [entry.key, entry]));
  return settings.module_order.filter((key) => !settings.hidden_modules.includes(key)).map((key, index) => {
    const entry = catalog.get(key)!;
    return [entry.key, entry.label, String(index + 1).padStart(2, "0")] as const;
  });
}
