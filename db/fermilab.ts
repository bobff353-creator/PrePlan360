import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyDepartmentSourceOverlays, type StickneyApparatus, type StickneyEmployee, type StickneyInventoryCompartment, type StickneyInventoryItem, type StickneyInventoryPhoto, type StickneyModuleData, type StickneyScheduleAssignment, type StickneyScheduleRequest } from "@/db/stickney";

const expectedProjectRef = "tskywxetyvszuljumlsi";
const tenantSlug = "fermilab";
type Raw = Record<string, unknown>;
type MirrorRow = { source_record_id: string; record_data: Raw };

let client: SupabaseClient | null = null;

function projectRef(value: string) {
  try { return new URL(value).hostname.split(".")[0]?.toLowerCase() || ""; } catch { return ""; }
}

function database() {
  const url = process.env.FERMILAB_SUPABASE_URL?.trim() || "";
  const key = process.env.FERMILAB_SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !key) throw new Error("The Fermilab private record copy is not configured.");
  if (projectRef(url) !== expectedProjectRef) throw new Error("The Fermilab copy URL does not match its approved private project.");
  if (!client) client = createClient(url, key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return client;
}

function text(row: Raw | undefined, key: string, fallback = "") { const value = row?.[key]; return value == null ? fallback : String(value); }
function number(row: Raw | undefined, key: string, fallback = 0) { const value = Number(row?.[key]); return Number.isFinite(value) ? value : fallback; }
function nullableNumber(row: Raw | undefined, key: string) { const value = Number(row?.[key]); return row?.[key] == null || row?.[key] === "" || !Number.isFinite(value) ? null : value; }
function enabled(row: Raw | undefined, key: string) { return [true, 1, "1", "true"].includes(row?.[key] as never); }
function array(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
}

