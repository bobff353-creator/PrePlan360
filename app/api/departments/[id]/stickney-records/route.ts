import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canDepartmentPermission, db, getDepartment, id, now, type DepartmentPermission } from "@/db/access";
import { loadDepartmentEmployeeOverlays, loadStickneyEmployees, stickneyEmployeeActiveOn, stickneyEmployeeRoles, type StickneyEditableRecordType } from "@/db/stickney";

const definitions: Record<
  StickneyEditableRecordType,
  {
    permission: DepartmentPermission;
    module: string;
    fields: Record<string, number>;
  }
> = {
  employee: {
    permission: "staffing",
    module: "staffing",
    fields: {
      name: 160,
      rank: 100,
      employment_type: 100,
      driver_status: 100,
      start_date: 20,
      employment_end_date: 20,
      employee_number: 80,
      phone: 80,
      email: 200,
      schedule_sms_opt_in: 1,
      station_notify_email: 1,
      station_notify_text: 1,
      home_shift: 120,
      station_role: 120,
      qualified_roles: 1000,
      emergency_name: 160,
      emergency_relationship: 100,
      emergency_phone: 80,
      notes: 3000,
    },
  },
  schedule: {
    permission: "scheduling",
    module: "scheduling",
    fields: {
      work_date: 20,
      shift_name: 120,
      start_time: 20,
      end_time: 20,
      role: 120,
      employee_id: 120,
      employee_name: 160,
      rank: 100,
    },
  },
  preplan: {
    permission: "preplans",
    module: "preplans",
    fields: {
      business_name: 160,
      address: 240,
      construction_type: 120,
      floor_count: 10,
      access_info: 2000,
      alarm_system: 500,
      sprinkler_system: 500,
      fdc: 500,
    },
  },
  hydrant: {
    permission: "hydrants",
    module: "hydrants",
    fields: {
      hydrant_number: 120,
      address: 240,
      service_status: 80,
      manufacturer: 120,
      model: 120,
      notes: 2000,
    },
  },
  apparatus: {
    permission: "fleet",
    module: "fleet",
    fields: {
      name: 160,
      asset_type: 100,
      status: 40,
      vin: 17,
      manufacturer: 120,
      model: 120,
      year: 10,
      weekly_due_day: 2,
      maintenance_schedule: 5000,
      owner_manual_url: 1000,
      service_manual_url: 1000,
      parts_catalog_url: 1000,
      preferred_vendor: 240,
    },
  },
  inventory: {
    permission: "inventory",
    module: "inventory",
    fields: {
      name: 160,
      manufacturer: 120,
      model: 120,
      serial_number: 120,
      barcode: 120,
      quantity_required: 10,
      equipment_category: 120,
    },
  },
  duty: {
    permission: "duties",
    module: "duties",
    fields: {
      day_of_week: 1,
      shift_key: 100,
      duty: 3000,
      detail: 3000,
      category: 120,
      assigned_to: 160,
      due_time: 20,
      completed_date: 20,
    },
  },
  box_card: {
    permission: "documents",
    module: "documents",
    fields: {
      title: 200,
      address: 240,
      box_number: 100,
      access_notes: 3000,
      details: 5000,
    },
  },
  policy: {
    permission: "documents",
    module: "documents",
    fields: {
      title: 200,
      policy_number: 100,
      category: 100,
      effective_date: 20,
      body: 20000,
    },
  },
  phone: {
    permission: "phones",
    module: "phones",
    fields: {
      category: 100,
      name: 160,
      emergency_number: 80,
      non_emergency_number: 80,
      notes: 2000,
    },
  },
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: departmentId } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const form = await request.formData();
  const recordType = String(form.get("record_type") || "") as StickneyEditableRecordType;
  let recordId = String(form.get("record_id") || "")
    .trim()
    .slice(0, 120);
  const supportId = String(form.get("support_session_id") || "")
    .trim()
    .slice(0, 120);
  const definition = definitions[recordType];
  if (!definition || !recordId) return new Response("Invalid record", { status: 400 });
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });
  if (department.slug !== "stickney" && !["employee", "schedule"].includes(recordType)) return new Response("This source record type is not available for the department", { status: 404 });
  if (!(await canDepartmentPermission(user.userId, departmentId, definition.permission, supportId))) return new Response("This account cannot edit this area", { status: 403 });
  if (recordType === "employee" && recordId === "new") recordId = id("employee");
  if (recordType === "schedule" && recordId === "new") recordId = id("schedule");
  if (recordType === "apparatus" && recordId === "new") recordId = id("apparatus");
  if (recordType === "duty" && recordId === "new") recordId = id("duty");
  const data: Record<string, string | string[]> = Object.fromEntries(
    Object.entries(definition.fields).map(([field, max]) => [
      field,
      String(form.get(field) || "")
        .trim()
        .slice(0, max),
    ]),
  );
  if (recordType === "employee" && !data.name) return new Response("Employee name is required", { status: 400 });
  if (recordType === "employee") {
    const allowedRoles = new Set(["Officer", "Driver / Engineer", "Medic", "Firefighter", "Command", "Other"]);
    const roles = form
      .getAll("qualified_roles")
      .map(String)
      .filter((role) => allowedRoles.has(role));
    if (!roles.length) return new Response("Select at least one role the employee is able to work", { status: 400 });
    if (data.start_date && data.employment_end_date && String(data.employment_end_date) < String(data.start_date))
      return new Response("Last day of work cannot be before the start date", {
        status: 400,
      });
    data.qualified_roles = [...new Set(roles)];
  }
  if (recordType === "schedule") {
    const workDate = String(data.work_date || "");
    const employeeId = String(data.employee_id || "");
    const employees = department.slug === "stickney" ? await loadStickneyEmployees(departmentId) : await loadDepartmentEmployeeOverlays(departmentId);
    const employee = employees.find((item) => item.id === employeeId);
    if (!workDate || !employee)
      return new Response("Work date and employee are required", {
        status: 400,
      });
    if (!stickneyEmployeeActiveOn(employee, workDate)) return new Response("The employee is outside their employment dates for this assignment", { status: 400 });
    if (!stickneyEmployeeRoles(employee).includes(String(data.role || "")))
      return new Response("The employee is not marked able to work this role", {
        status: 400,
      });
    data.employee_name = employee.name;
    data.rank = employee.rank;
  }
  if (recordType === "apparatus" && !data.name) return new Response("Apparatus name is required", { status: 400 });
  if (recordType === "duty" && !data.duty) return new Response("Duty is required", { status: 400 });
  for (const field of ["schedule_sms_opt_in", "station_notify_email", "station_notify_text"]) data[field] = data[field] === "1" ? "1" : "0";
  if (recordType === "preplan") data.floor_count = String(Math.max(0, Math.min(200, Number(data.floor_count) || 0)));
  if (recordType === "duty") data.day_of_week = String(Math.max(0, Math.min(6, Number(data.day_of_week) || 0)));
  const at = now();
  await db().prepare("INSERT INTO stickney_record_overrides (id,department_id,record_type,source_record_id,data_json,status,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(department_id,record_type,source_record_id) DO UPDATE SET data_json=excluded.data_json,status='active',updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(id("override"), departmentId, recordType, recordId, JSON.stringify(data), "active", user.userId, user.userId, at, at).run();
  await audit(user.userId, departmentId, "stickney_record_edited", `${recordType.replaceAll("_", " ")} ${recordId} was edited in PrePlan 360. The original source record was preserved.`);
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${department.slug}?module=${definition.module}${support}`, request.url), 303);
}
