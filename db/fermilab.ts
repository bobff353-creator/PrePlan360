import "server-only";

import { createClient } from "@supabase/supabase-js";
import { hydrateStickneyBoxCardLayout } from "@/db/stickney-box-card-layouts";
import {
  applyOverrides,
  stickneyEmployeeRoles,
  type StickneyApparatus,
  type StickneyBoxCard,
  type StickneyDuty,
  type StickneyEditableRecordType,
  type StickneyEmployee,
  type StickneyFleetCheck,
  type StickneyHydrant,
  type StickneyInventoryCompartment,
  type StickneyInventoryItem,
  type StickneyInventoryPhoto,
  type StickneyModuleData,
  type StickneyPhoneNumber,
  type StickneyPolicy,
  type StickneyPreplan,
  type StickneyPreplanImport,
  type StickneyScheduleAssignment,
  type StickneySummary,
} from "@/db/stickney";

const TENANT_SLUG = "fermilab";
const PAGE_SIZE = 1000;

type MirrorRecord = Record<string, unknown>;
type MirrorRow = { source_record_id: string; record_data: MirrorRecord };
type MediaMirrorRow = {
  source_record_id: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  copy_status: string;
};

function cleanEnv(name: "FERMILAB_SUPABASE_URL" | "FERMILAB_SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name]?.replace(/^[\s"']+|[\s"']+$/g, "");
  if (!value) throw new Error(`The Fermilab mirror is not configured (${name}).`);
  return value;
}

