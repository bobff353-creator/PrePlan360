import "server-only";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ukpdacqjmhvlhmrwxtcx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_HY1UlYHvPnvDIuq_N_X_Sg_xu7bxTzs";

export type StickneySummary = {
  employees: number;
  schedule_assignments: number;
  preplans: number;
  preplan_imports: number;
  hydrants: number;
  apparatus: number;
  inventory_items: number;
  inventory_photos: number;
  duties: number;
  box_cards: number;
  policies: number;
  phone_numbers: number;
};

export type StickneyEmployee = {
  id: string;
  name: string;
  rank: string;
  employment_type: string;
  driver_status: string;
  start_date: string | null;
  employment_end_date: string | null;
  qualified_roles: string[];
  photo_updated_at: string | null;
  employee_number: string;
  phone: string;
  email: string;
  schedule_sms_opt_in: number;
  station_notify_email: number;
  station_notify_text: number;
  home_shift: string;
  station_role: string;
  emergency_name: string;
  emergency_relationship: string;
  emergency_phone: string;
  notes: string;
};

export type StickneyScheduleAssignment = {
  id: string;
  work_date: string;
  shift_name: string;
  shift_color?: string;
  start_time: string;
  end_time: string;
  role: string;
  employee_id: string;
  employee_name: string;
  rank: string;
};

export type StickneyPreplan = {
  id: string;
  business_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  footprint_json?: string;
  construction_type: string;
  floor_count: number;
  suggested_fire_flow_gpm: number;
  contact_info: string;
  construction: string;
  access_info: string;
  alarm_system: string;
  knox_box: string;
  riser: string;
  fdc: string;
  sprinkler_system: string;
  status: string;
  updated_at: string;
};

export type StickneyPreplanImport = {
  id: string;
  business_name: string;
  address: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  linked_preplan_id: string | null;
};

export type StickneyHydrant = {
  id: string;
  hydrant_number: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  service_status: string;
  manufacturer: string;
  model: string;
  notes: string;
  updated_at: string;
};

export type StickneyApparatus = {
  id: string;
  name: string;
  asset_type: string;
  status: string;
  vin: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  weekly_due_day: number | null;
  maintenance_schedule: string;
  owner_manual_url: string;
  service_manual_url: string;
  parts_catalog_url: string;
  preferred_vendor: string;
  service_profile_verified_at: string | null;
};

export type StickneyFleetCheck = {
  id: string;
  apparatus_id: string;
  check_type: string;
  status: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
  item_count: number;
  pending_count: number;
  failed_count: number;
  latest_odometer: number | null;
};
export type StickneyReadinessException = {
  id: string;
  apparatus_id: string;
  result: string;
  priority: string;
  notes: string;
  status: string;
  out_of_service: boolean;
  opened_by: string;
  opened_at: string;
  issue_categories: string[];
  assigned_employee_names: string[];
};
export type StickneyWorkOrder = {
  id: string;
  apparatus_id: string;
  status: string;
  priority: string;
  summary: string;
  details: string;
  assigned_to: string;
  opened_by: string;
  opened_at: string;
  due_at: string | null;
  assigned_employee_names: string[];
  repair_date: string | null;
  repair_cost: number | null;
  vendor: string | null;
  resolution_notes: string | null;
};

export type StickneyInventoryCompartment = {
  id: string;
  apparatus_id: string;
  label: string;
  side: string;
  sort_order: number;
};

export type StickneyInventoryItem = {
  id: string;
  apparatus_id: string;
  compartment_id: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  barcode: string | null;
  quantity_required: number;
  equipment_category: string | null;
  check_types: string[] | null;
  source_form: string | null;
  item_order: number | null;
  retired_at: string | null;
};

export type StickneyInventoryPhoto = {
  id: string;
  apparatus_id: string;
  compartment_id: string | null;
  equipment_id: string | null;
  view_level: string;
  door_state: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  approval_status: string;
  captured_at: string;
};