async function latestRun() {
  const { data, error } = await database().from("fermilab_mirror_runs").select("id,source_counts,completed_at").eq("tenant_slug", tenantSlug).eq("status", "complete").order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Unable to read the Fermilab copy audit: ${error.message}`);
  if (!data?.id) throw new Error("No completed Fermilab record copy is available.");
  return data as { id: string; source_counts: Record<string, number>; completed_at: string };
}

async function records(table: string, runId: string) {
  const rows: MirrorRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await database().from("fermilab_record_mirror").select("source_record_id,record_data").eq("tenant_slug", tenantSlug).eq("source_table", table).eq("last_seen_run_id", runId).range(from, from + 999);
    if (error) throw new Error(`Unable to read copied Fermilab ${table}: ${error.message}`);
    const page = (data || []) as MirrorRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows.map((row) => row.record_data);
}

function chicagoDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function employees(runId: string, departmentId: string) {
  const [employeeRows, profiles, scales, rotations, members] = await Promise.all([records("employees", runId), records("employee_profiles", runId), records("pay_scales", runId), records("schedule_rotations", runId), records("schedule_rotation_members", runId)]);
  const profileById = new Map(profiles.map((row) => [text(row, "employee_id"), row]));
  const scaleById = new Map(scales.map((row) => [text(row, "id"), row]));
  const rotationById = new Map(rotations.filter((row) => enabled(row, "active")).map((row) => [text(row, "id"), row]));
  const homeShift = new Map<string, string>();
  members.forEach((row) => { const rotation = rotationById.get(text(row, "rotation_id")); if (rotation && !homeShift.has(text(row, "employee_id"))) homeShift.set(text(row, "employee_id"), text(rotation, "name")); });
  const source = employeeRows.map((row): StickneyEmployee => {
    const id = text(row, "id");
    const profile = profileById.get(id);
    const rank = text(scaleById.get(text(row, "pay_scale_id")), "label", "Unassigned");
    const roleText = `${rank} ${text(profile, "driver_status")}`.toLowerCase();
    const roles = new Set<string>(["Firefighter"]);
    if (/chief|captain|lieutenant|officer/.test(roleText) || enabled(profile, "acting_officer_eligible") || enabled(profile, "battalion_chief_eligible")) { roles.add("Officer"); roles.add("Command"); }
    if (/medic|paramedic/.test(roleText)) roles.add("Medic");
    if (/driver|engineer/.test(roleText)) roles.add("Driver / Engineer");
    return {
      id, name: text(row, "name"), rank, employment_type: text(profile, "employment_type"), driver_status: text(profile, "driver_status"),
      start_date: text(profile, "start_date") || null, employment_end_date: text(profile, "end_date") || null, qualified_roles: [...roles],
      photo_updated_at: text(profile, "photo_updated_at") || null, employee_number: text(profile, "employee_number"), phone: text(profile, "phone"), email: text(profile, "email"),
      schedule_sms_opt_in: enabled(profile, "schedule_sms_opt_in") ? 1 : 0, station_notify_email: 0, station_notify_text: 0, home_shift: homeShift.get(id) || "", station_role: rank,
      emergency_name: text(profile, "emergency_name"), emergency_relationship: text(profile, "emergency_relationship"), emergency_phone: text(profile, "emergency_phone"), notes: text(profile, "notes"),
    };
  });
  return applyDepartmentSourceOverlays(departmentId, "employee", source);
}

async function scheduling(runId: string, departmentId: string) {
  const [employeeRows, assignments, rotations, requests] = await Promise.all([employees(runId, departmentId), records("schedule_assignments", runId), records("schedule_rotations", runId), records("schedule_requests", runId)]);
  const employeeById = new Map(employeeRows.map((row) => [row.id, row]));
  const rotationById = new Map(rotations.map((row) => [text(row, "id"), row]));
  const start = chicagoDate(-7), end = chicagoDate(35);
  const visible = assignments.filter((row) => text(row, "employee_id") && text(row, "work_date") >= start && text(row, "work_date") <= end && text(row, "status", "assigned") !== "cancelled").map((row): StickneyScheduleAssignment => {
    const employee = employeeById.get(text(row, "employee_id"));
    const rotation = rotationById.get(text(row, "rotation_id"));
    return { id: text(row, "id"), work_date: text(row, "work_date"), shift_name: text(rotation, "name", text(row, "source", "Fermilab shift")), start_time: text(row, "start_time"), end_time: text(row, "end_time"), role: text(row, "role"), employee_id: text(row, "employee_id"), employee_name: employee?.name || "Employee not found", rank: employee?.rank || text(row, "required_rank") };
  });
  const schedule = await applyDepartmentSourceOverlays(departmentId, "schedule", visible);
  const scheduleRequests = requests.map((row): StickneyScheduleRequest => ({ id: text(row, "id"), request_type: text(row, "request_type"), employee_id: text(row, "employee_id"), employee_name: employeeById.get(text(row, "employee_id"))?.name || "Employee not found", target_employee_name: employeeById.get(text(row, "target_employee_id"))?.name || "", start_date: text(row, "start_date"), end_date: text(row, "end_date"), start_time: text(row, "start_time"), end_time: text(row, "end_time"), role: text(row, "role"), status: text(row, "status"), target_status: text(row, "target_status"), notes: text(row, "notes") }));
  return { employees: employeeRows, schedule, scheduleRequests };
}

async function fleet(runId: string, module: string, departmentId: string): Promise<StickneyModuleData> {
  const [units, specs, compartmentsRaw, equipmentRaw, mediaRaw, checksRaw, checkItems, deficiencies] = await Promise.all([records("fleet_apparatus", runId), records("fleet_apparatus_specs", runId), records("inventory_compartments", runId), records("inventory_equipment", runId), records("inventory_media", runId), records("inventory_checks", runId), records("inventory_check_items", runId), records("inventory_deficiencies", runId)]);
  const specByUnit = new Map(specs.map((row) => [text(row, "apparatus_id"), row]));
  const apparatus = await applyDepartmentSourceOverlays(departmentId, "apparatus", units.filter((row) => !enabled(row, "retired")).map((row): StickneyApparatus => { const spec = specByUnit.get(text(row, "id")); return { id: text(row, "id"), name: text(row, "display_name") || text(row, "unit_name"), asset_type: text(row, "asset_kind", "apparatus"), status: text(row, "status", "in_service"), vin: text(spec, "vin") || null, manufacturer: text(spec, "manufacturer") || null, model: text(spec, "model") || null, year: nullableNumber(spec, "year"), weekly_due_day: nullableNumber(row, "weekly_due_day"), maintenance_schedule: text(spec, "maintenance_json"), owner_manual_url: text(spec, "source_url"), service_manual_url: "", parts_catalog_url: "", preferred_vendor: "", service_profile_verified_at: text(spec, "decoded_at") || null }; }));
  const compartments = compartmentsRaw.map((row): StickneyInventoryCompartment => ({ id: text(row, "id"), apparatus_id: text(row, "apparatus_id"), label: text(row, "name"), side: text(row, "details"), sort_order: number(row, "sort_order") }));
  const inventory = await applyDepartmentSourceOverlays(departmentId, "inventory", equipmentRaw.filter((row) => !enabled(row, "retired")).map((row): StickneyInventoryItem => ({ id: text(row, "id"), apparatus_id: text(row, "apparatus_id"), compartment_id: text(row, "compartment_id") || null, name: text(row, "name"), manufacturer: text(row, "manufacturer") || null, model: text(row, "model") || null, serial_number: text(row, "serial_number") || null, barcode: text(row, "barcode") || null, quantity_required: number(row, "quantity", 1), equipment_category: text(row, "category") || null, check_types: [text(row, "inventory_profile")].filter(Boolean), source_form: text(row, "asset_number") || null, item_order: null, retired_at: null })));
  const inventoryPhotos = mediaRaw.map((row): StickneyInventoryPhoto => ({ id: text(row, "id"), apparatus_id: text(row, "apparatus_id"), compartment_id: text(row, "compartment_id") || null, equipment_id: text(row, "equipment_id") || null, view_level: text(row, "kind", "photo"), door_state: "", original_filename: text(row, "filename"), mime_type: text(row, "content_type"), byte_size: number(row, "size_bytes"), approval_status: "copied", captured_at: text(row, "created_at") }));
  const itemsByCheck = Map.groupBy(checkItems, (row) => text(row, "check_id"));
  const fleetChecks = module === "fleet" ? checksRaw.map((row) => { const items = itemsByCheck.get(text(row, "id")) || []; return { id: text(row, "id"), apparatus_id: text(row, "apparatus_id"), check_type: text(row, "check_type") || text(row, "inventory_profile", "inventory"), status: text(row, "status"), started_by: text(row, "started_by"), started_at: text(row, "started_at"), completed_at: text(row, "completed_at") || null, item_count: items.length, pending_count: items.filter((item) => ["", "unchecked", "pending"].includes(text(item, "status"))).length, failed_count: items.filter((item) => ["failed", "missing", "damaged"].includes(text(item, "status"))).length, latest_odometer: nullableNumber(row, "odometer") }; }) : [];
  return { apparatus, compartments, inventory, inventoryPhotos, fleetChecks, readinessExceptions: deficiencies.map((row) => ({ id: text(row, "id"), apparatus_id: text(row, "apparatus_id"), result: text(row, "result", "deficiency"), priority: text(row, "priority", "normal"), notes: text(row, "notes"), status: text(row, "status", "open"), out_of_service: enabled(row, "out_of_service"), opened_by: text(row, "opened_by"), opened_at: text(row, "opened_at", text(row, "created_at")), issue_categories: array(row.issue_categories), assigned_employee_names: array(row.assigned_employee_names) })), workOrders: [], fleetSources: { checks: true, readinessExceptions: true, workOrders: false } };
}

export async function loadFermilabModule(module: string, departmentId: string): Promise<StickneyModuleData> {
  const run = await latestRun();
  const counts = run.source_counts || {};
  if (module === "dashboard") return { summary: { employees: counts.employees || 0, schedule_assignments: counts.schedule_assignments || 0, preplans: counts.field_preplans || 0, preplan_imports: counts.field_preplan_imports || 0, hydrants: counts.field_hydrants || 0, apparatus: counts.fleet_apparatus || 0, inventory_items: counts.inventory_equipment || 0, inventory_photos: counts.inventory_media || 0, duties: counts.daily_duty_tasks || counts.daily_duties || 0, box_cards: counts.box_cards || 0, policies: counts.policies || 0, phone_numbers: counts.important_phone_numbers || 0 } };
  if (module === "live-ops") {
    const [scheduleData, fleetData] = await Promise.all([scheduling(run.id, departmentId), fleet(run.id, "live-ops", departmentId)]);
    return { ...scheduleData, apparatus: fleetData.apparatus };
  }
  if (module === "staffing") return { employees: await employees(run.id, departmentId) };
  if (module === "scheduling") return scheduling(run.id, departmentId);
  if (module === "preplans" || module === "hydrants") {
    const [plans, imports, hydrants] = await Promise.all([records("field_preplans", run.id), records("field_preplan_imports", run.id), records("field_hydrants", run.id)]);
    const mappedHydrants = await applyDepartmentSourceOverlays(departmentId, "hydrant", hydrants.map((row) => ({ id: text(row, "id"), hydrant_number: text(row, "hydrant_number"), address: text(row, "address"), latitude: nullableNumber(row, "latitude"), longitude: nullableNumber(row, "longitude"), service_status: text(row, "service_status"), manufacturer: text(row, "manufacturer"), model: text(row, "model"), notes: text(row, "notes"), updated_at: text(row, "updated_at") })));
    if (module === "hydrants") return { hydrants: mappedHydrants };
    return { preplans: await applyDepartmentSourceOverlays(departmentId, "preplan", plans.map((row) => ({ id: text(row, "id"), business_name: text(row, "business_name"), address: text(row, "address"), latitude: nullableNumber(row, "latitude"), longitude: nullableNumber(row, "longitude"), footprint_json: text(row, "footprint", "[]"), construction_type: text(row, "construction_type"), floor_count: number(row, "floor_count", 1), suggested_fire_flow_gpm: number(row, "suggested_fire_flow_gpm"), contact_info: text(row, "contact_info"), construction: text(row, "construction"), access_info: text(row, "access_info"), alarm_system: text(row, "alarm_system"), knox_box: text(row, "knox_box"), riser: text(row, "riser"), fdc: text(row, "fdc"), sprinkler_system: text(row, "sprinkler_system"), status: text(row, "status"), updated_at: text(row, "updated_at") }))), preplanImports: imports.map((row) => ({ id: text(row, "id"), business_name: text(row, "business_name"), address: text(row, "address"), status: text(row, "status"), latitude: nullableNumber(row, "latitude"), longitude: nullableNumber(row, "longitude"), linked_preplan_id: text(row, "linked_preplan_id") || null })), hydrants: mappedHydrants };
  }
  if (module === "fleet" || module === "inventory") return fleet(run.id, module, departmentId);
  if (module === "duties") {
    const [tasks, completions] = await Promise.all([records("daily_duty_tasks", run.id), records("daily_duty_completions", run.id)]);
    const completed = new Map<string, string>();
    completions.filter((row) => enabled(row, "completed")).forEach((row) => { const taskId = text(row, "duty_id"); const period = text(row, "period_key"); if (period && period > (completed.get(taskId) || "")) completed.set(taskId, period); });
    const duties = tasks.filter((row) => row.active == null || enabled(row, "active")).flatMap((row) => { const weekdays = array(row.weekdays_json).map(Number).filter((day) => day >= 0 && day <= 6); const days = text(row, "recurrence_kind") === "daily" || text(row, "schedule_bucket") === "everyday" ? [0,1,2,3,4,5,6] : weekdays.length ? weekdays : [0]; return days.map((day) => ({ id: `${text(row, "id")}:${day}`, day_of_week: day, shift_key: /night/i.test(text(row, "assigned_shift")) ? "night" : /afternoon/i.test(text(row, "assigned_shift")) ? "afternoon" : "morning", duty: text(row, "title"), detail: text(row, "instructions") || text(row, "schedule_details"), category: text(row, "recurrence"), assigned_to: text(row, "assigned_employee_id"), due_time: "", completed_date: completed.get(text(row, "id")) || "", updated_at: text(row, "updated_at") })); });
    return { duties: await applyDepartmentSourceOverlays(departmentId, "duty", duties), dutyContext: { date: chicagoDate(), dayOfWeek: new Date(`${chicagoDate()}T12:00:00`).getDay(), segment: new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "night" } };
  }
  if (module === "documents") {
    const [cards, policies] = await Promise.all([records("box_cards", run.id), records("policies", run.id)]);
    return { boxCards: await applyDepartmentSourceOverlays(departmentId, "box_card", cards.filter((row) => text(row, "status", "Active") === "Active").map((row) => ({ id: text(row, "id"), title: text(row, "title"), address: text(row, "address"), box_number: text(row, "box_number"), access_notes: text(row, "access_notes"), details: text(row, "details"), department: text(row, "department", "Fermilab"), document_url: text(row, "document_url"), document_page: number(row, "document_page"), status: text(row, "status"), updated_at: text(row, "updated_at") }))), policies: await applyDepartmentSourceOverlays(departmentId, "policy", policies.filter((row) => text(row, "status", "Active") === "Active").map((row) => ({ id: text(row, "id"), title: text(row, "title"), policy_number: text(row, "policy_number"), category: text(row, "category"), effective_date: text(row, "effective_date"), body: text(row, "body"), status: text(row, "status"), updated_at: text(row, "updated_at") }))) };
  }
  if (module === "phones") { const rows = await records("important_phone_numbers", run.id); return { phoneNumbers: await applyDepartmentSourceOverlays(departmentId, "phone", rows.map((row) => ({ id: text(row, "id"), category: text(row, "category"), name: text(row, "name"), emergency_number: text(row, "emergency_number"), non_emergency_number: text(row, "non_emergency_number"), notes: text(row, "notes"), sort_order: number(row, "sort_order") }))) }; }
  return {};
}

export async function fermilabMedia(sourceTable: string, sourceRecordId: string) {
  const run = await latestRun();
  const { data, error } = await database().from("fermilab_media_mirror").select("storage_bucket,storage_path,content_type,filename").eq("tenant_slug", tenantSlug).eq("source_table", sourceTable).eq("source_record_id", sourceRecordId).eq("last_seen_run_id", run.id).eq("copy_status", "copied").limit(1).maybeSingle();
  if (error || !data?.storage_path) return null;
  const { data: file, error: downloadError } = await database().storage.from(data.storage_bucket).download(data.storage_path);
  if (downloadError || !file) return null;
  return { file, contentType: data.content_type || file.type || "application/octet-stream", filename: data.filename || "file" };
}