function client() {
  return createClient(cleanEnv("FERMILAB_SUPABASE_URL"), cleanEnv("FERMILAB_SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function text(value: unknown, fallback = "") {
  return value == null ? fallback : String(value).trim();
}

function nullableText(value: unknown) {
  const result = text(value);
  return result || null;
}

function number(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function nullableNumber(value: unknown) {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function boolean(value: unknown) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function json(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function stringArray(value: unknown) {
  const parsed = json(value);
  return Array.isArray(parsed) ? parsed.map((item) => text(item)).filter(Boolean) : [];
}

async function mirrorRows(sourceTable: string): Promise<MirrorRecord[]> {
  const rows: MirrorRecord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client()
      .from("fermilab_record_mirror")
      .select("source_record_id,record_data")
      .eq("tenant_slug", TENANT_SLUG)
      .eq("source_table", sourceTable)
      .order("source_record_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Fermilab mirror read failed for ${sourceTable}: ${error.message}`);
    const page = (data ?? []) as MirrorRow[];
    rows.push(...page.map((row) => ({ ...row.record_data, id: text(row.record_data?.id) || row.source_record_id })));
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function mirrorCount(sourceTable: string) {
  const { count, error } = await client()
    .from("fermilab_record_mirror")
    .select("source_record_id", { count: "exact", head: true })
    .eq("tenant_slug", TENANT_SLUG)
    .eq("source_table", sourceTable);
  if (error) throw new Error(`Fermilab mirror count failed for ${sourceTable}: ${error.message}`);
  return count ?? 0;
}

function chicagoDate(daysFromToday = 0) {
  const now = new Date();
  now.setDate(now.getDate() + daysFromToday);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dutyContext() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const weekday = parts.find((item) => item.type === "weekday")?.value || "Sunday";
  const hour = Number(parts.find((item) => item.type === "hour")?.value || 0);
  return {
    date: chicagoDate(),
    dayOfWeek: Math.max(0, ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(weekday)),
    segment: hour < 12 ? "morning" : hour < 18 ? "afternoon" : "night",
  };
}

function workRole(value: unknown) {
  const role = text(value);
  if (/battalion|chief|command/i.test(role)) return "Command";
  if (/lieutenant|captain|officer/i.test(role)) return "Officer";
  if (/driver|engineer|pump/i.test(role)) return "Driver / Engineer";
  if (/medic|emt-p|paramedic/i.test(role)) return "Medic";
  if (/firefighter|\bff\b/i.test(role)) return "Firefighter";
  return "Other";
}

async function employeesRaw(): Promise<StickneyEmployee[]> {
  const [employees, profiles, payScales] = await Promise.all([mirrorRows("employees"), mirrorRows("employee_profiles"), mirrorRows("pay_scales")]);
  const profileByEmployee = new Map(profiles.map((profile) => [text(profile.employee_id), profile]));
  const rankById = new Map(payScales.map((scale) => [text(scale.id), text(scale.label)]));
  return employees
    .filter((employee) => boolean(employee.active))
    .sort((a, b) => number(a.sort_order) - number(b.sort_order) || text(a.name).localeCompare(text(b.name)))
    .map((employee) => {
      const profile = profileByEmployee.get(text(employee.id)) ?? {};
      const rank = rankById.get(text(employee.pay_scale_id)) || "Rank not entered";
      const qualifiedRoles = [
        ...(/chief|captain|lieutenant|officer/i.test(rank) || boolean(profile.acting_officer_eligible) || boolean(profile.acting_lieutenant_eligible) ? ["Officer"] : []),
        ...(/battalion|chief|command/i.test(rank) || boolean(profile.battalion_chief_eligible) || boolean(profile.acting_battalion_eligible) ? ["Command"] : []),
        ...(/engineer|driver|pump/i.test(`${rank} ${text(profile.driver_status)}`) ? ["Driver / Engineer"] : []),
        ...(/medic|emt-p|paramedic/i.test(rank) ? ["Medic"] : []),
        ...(/firefighter|\bff\b/i.test(rank) ? ["Firefighter"] : []),
      ];
      const mapped: StickneyEmployee = {
        id: text(employee.id),
        name: text(employee.name, "Employee name unavailable"),
        rank,
        employment_type: text(profile.employment_type),
        driver_status: text(profile.driver_status),
        start_date: nullableText(profile.start_date),
        employment_end_date: nullableText(profile.end_date),
        qualified_roles: [...new Set(qualifiedRoles.length ? qualifiedRoles : [workRole(rank)])],
        photo_updated_at: null,
        employee_number: text(profile.employee_number),
        phone: text(profile.phone),
        email: text(profile.email),
        schedule_sms_opt_in: boolean(profile.schedule_sms_opt_in) ? 1 : 0,
        station_notify_email: 0,
        station_notify_text: 0,
        home_shift: text(profile.shift_color),
        station_role: rank,
        emergency_name: text(profile.emergency_name),
        emergency_relationship: text(profile.emergency_relationship),
        emergency_phone: text(profile.emergency_phone),
        notes: text(profile.notes),
      };
      mapped.qualified_roles = stickneyEmployeeRoles(mapped);
      return mapped;
    });
}

export async function loadFermilabEmployees(departmentId = "") {
  const employees = await employeesRaw();
  return departmentId ? applyOverrides(departmentId, "employee", employees) : employees;
}

async function scheduleRaw(start: string, end: string) {
  const [assignments, rotations, employees, profiles, payScales] = await Promise.all([
    mirrorRows("schedule_assignments"),
    mirrorRows("schedule_rotations"),
    mirrorRows("employees"),
    mirrorRows("employee_profiles"),
    mirrorRows("pay_scales"),
  ]);
  const rotationById = new Map(rotations.map((rotation) => [text(rotation.id), rotation]));
  const employeeById = new Map(employees.map((employee) => [text(employee.id), employee]));
  const profileByEmployee = new Map(profiles.map((profile) => [text(profile.employee_id), profile]));
  const rankById = new Map(payScales.map((scale) => [text(scale.id), text(scale.label)]));
  return assignments
    .filter((assignment) => text(assignment.status) === "assigned" && text(assignment.work_date) >= start && text(assignment.work_date) <= end && text(assignment.employee_id))
    .map((assignment): StickneyScheduleAssignment => {
      const employee = employeeById.get(text(assignment.employee_id)) ?? {};
      const profile = profileByEmployee.get(text(assignment.employee_id)) ?? {};
      const rotation = rotationById.get(text(assignment.rotation_id)) ?? {};
      return {
        id: text(assignment.id),
        work_date: text(assignment.work_date),
        shift_name: text(rotation.name) || text(assignment.source) || "Scheduled shift",
        shift_color: text(profile.shift_color),
        start_time: text(assignment.start_time) || text(rotation.start_time) || "07:00",
        end_time: text(assignment.end_time) || text(rotation.end_time) || "07:00",
        role: workRole(assignment.role || assignment.required_rank),
        employee_id: text(assignment.employee_id),
        employee_name: text(employee.name, "Employee not found"),
        rank: rankById.get(text(employee.pay_scale_id)) || text(assignment.required_rank) || "Rank not entered",
      };
    })
    .sort((a, b) => a.work_date.localeCompare(b.work_date) || a.start_time.localeCompare(b.start_time) || a.employee_name.localeCompare(b.employee_name));
}

function mapPreplan(row: MirrorRecord): StickneyPreplan {
  const footprint = json(row.footprint);
  return {
    id: text(row.id),
    business_name: text(row.business_name, "Unnamed occupancy"),
    address: text(row.address),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    footprint_json: typeof footprint === "string" ? footprint : JSON.stringify(footprint ?? []),
    construction_type: text(row.construction_type),
    floor_count: number(row.floor_count),
    suggested_fire_flow_gpm: number(row.suggested_fire_flow_gpm),
    contact_info: text(row.contact_info),
    construction: text(row.construction),
    access_info: text(row.access_info),
    alarm_system: text(row.alarm_system),
    knox_box: text(row.knox_box),
    riser: text(row.riser),
    fdc: text(row.fdc),
    sprinkler_system: text(row.sprinkler_system),
    status: text(row.status),
    updated_at: text(row.updated_at),
  };
}

function mapHydrant(row: MirrorRecord): StickneyHydrant {
  return {
    id: text(row.id),
    hydrant_number: text(row.hydrant_number),
    address: text(row.address),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    service_status: text(row.service_status),
    manufacturer: text(row.manufacturer),
    model: text(row.model),
    notes: text(row.notes),
    updated_at: text(row.updated_at),
  };
}

function mapApparatus(row: MirrorRecord): StickneyApparatus {
  return {
    id: text(row.id),
    name: text(row.unit_name) || text(row.display_name) || "Unnamed apparatus",
    asset_type: text(row.asset_kind, "Apparatus"),
    status: text(row.status, "not_recorded"),
    vin: null,
    manufacturer: null,
    model: null,
    year: null,
    weekly_due_day: null,
    maintenance_schedule: text(row.notes),
    owner_manual_url: "",
    service_manual_url: "",
    parts_catalog_url: "",
    preferred_vendor: "",
    service_profile_verified_at: null,
  };
}

function boxCardLayout(value: unknown) {
  const parsed = json(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function mapBoxCard(row: MirrorRecord): StickneyBoxCard {
  const layout = boxCardLayout(row.layout_data);
  const alarmRows = Array.isArray(layout.rows)
    ? layout.rows.map((item) => {
        const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return { alarm: text(record.alarm), cells: stringArray(record.cells) };
      })
    : [];
  return hydrateStickneyBoxCardLayout({
    id: text(row.id),
    title: text(row.title),
    address: text(row.address),
    box_number: text(row.box_number),
    access_notes: text(row.access_notes),
    details: text(row.details),
    department: text(row.department, "Fermilab"),
    document_url: text(row.document_url),
    document_page: number(row.document_page),
    status: text(row.status),
    updated_at: text(row.updated_at),
    division: text(layout.division),
    alarm_rows: alarmRows,
    interdivisional: text(layout.interdivisional),
  });
}

function weekday(row: MirrorRecord) {
  const days = stringArray(row.weekdays_json);
  if (days.length) {
    const first = days[0];
    if (/^\d$/.test(first)) return Math.max(0, Math.min(6, Number(first)));
    const index = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(first.toLowerCase());
    if (index >= 0) return index;
  }
  const date = text(row.specific_date);
  if (date) {
    const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(parsed.valueOf())) return parsed.getDay();
  }
  return 0;
}

function shiftSegment(row: MirrorRecord) {
  const value = text(row.assigned_shift) || text(row.schedule_bucket) || text(row.recurrence);
  if (/afternoon/i.test(value)) return "afternoon";
  if (/night|evening/i.test(value)) return "night";
  return "morning";
}

async function inventoryData(module: string, departmentId: string): Promise<StickneyModuleData> {
  const [apparatusRows, compartmentRows, equipmentRows, mediaRows, checkRows, checkItemRows] = await Promise.all([
    mirrorRows("fleet_apparatus"),
    mirrorRows("inventory_compartments"),
    mirrorRows("inventory_equipment"),
    mirrorRows("inventory_media"),
    module === "fleet" ? mirrorRows("inventory_checks") : Promise.resolve([]),
    module === "fleet" ? mirrorRows("inventory_check_items") : Promise.resolve([]),
  ]);
  const apparatus = apparatusRows.filter((row) => !boolean(row.retired)).map(mapApparatus);
  const compartments: StickneyInventoryCompartment[] = compartmentRows.map((row) => ({
    id: text(row.id), apparatus_id: text(row.apparatus_id), label: text(row.name, "Unlabeled compartment"), side: text(row.details), sort_order: number(row.sort_order),
  }));
  const inventory: StickneyInventoryItem[] = equipmentRows.filter((row) => !boolean(row.retired)).map((row) => ({
    id: text(row.id),
    apparatus_id: text(row.apparatus_id),
    compartment_id: nullableText(row.compartment_id),
    name: text(row.name, "Unnamed item"),
    manufacturer: nullableText(row.manufacturer),
    model: nullableText(row.model),
    serial_number: nullableText(row.serial_number),
    barcode: nullableText(row.barcode),
    quantity_required: Math.max(0, number(row.quantity, 1)),
    equipment_category: nullableText(row.category),
    check_types: [text(row.inventory_profile), text(row.condition), text(row.service_status)].filter(Boolean),
    source_form: nullableText(row.inventory_profile),
    item_order: null,
    retired_at: null,
  }));
  const inventoryPhotos: StickneyInventoryPhoto[] = mediaRows.filter((row) => text(row.content_type).startsWith("image/")).map((row) => ({
    id: text(row.id),
    apparatus_id: text(row.apparatus_id),
    compartment_id: nullableText(row.compartment_id),
    equipment_id: nullableText(row.equipment_id),
    view_level: text(row.kind, "Inventory photo"),
    door_state: "",
    original_filename: text(row.filename),
    mime_type: text(row.content_type, "application/octet-stream"),
    byte_size: number(row.size_bytes),
    approval_status: "mirrored",
    captured_at: text(row.created_at),
  }));
  const checkItems = new Map<string, MirrorRecord[]>();
  for (const item of checkItemRows) {
    const key = text(item.check_id);
    checkItems.set(key, [...(checkItems.get(key) ?? []), item]);
  }
  const fleetChecks: StickneyFleetCheck[] = checkRows.map((row) => {
    const items = checkItems.get(text(row.id)) ?? [];
    return {
      id: text(row.id),
      apparatus_id: text(row.apparatus_id),
      check_type: text(row.inventory_profile, "apparatus"),
      status: text(row.status),
      started_by: text(row.started_by),
      started_at: text(row.started_at),
      completed_at: nullableText(row.completed_at),
      item_count: items.length,
      pending_count: items.filter((item) => !text(item.status) || text(item.status) === "pending").length,
      failed_count: items.filter((item) => /fail|missing|damage/i.test(text(item.status))).length,
      latest_odometer: null,
    };
  });
  return {
    apparatus: departmentId ? await applyOverrides(departmentId, "apparatus", apparatus) : apparatus,
    compartments,
    inventory: departmentId ? await applyOverrides(departmentId, "inventory", inventory) : inventory,
    inventoryPhotos,
    fleetChecks,
    readinessExceptions: [],
    workOrders: [],
    fleetSources: { checks: true, readinessExceptions: false, workOrders: false },
  };
}

async function summary(): Promise<StickneySummary> {
  const tables: Array<[keyof StickneySummary, string]> = [
    ["employees", "employees"], ["schedule_assignments", "schedule_assignments"], ["preplans", "field_preplans"],
    ["preplan_imports", "field_preplan_imports"], ["hydrants", "field_hydrants"], ["apparatus", "fleet_apparatus"],
    ["inventory_items", "inventory_equipment"], ["inventory_photos", "inventory_media"], ["duties", "daily_duty_tasks"],
    ["box_cards", "box_cards"], ["policies", "policies"], ["phone_numbers", "important_phone_numbers"],
  ];
  const counts = await Promise.all(tables.map(([, table]) => mirrorCount(table)));
  return Object.fromEntries(tables.map(([key], index) => [key, counts[index]])) as StickneySummary;
}

async function withOverrides<T extends { id: string }>(departmentId: string, recordType: StickneyEditableRecordType, rows: T[]) {
  return departmentId ? applyOverrides(departmentId, recordType, rows) : rows;
}

export async function loadFermilabModule(module: string, departmentId = ""): Promise<StickneyModuleData> {
  if (module === "dashboard") return { summary: await summary() };
  if (module === "staffing") return { employees: await loadFermilabEmployees(departmentId) };
  if (module === "live-ops" || module === "scheduling") {
    const start = chicagoDate(module === "scheduling" ? -7 : 0);
    const end = chicagoDate(35);
    const [scheduleRows, employees, inventory, dutyRows] = await Promise.all([
      scheduleRaw(start, end),
      loadFermilabEmployees(departmentId),
      module === "live-ops" ? inventoryData("inventory", departmentId) : Promise.resolve({} as StickneyModuleData),
      module === "live-ops" ? mirrorRows("daily_duty_tasks") : Promise.resolve([]),
    ]);
    const schedule = await withOverrides(departmentId, "schedule", scheduleRows);
    const duties: StickneyDuty[] = dutyRows.filter((row) => boolean(row.active)).map((row) => ({
      id: text(row.id), day_of_week: weekday(row), shift_key: shiftSegment(row), duty: text(row.title), detail: text(row.instructions),
      category: text(row.recurrence_kind) || text(row.recurrence), assigned_to: text(row.assigned_shift), updated_at: text(row.updated_at),
    }));
    return module === "scheduling"
      ? { employees, schedule }
      : { ...inventory, employees, schedule: schedule.filter((row) => row.work_date === chicagoDate()), scheduleCalendar: schedule, duties: await withOverrides(departmentId, "duty", duties), dutyContext: dutyContext() };
  }
  if (module === "preplans") {
    const [preplanRows, importRows, hydrantRows] = await Promise.all([mirrorRows("field_preplans"), mirrorRows("field_preplan_imports"), mirrorRows("field_hydrants")]);
    const preplans = preplanRows.map(mapPreplan).sort((a, b) => a.business_name.localeCompare(b.business_name));
    const preplanImports: StickneyPreplanImport[] = importRows.map((row) => ({
      id: text(row.id), business_name: text(row.business_name), address: text(row.address), status: text(row.status), latitude: null, longitude: null, linked_preplan_id: nullableText(row.linked_preplan_id),
    }));
    const hydrants = hydrantRows.map(mapHydrant);
    return { preplans: await withOverrides(departmentId, "preplan", preplans), preplanImports, hydrants: await withOverrides(departmentId, "hydrant", hydrants) };
  }
  if (module === "hydrants") return { hydrants: await withOverrides(departmentId, "hydrant", (await mirrorRows("field_hydrants")).map(mapHydrant)) };
  if (module === "fleet" || module === "inventory") return inventoryData(module, departmentId);
  if (module === "duties") {
    const rows = (await mirrorRows("daily_duty_tasks")).filter((row) => boolean(row.active));
    const duties: StickneyDuty[] = rows.map((row) => ({
      id: text(row.id), day_of_week: weekday(row), shift_key: shiftSegment(row), duty: text(row.title), detail: text(row.instructions),
      category: text(row.recurrence_kind) || text(row.recurrence), assigned_to: text(row.assigned_shift), updated_at: text(row.updated_at),
    }));
    return { duties: await withOverrides(departmentId, "duty", duties), dutyContext: dutyContext() };
  }
  if (module === "documents") {
    const [boxCardRows, policyRows] = await Promise.all([mirrorRows("box_cards"), mirrorRows("policies")]);
    const boxCards = boxCardRows.filter((row) => text(row.status).toLowerCase() !== "inactive").map(mapBoxCard);
    const policies: StickneyPolicy[] = policyRows.map((row) => ({
      id: text(row.id), title: text(row.title), policy_number: text(row.policy_number), category: text(row.category), effective_date: text(row.effective_date),
      body: text(row.body), status: text(row.status), updated_at: text(row.updated_at),
    }));
    return { boxCards: await withOverrides(departmentId, "box_card", boxCards), policies: await withOverrides(departmentId, "policy", policies) };
  }
  if (module === "phones") {
    const phoneNumbers: StickneyPhoneNumber[] = (await mirrorRows("important_phone_numbers")).map((row) => ({
      id: text(row.id), category: text(row.category), name: text(row.name), emergency_number: text(row.emergency_number),
      non_emergency_number: text(row.non_emergency_number), notes: text(row.notes), sort_order: number(row.sort_order),
    }));
    return { phoneNumbers: await withOverrides(departmentId, "phone", phoneNumbers) };
  }
  return {};
}

export async function downloadFermilabMedia(mediaId: string) {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(mediaId)) return null;
  const supabase = client();
  const { data, error } = await supabase
    .from("fermilab_media_mirror")
    .select("source_record_id,storage_bucket,storage_path,content_type,copy_status")
    .eq("tenant_slug", TENANT_SLUG)
    .eq("source_table", "inventory_media")
    .eq("source_record_id", mediaId)
    .maybeSingle();
  if (error) throw new Error(`Fermilab media lookup failed: ${error.message}`);
  const row = data as MediaMirrorRow | null;
  if (!row || row.copy_status !== "copied" || !row.storage_bucket || !row.storage_path) return null;
  const download = await supabase.storage.from(row.storage_bucket).download(row.storage_path);
  if (download.error || !download.data) throw new Error(`Fermilab media download failed: ${download.error?.message || "Object unavailable"}`);
  return { blob: download.data, contentType: row.content_type || download.data.type || "application/octet-stream" };
}
