import { db, now } from "@/db/access";

export const foundationModules = [
  { key: "dashboard", label: "Home" },
  { key: "live-ops", label: "Live Operations" },
  { key: "respond", label: "Respond" },
  { key: "staffing", label: "Roster & Staffing" },
  { key: "scheduling", label: "Scheduling" },
  { key: "preplans", label: "Pre-Plans" },
  { key: "fleet", label: "Apparatus" },
  { key: "inventory", label: "Inventory" },
  { key: "duties", label: "Daily Duties" },
  { key: "documents", label: "Policies & Box Cards" },
  { key: "phones", label: "Important Numbers" },
  { key: "hydrants", label: "Hydrants" },
  { key: "inspections", label: "Inspections · Coming Soon" },
] as const;

export type FoundationModuleKey = typeof foundationModules[number]["key"];
export type FoundationSettings = {
  scope: "master" | "department";
  department_id: string | null;
  module_order: FoundationModuleKey[];
  hidden_modules: FoundationModuleKey[];
  board_rotation_seconds: number;
  response_duration_seconds: number;
  shift_hours_on: number;
  shift_hours_off: number;
  shift_start_time: string;
  overtime_period_days: number;
  overtime_threshold_hours: number;
  overtime_assignment_rule: string;
  scheduling_notes: string;
  overtime_notes: string;
  updated_at: string;
  is_override: boolean;
};

type FoundationRow = {
  department_id?: string | null;
  module_order_json: string;
  hidden_modules_json: string;
  board_rotation_seconds: number;
  response_duration_seconds: number;
  shift_hours_on: number;
  shift_hours_off: number;
  shift_start_time: string;
  overtime_period_days: number;
  overtime_threshold_hours: number;
  overtime_assignment_rule: string;
  scheduling_notes: string;
  overtime_notes: string;
  updated_at: string;
};

const defaultSettings: Omit<FoundationSettings, "scope" | "department_id" | "is_override"> = {
  module_order: foundationModules.map((module) => module.key),
  hidden_modules: [],
  board_rotation_seconds: 8,
  response_duration_seconds: 12,
  shift_hours_on: 24,
  shift_hours_off: 48,
  shift_start_time: "07:00",
  overtime_period_days: 14,
  overtime_threshold_hours: 212,
  overtime_assignment_rule: "Department-defined rotation",
  scheduling_notes: "Department policy and labor agreement control scheduling.",
  overtime_notes: "Department policy and labor agreement control overtime eligibility and assignment.",
  updated_at: "",
};

function validKeys(raw: string): FoundationModuleKey[] {
  const known = new Set<FoundationModuleKey>(foundationModules.map((module) => module.key));
  try {
    const values = JSON.parse(raw || "[]");
    return Array.isArray(values) ? values.filter((value): value is FoundationModuleKey => known.has(value)) : [];
  } catch {
    return [];
  }
}

function normalize(row: FoundationRow | null, scope: "master" | "department", departmentId: string | null, isOverride: boolean): FoundationSettings {
  const savedOrder = row ? validKeys(row.module_order_json) : [];
  const remainder = foundationModules.map((module) => module.key).filter((key) => !savedOrder.includes(key));
  const hidden = row ? validKeys(row.hidden_modules_json).filter((key) => key !== "dashboard") : [];
  return {
    ...defaultSettings,
    ...(row || {}),
    scope,
    department_id: departmentId,
    module_order: [...savedOrder, ...remainder],
    hidden_modules: hidden,
    is_override: isOverride,
  };
}

const settingsColumns = "module_order_json,hidden_modules_json,board_rotation_seconds,response_duration_seconds,shift_hours_on,shift_hours_off,shift_start_time,overtime_period_days,overtime_threshold_hours,overtime_assignment_rule,scheduling_notes,overtime_notes,updated_at";

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

export async function saveFoundation(settings: FoundationSettings, actorUserId: string) {
  const values = [
    JSON.stringify(settings.module_order), JSON.stringify(settings.hidden_modules), settings.board_rotation_seconds,
    settings.response_duration_seconds, settings.shift_hours_on, settings.shift_hours_off, settings.shift_start_time,
    settings.overtime_period_days, settings.overtime_threshold_hours, settings.overtime_assignment_rule,
    settings.scheduling_notes, settings.overtime_notes, actorUserId, now(),
  ];
  if (settings.scope === "master") {
    await db().prepare("INSERT INTO platform_foundation_settings (id,module_order_json,hidden_modules_json,board_rotation_seconds,response_duration_seconds,shift_hours_on,shift_hours_off,shift_start_time,overtime_period_days,overtime_threshold_hours,overtime_assignment_rule,scheduling_notes,overtime_notes,updated_by,updated_at) VALUES ('master',?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET module_order_json=excluded.module_order_json,hidden_modules_json=excluded.hidden_modules_json,board_rotation_seconds=excluded.board_rotation_seconds,response_duration_seconds=excluded.response_duration_seconds,shift_hours_on=excluded.shift_hours_on,shift_hours_off=excluded.shift_hours_off,shift_start_time=excluded.shift_start_time,overtime_period_days=excluded.overtime_period_days,overtime_threshold_hours=excluded.overtime_threshold_hours,overtime_assignment_rule=excluded.overtime_assignment_rule,scheduling_notes=excluded.scheduling_notes,overtime_notes=excluded.overtime_notes,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(...values).run();
    return;
  }
  await db().prepare("INSERT INTO department_foundation_settings (department_id,module_order_json,hidden_modules_json,board_rotation_seconds,response_duration_seconds,shift_hours_on,shift_hours_off,shift_start_time,overtime_period_days,overtime_threshold_hours,overtime_assignment_rule,scheduling_notes,overtime_notes,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(department_id) DO UPDATE SET module_order_json=excluded.module_order_json,hidden_modules_json=excluded.hidden_modules_json,board_rotation_seconds=excluded.board_rotation_seconds,response_duration_seconds=excluded.response_duration_seconds,shift_hours_on=excluded.shift_hours_on,shift_hours_off=excluded.shift_hours_off,shift_start_time=excluded.shift_start_time,overtime_period_days=excluded.overtime_period_days,overtime_threshold_hours=excluded.overtime_threshold_hours,overtime_assignment_rule=excluded.overtime_assignment_rule,scheduling_notes=excluded.scheduling_notes,overtime_notes=excluded.overtime_notes,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(settings.department_id, ...values).run();
}

export function orderedVisibleModules(settings: FoundationSettings) {
  const catalog = new Map(foundationModules.map((entry) => [entry.key, entry]));
  return settings.module_order.filter((key) => !settings.hidden_modules.includes(key)).map((key, index) => {
    const entry = catalog.get(key)!;
    return [entry.key, entry.label, String(index + 1).padStart(2, "0")] as const;
  });
}