export type StickneyDuty = {
  id: string;
  day_of_week: number;
  shift_key: string;
  duty: string;
  detail?: string;
  category?: string;
  assigned_to?: string;
  due_time?: string;
  completed_date?: string;
  updated_at: string;
};
export type StickneyBoxCard = {
  id: string;
  title: string;
  address: string;
  box_number: string;
  access_notes: string;
  details: string;
  department: string;
  document_url: string;
  document_page: number;
  status: string;
  updated_at: string;
};
export type StickneyPolicy = {
  id: string;
  title: string;
  policy_number: string;
  category: string;
  effective_date: string;
  body: string;
  status: string;
  updated_at: string;
};
export type StickneyPhoneNumber = {
  id: string;
  category: string;
  name: string;
  emergency_number: string;
  non_emergency_number: string;
  notes: string;
  sort_order: number;
};

export type StickneyModuleData = {
  summary?: StickneySummary;
  employees?: StickneyEmployee[];
  schedule?: StickneyScheduleAssignment[];
  scheduleCalendar?: StickneyScheduleAssignment[];
  preplans?: StickneyPreplan[];
  preplanImports?: StickneyPreplanImport[];
  hydrants?: StickneyHydrant[];
  apparatus?: StickneyApparatus[];
  compartments?: StickneyInventoryCompartment[];
  inventory?: StickneyInventoryItem[];
  inventoryPhotos?: StickneyInventoryPhoto[];
  fleetChecks?: StickneyFleetCheck[];
  readinessExceptions?: StickneyReadinessException[];
  workOrders?: StickneyWorkOrder[];
  fleetSources?: {
    checks: boolean;
    readinessExceptions: boolean;
    workOrders: boolean;
  };
  duties?: StickneyDuty[];
  dutyContext?: { date: string; dayOfWeek: number; segment: string };
  boxCards?: StickneyBoxCard[];
  policies?: StickneyPolicy[];
  phoneNumbers?: StickneyPhoneNumber[];
};

export type StickneyEditableRecordType = "employee" | "schedule" | "preplan" | "hydrant" | "apparatus" | "inventory" | "duty" | "box_card" | "policy" | "phone";

export const STICKNEY_WORK_ROLES = ["Officer", "Driver / Engineer", "Medic", "Firefighter", "Command", "Other"] as const;

export function stickneyEmployeeActiveOn(employee: StickneyEmployee, date: string) {
  return (!employee.start_date || employee.start_date <= date) && (!employee.employment_end_date || date <= employee.employment_end_date);
}

export function stickneyEmployeeRoles(employee: StickneyEmployee) {
  const saved = Array.isArray(employee.qualified_roles) ? employee.qualified_roles.filter((role) => STICKNEY_WORK_ROLES.includes(role as (typeof STICKNEY_WORK_ROLES)[number])) : [];
  if (saved.length) return saved;
  const text = `${employee.rank} ${employee.station_role} ${employee.driver_status}`;
  const roles: string[] = [];
  if (/chief|captain|lieutenant|officer/i.test(text)) roles.push("Officer");
  if (/engineer|driver|pump/i.test(text)) roles.push("Driver / Engineer");
  if (/paramedic|emt-p|medic/i.test(text)) roles.push("Medic");
  if (/firefighter|ff\b/i.test(text)) roles.push("Firefighter");
  if (/chief|command/i.test(text)) roles.push("Command");
  return roles.length ? [...new Set(roles)] : ["Firefighter"];
}

function client() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function read<T>(sql: string): Promise<T[]> {
  const secret = process.env.STICKNEY_DATABASE_SECRET?.replace(/^[\s"']+|[\s"']+$/g, "");
  if (!secret) throw new Error("The Stickney data connection is not configured.");
  if (!/^\s*(select|with)\b/i.test(sql) || /;|--|\/\*|\*\//.test(sql)) {
    throw new Error("Stickney reads must be a single read-only query.");
  }
  const { data, error } = await client().rpc("firehouse_server_sql", {
    p_sql: sql,
    p_mode: "all",
    p_secret: secret,
  });
  if (error) throw new Error(`Stickney data read failed: ${error.message}`);
  return (data ?? []) as T[];
}

async function optionalRead<T>(sql: string): Promise<{ rows: T[]; connected: boolean }> {
  try {
    return { rows: await read<T>(sql), connected: true };
  } catch {
    return { rows: [], connected: false };
  }
}

async function fleetApparatus(): Promise<StickneyApparatus[]> {
  try {
    return await read<StickneyApparatus>(`select p.id,p.name,p.asset_type,coalesce(a.status,'not_recorded') as status,p.vin,p.manufacturer,p.model,p.year,p.weekly_due_day,coalesce(p.maintenance_schedule,'') as maintenance_schedule,coalesce(p.owner_manual_url,'') as owner_manual_url,coalesce(p.service_manual_url,'') as service_manual_url,coalesce(p.parts_catalog_url,'') as parts_catalog_url,coalesce(p.preferred_vendor,'') as preferred_vendor,p.service_profile_verified_at from inventory_apparatus_profiles p left join department_apparatus a on a.id=p.id where p.id in(select id from stickney_inventory_apparatus) order by p.name`);
  } catch {
    return read<StickneyApparatus>(`select id,name,asset_type,'not_recorded' as status,null::text as vin,manufacturer,model,year,weekly_due_day,'' as maintenance_schedule,'' as owner_manual_url,'' as service_manual_url,'' as parts_catalog_url,'' as preferred_vendor,null::text as service_profile_verified_at from stickney_inventory_apparatus order by name`);
  }
}

async function applyOverrides<T extends { id: string }>(departmentId: string, recordType: StickneyEditableRecordType, rows: T[]): Promise<T[]> {
  const result = await import("@/db/access").then(({ db }) => db().prepare("SELECT source_record_id,data_json,status FROM stickney_record_overrides WHERE department_id=? AND record_type=?").bind(departmentId, recordType).all<{ source_record_id: string; data_json: string; status: string }>());
  const overrides = new Map(result.results.map((row) => [row.source_record_id, row]));
  const merged = rows.flatMap((row) => {
    const override = overrides.get(row.id);
    if (override?.status === "hidden") return [];
    if (!override) return [row];
    try {
      return [{ ...row, ...JSON.parse(override.data_json), id: row.id } as T];
    } catch {
      return [row];
    }
  });
  const sourceIds = new Set(rows.map((row) => row.id));
  const local = result.results.flatMap((row) => {
    if (sourceIds.has(row.source_record_id) || row.status === "hidden" || !row.source_record_id.startsWith(`${recordType}_`)) return [];
    try {
      return [{ ...JSON.parse(row.data_json), id: row.source_record_id } as T];
    } catch {
      return [];
    }
  });
  return [...merged, ...local];
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

function chicagoDutyContext() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const weekday = parts.find((item) => item.type === "weekday")?.value || "Sunday";
  const hour = Number(parts.find((item) => item.type === "hour")?.value || 0);
  const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(weekday);
  return {
    date: chicagoDate(),
    dayOfWeek: Math.max(0, dayOfWeek),
    segment: hour < 12 ? "morning" : hour < 18 ? "afternoon" : "night",
  };
}

export async function loadStickneyEmployees(departmentId = "") {
  const employees = await read<StickneyEmployee>(`
    select e.id,e.name,p.label as rank,coalesce(ep.employment_type,'') as employment_type,
      coalesce(ep.driver_status,'') as driver_status,ep.start_date,null::text as employment_end_date,ep.photo_updated_at,
      coalesce(ep.employee_number,'') as employee_number,coalesce(ep.phone,'') as phone,
      coalesce(ep.email,'') as email,coalesce(ep.schedule_sms_opt_in,0) as schedule_sms_opt_in,
      coalesce(ep.station_notify_email,0) as station_notify_email,
      coalesce(ep.station_notify_text,0) as station_notify_text,
      coalesce((select t.name from station_standing_assignments sa join station_shift_types t on t.id=sa.shift_type_id where sa.employee_id=e.id and sa.active=1 order by sa.created_at limit 1),'') as home_shift,
      coalesce((select sa.role from station_standing_assignments sa where sa.employee_id=e.id and sa.active=1 order by sa.created_at limit 1),'') as station_role,
      array[]::text[] as qualified_roles,
      coalesce(ep.emergency_name,'') as emergency_name,
      coalesce(ep.emergency_relationship,'') as emergency_relationship,
      coalesce(ep.emergency_phone,'') as emergency_phone,coalesce(ep.notes,'') as notes
    from employees e join pay_scales p on p.id=e.pay_scale_id
    left join employee_profiles ep on ep.employee_id=e.id
    where e.active=1 order by e.sort_order,e.name
  `);
  return departmentId ? applyOverrides(departmentId, "employee", employees) : employees;
}

export async function loadDepartmentEmployeeOverlays(departmentId: string) {
  return applyOverrides<StickneyEmployee>(departmentId, "employee", []);
}

export async function loadDepartmentScheduleOverlays(departmentId: string) {
  return applyOverrides<StickneyScheduleAssignment>(departmentId, "schedule", []);
}

async function summary(): Promise<StickneySummary> {
  const rows = await read<{ key: keyof StickneySummary; count: number }>(`
    select 'employees' as key, count(*)::int as count from employees where active = 1
    union all select 'schedule_assignments', count(*)::int from station_shift_slots where status = 'filled'
    union all select 'preplans', count(*)::int from field_preplans
    union all select 'preplan_imports', count(*)::int from field_preplan_imports
    union all select 'hydrants', count(*)::int from field_hydrants
    union all select 'apparatus', count(*)::int from stickney_inventory_apparatus
    union all select 'inventory_items', count(*)::int from stickney_inventory_equipment where retired_at is null
    union all select 'inventory_photos', count(*)::int from stickney_inventory_photo_views where replaced_at is null
    union all select 'duties', count(*)::int from daily_duties
    union all select 'box_cards', count(*)::int from box_cards where status = 'Active'
    union all select 'policies', count(*)::int from policies where status = 'Active'
    union all select 'phone_numbers', count(*)::int from important_phone_numbers
  `);
  return Object.fromEntries(rows.map((row) => [row.key, Number(row.count)])) as StickneySummary;
}

export async function loadStickneyModule(module: string, departmentId = ""): Promise<StickneyModuleData> {
  if (module === "dashboard") return { summary: await summary() };
  if (module === "live-ops") {
    const today = chicagoDate();
    const calendarEnd = chicagoDate(35);
    const [apparatus, scheduleCalendar, duties] = await Promise.all([
      fleetApparatus(),
      read<StickneyScheduleAssignment>(`
        select s.id,en.entry_date as work_date,t.name as shift_name,
          coalesce(nullif(s.start_time,''),t.start_time) as start_time,
          coalesce(nullif(s.end_time,''),t.end_time) as end_time,s.role,
          e.id as employee_id,e.name as employee_name,p.label as rank
        from station_shift_slots s
        join station_schedule_entries en on en.id=s.entry_id
        join station_shift_types t on t.id=en.shift_type_id
        join employees e on e.id=s.employee_id
        join pay_scales p on p.id=e.pay_scale_id
        where s.status='filled' and en.entry_date between '${today}' and '${calendarEnd}'
        order by en.entry_date,coalesce(nullif(s.start_time,''),t.start_time),s.sort_order,e.name
      `),
      read<StickneyDuty>(`select id,day_of_week,shift_key,duty,updated_at from daily_duties order by day_of_week,shift_key`),
    ]);
    const [mergedApparatus, mergedScheduleCalendar, mergedDuties] = await Promise.all([
      departmentId ? applyOverrides(departmentId, "apparatus", apparatus) : apparatus,
      departmentId ? applyOverrides(departmentId, "schedule", scheduleCalendar) : scheduleCalendar,
      departmentId ? applyOverrides(departmentId, "duty", duties) : duties,
    ]);
    return {
      apparatus: mergedApparatus,
      schedule: mergedScheduleCalendar.filter((assignment) => assignment.work_date === today),
      scheduleCalendar: mergedScheduleCalendar,
      duties: mergedDuties,
      dutyContext: chicagoDutyContext(),
    };
  }
  if (module === "staffing") return { employees: await loadStickneyEmployees(departmentId) };
  if (module === "scheduling") {
    const start = chicagoDate(-7);
    const end = chicagoDate(35);
    const schedule = await read<StickneyScheduleAssignment>(`
      select s.id,en.entry_date as work_date,t.name as shift_name,
        coalesce(nullif(s.start_time,''),t.start_time) as start_time,
        coalesce(nullif(s.end_time,''),t.end_time) as end_time,s.role,
        e.id as employee_id,e.name as employee_name,p.label as rank
      from station_shift_slots s
      join station_schedule_entries en on en.id=s.entry_id
      join station_shift_types t on t.id=en.shift_type_id
      join employees e on e.id=s.employee_id
      join pay_scales p on p.id=e.pay_scale_id
      where s.status='filled' and en.entry_date between '${start}' and '${end}'
      order by en.entry_date,coalesce(nullif(s.start_time,''),t.start_time),s.sort_order,e.name
    `);
    const [mergedSchedule, employees] = await Promise.all([departmentId ? applyOverrides(departmentId, "schedule", schedule) : schedule, loadStickneyEmployees(departmentId)]);
    return { schedule: mergedSchedule, employees };
  }
  if (module === "preplans") {
    const [preplans, preplanImports, hydrants] = await Promise.all([read<StickneyPreplan>(`select id,business_name,address,latitude,longitude,construction_type,floor_count,suggested_fire_flow_gpm,contact_info,construction,access_info,alarm_system,knox_box,riser,fdc,sprinkler_system,status,updated_at from field_preplans order by business_name`), read<StickneyPreplanImport>(`select id,business_name,address,status,latitude,longitude,linked_preplan_id from field_preplan_imports order by business_name,address`), read<StickneyHydrant>(`select id,hydrant_number,address,latitude,longitude,service_status,manufacturer,model,notes,updated_at from field_hydrants order by hydrant_number,address`)]);
    return {
      preplans: departmentId ? await applyOverrides(departmentId, "preplan", preplans) : preplans,
      preplanImports,
      hydrants: departmentId ? await applyOverrides(departmentId, "hydrant", hydrants) : hydrants,
    };
  }
  if (module === "hydrants") {
    const hydrants = await read<StickneyHydrant>(`select id,hydrant_number,address,latitude,longitude,service_status,manufacturer,model,notes,updated_at from field_hydrants order by hydrant_number,address`);
    return {
      hydrants: departmentId ? await applyOverrides(departmentId, "hydrant", hydrants) : hydrants,
    };
  }
  if (module === "fleet" || module === "inventory") {
    const [apparatus, compartments, inventory, inventoryPhotos, fleetChecksResult, readinessResult, workOrdersResult] = await Promise.all([fleetApparatus(), read<StickneyInventoryCompartment>(`select id,apparatus_id,label,side,sort_order from stickney_inventory_compartments order by apparatus_id,sort_order,label`), read<StickneyInventoryItem>(`select id,apparatus_id,compartment_id,name,manufacturer,model,serial_number,barcode,quantity_required,equipment_category,check_types,source_form,item_order,retired_at from stickney_inventory_equipment where retired_at is null order by apparatus_id,item_order,name`), read<StickneyInventoryPhoto>(`select id,apparatus_id,compartment_id,equipment_id,view_level,door_state,original_filename,mime_type,byte_size,approval_status,captured_at from stickney_inventory_photo_views where replaced_at is null order by captured_at desc`), module === "fleet" ? optionalRead<StickneyFleetCheck>(`select c.id,c.apparatus_id,c.check_type,c.status,c.started_by,c.started_at,c.completed_at,count(i.id)::int as item_count,count(i.id) filter(where i.result='pending')::int as pending_count,count(i.id) filter(where i.result in ('failed','missing','damaged'))::int as failed_count,max(i.numeric_reading) filter(where i.numeric_reading is not null) as latest_odometer from inventory_checks c left join inventory_check_items i on i.check_id=c.id where c.apparatus_id in(select id from stickney_inventory_apparatus) and c.status in ('in_progress','completed') group by c.id,c.apparatus_id,c.check_type,c.status,c.started_by,c.started_at,c.completed_at order by c.started_at desc`) : Promise.resolve({ rows: [], connected: false }), module === "fleet" ? optionalRead<StickneyReadinessException>(`select id,apparatus_id,result,priority,coalesce(notes,'') as notes,status,out_of_service,opened_by,opened_at,issue_categories,assigned_employee_names from inventory_readiness_exceptions where apparatus_id in(select id from stickney_inventory_apparatus) and status<>'resolved' order by opened_at desc`) : Promise.resolve({ rows: [], connected: false }), module === "fleet" ? optionalRead<StickneyWorkOrder>(`select id,apparatus_id,status,priority,summary,coalesce(details,'') as details,coalesce(assigned_to,'') as assigned_to,opened_by,opened_at,due_at,assigned_employee_names,repair_date,repair_cost,vendor,resolution_notes from inventory_work_orders where apparatus_id in(select id from stickney_inventory_apparatus) order by opened_at desc`) : Promise.resolve({ rows: [], connected: false })]);
    return {
      apparatus: departmentId ? await applyOverrides(departmentId, "apparatus", apparatus) : apparatus,
      compartments,
      inventory: departmentId ? await applyOverrides(departmentId, "inventory", inventory) : inventory,
      inventoryPhotos,
      fleetChecks: fleetChecksResult.rows,
      readinessExceptions: readinessResult.rows,
      workOrders: workOrdersResult.rows,
      fleetSources: {
        checks: fleetChecksResult.connected,
        readinessExceptions: readinessResult.connected,
        workOrders: workOrdersResult.connected,
      },
    };
  }
  if (module === "duties") {
    const duties = await read<StickneyDuty>(`select id,day_of_week,shift_key,duty,updated_at from daily_duties order by day_of_week,shift_key`);
    return {
      duties: departmentId ? await applyOverrides(departmentId, "duty", duties) : duties,
      dutyContext: chicagoDutyContext(),
    };
  }
  if (module === "documents") {
    const [boxCards, policies] = await Promise.all([read<StickneyBoxCard>(`select id,title,address,box_number,access_notes,details,department,document_url,document_page,status,updated_at from box_cards where status='Active' order by department,title`), read<StickneyPolicy>(`select id,title,policy_number,category,effective_date,body,status,updated_at from policies where status='Active' order by policy_number,title`)]);
    return {
      boxCards: departmentId ? await applyOverrides(departmentId, "box_card", boxCards) : boxCards,
      policies: departmentId ? await applyOverrides(departmentId, "policy", policies) : policies,
    };
  }
  if (module === "phones") {
    const phoneNumbers = await read<StickneyPhoneNumber>(`select id,category,name,emergency_number,non_emergency_number,notes,sort_order from important_phone_numbers order by category,sort_order,name`);
    return {
      phoneNumbers: departmentId ? await applyOverrides(departmentId, "phone", phoneNumbers) : phoneNumbers,
    };
  }
  return {};
}

export async function isStickneyEmployeeWithPhoto(employeeId: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(employeeId)) return false;
  const rows = await read<{ id: string }>(`select e.id from employees e join employee_profiles ep on ep.employee_id=e.id where e.active=1 and ep.photo_updated_at is not null and e.id='${employeeId}' limit 1`);
  return rows.length === 1;
}
