import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isSameOriginRequest } from "@/app/owner-auth";
import {
  audit,
  canAccessDepartment,
  canDepartmentPermission,
  db,
  getDepartment,
  getDepartmentScheduleRequest,
  id,
  now,
} from "@/db/access";
import {
  loadDepartmentEmployeeOverlays,
  loadDepartmentScheduleOverlays,
  loadStickneyEmployees,
  loadStickneyModule,
  stickneyEmployeeActiveOn,
  stickneyEmployeeRoles,
  type StickneyEmployee,
  type StickneyScheduleAssignment,
} from "@/db/stickney";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const leaveTypes = new Set(["Vacation", "Sick", "Floating", "Recovery", "Other"]);

function text(form: FormData, key: string, max = 500) {
  return String(form.get(key) || "").trim().slice(0, max);
}

function employeeByEmail(employees: StickneyEmployee[], email: string) {
  const normalized = email.trim().toLowerCase();
  return employees.find((employee) => employee.email.trim().toLowerCase() === normalized) || null;
}

async function schedulingData(departmentId: string, slug: string) {
  if (slug === "stickney") {
    const [employees, moduleData] = await Promise.all([
      loadStickneyEmployees(departmentId),
      loadStickneyModule("scheduling", departmentId),
    ]);
    return { employees, assignments: moduleData.schedule ?? [] };
  }
  const [employees, assignments] = await Promise.all([
    loadDepartmentEmployeeOverlays(departmentId),
    loadDepartmentScheduleOverlays(departmentId),
  ]);
  return { employees, assignments };
}

function validTradeTarget(employee: StickneyEmployee, assignment: StickneyScheduleAssignment) {
  return stickneyEmployeeActiveOn(employee, assignment.work_date) && stickneyEmployeeRoles(employee).includes(assignment.role);
}

function redirectToSchedule(request: Request, slug: string, supportId: string) {
  const support = supportId ? `&support=${encodeURIComponent(supportId)}` : "";
  return Response.redirect(new URL(`/d/${slug}?module=scheduling${support}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return new Response("Invalid request origin", { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { id: departmentId } = await params;
  const department = await getDepartment(departmentId);
  if (!department) return new Response("Department not found", { status: 404 });
  if (!(await canAccessDepartment(user.userId, departmentId))) return new Response("Department access required", { status: 403 });

  const form = await request.formData();
  const action = text(form, "action", 40);
  const supportId = text(form, "support_session_id", 120);
  const canManage = await canDepartmentPermission(user.userId, departmentId, "scheduling", supportId);
  const { employees, assignments } = await schedulingData(departmentId, department.slug);
  const selfEmployee = employeeByEmail(employees, user.email);
  const at = now();

  if (action === "create_time_off") {
    const requester = employees.find((employee) => employee.id === text(form, "requester_employee_id", 120));
    const startDate = text(form, "start_date", 10);
    const endDate = text(form, "end_date", 10) || startDate;
    const leaveType = text(form, "leave_type", 40);
    const hours = Math.max(1, Math.min(720, Math.round(Number(text(form, "hours", 5)) || 0)));
    if (!requester || (!canManage && selfEmployee?.id !== requester.id)) return new Response("This account cannot submit for that employee", { status: 403 });
    if (!datePattern.test(startDate) || !datePattern.test(endDate) || endDate < startDate) return new Response("Enter a valid time-off date range", { status: 400 });
    if (!stickneyEmployeeActiveOn(requester, startDate) || !stickneyEmployeeActiveOn(requester, endDate)) return new Response("The request is outside the employee's employment dates", { status: 400 });
    if (!leaveTypes.has(leaveType)) return new Response("Select a valid time-off type", { status: 400 });
    await db().prepare("INSERT INTO department_schedule_requests (id,department_id,request_kind,requester_employee_id,requester_name,assignment_id,target_scope,target_employee_id,target_name,start_date,end_date,hours,leave_type,role,note,status,created_by,accepted_by,reviewed_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id("schedule_request"), departmentId, "time_off", requester.id, requester.name, "", "employee", "", "", startDate, endDate, hours, leaveType, "", text(form, "note", 2000), "pending", user.userId, null, null, at, at).run();
    await audit(user.userId, departmentId, "schedule_time_off_requested", `${requester.name} requested ${leaveType.toLowerCase()} time from ${startDate} through ${endDate}.`);
    return redirectToSchedule(request, department.slug, supportId);
  }

  if (action === "create_trade") {
    const assignment = assignments.find((row) => row.id === text(form, "assignment_id", 120));
    const requester = employees.find((employee) => employee.id === assignment?.employee_id);
    const targetScope = text(form, "target_scope", 20) === "department" ? "department" : "employee";
    const target = targetScope === "employee" ? employees.find((employee) => employee.id === text(form, "target_employee_id", 120)) : null;
    if (!requester || (!canManage && selfEmployee?.id !== requester.id)) return new Response("This account cannot request a trade for that employee", { status: 403 });
    if (!assignment || assignment.employee_id !== requester.id) return new Response("Select one of the requester's assigned shifts", { status: 400 });
    if (targetScope === "employee" && (!target || target.id === requester.id || !validTradeTarget(target, assignment))) return new Response("Select another employee qualified for this assignment", { status: 400 });
    await db().prepare("INSERT INTO department_schedule_requests (id,department_id,request_kind,requester_employee_id,requester_name,assignment_id,target_scope,target_employee_id,target_name,start_date,end_date,hours,leave_type,role,note,status,created_by,accepted_by,reviewed_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id("schedule_trade"), departmentId, "trade", requester.id, requester.name, assignment.id, targetScope, target?.id ?? "", target?.name ?? "Department eligible pool", assignment.work_date, assignment.work_date, 0, "", assignment.role, text(form, "note", 2000), targetScope === "employee" ? "awaiting_acceptance" : "open", user.userId, null, null, at, at).run();
    await audit(user.userId, departmentId, "schedule_trade_requested", `${requester.name} requested a ${assignment.role} trade for ${assignment.work_date} with ${target?.name ?? "any eligible department member"}.`);
    return redirectToSchedule(request, department.slug, supportId);
  }

  const record = await getDepartmentScheduleRequest(departmentId, text(form, "request_id", 120));
  if (!record) return new Response("Schedule request not found", { status: 404 });

  if (action === "accept_trade") {
    if (record.request_kind !== "trade" || !["open", "awaiting_acceptance"].includes(record.status)) return new Response("This trade is not available for acceptance", { status: 409 });
    const assignment = assignments.find((row) => row.id === record.assignment_id);
    const accepting = employees.find((employee) => employee.id === text(form, "accepting_employee_id", 120));
    if (!assignment || !accepting || accepting.id === record.requester_employee_id || !validTradeTarget(accepting, assignment)) return new Response("The selected employee is not eligible for this assignment", { status: 400 });
    if (record.target_scope === "employee" && record.target_employee_id !== accepting.id) return new Response("This trade was offered to another employee", { status: 403 });
    if (!canManage && selfEmployee?.id !== accepting.id) return new Response("Only the receiving employee may accept this trade", { status: 403 });
    await db().prepare("UPDATE department_schedule_requests SET target_employee_id=?,target_name=?,status='pending_approval',accepted_by=?,updated_at=? WHERE department_id=? AND id=?").bind(accepting.id, accepting.name, user.userId, at, departmentId, record.id).run();
    await audit(user.userId, departmentId, "schedule_trade_accepted", `${accepting.name} accepted the ${record.role} trade for ${record.start_date}; scheduling approval is still required.`);
    return redirectToSchedule(request, department.slug, supportId);
  }

  if (action === "decline_trade") {
    if (record.request_kind !== "trade" || record.status !== "awaiting_acceptance") return new Response("This trade cannot be declined", { status: 409 });
    if (!canManage && selfEmployee?.id !== record.target_employee_id) return new Response("Only the receiving employee may decline this trade", { status: 403 });
    await db().prepare("UPDATE department_schedule_requests SET status='declined',reviewed_by=?,updated_at=? WHERE department_id=? AND id=?").bind(user.userId, at, departmentId, record.id).run();
    await audit(user.userId, departmentId, "schedule_trade_declined", `${record.target_name} declined the ${record.role} trade for ${record.start_date}.`);
    return redirectToSchedule(request, department.slug, supportId);
  }

  if (action === "approve" || action === "deny") {
    if (!canManage) return new Response("Scheduling approval permission required", { status: 403 });
    const status = action === "approve" ? "approved" : "denied";
    if (record.request_kind === "trade" && action === "approve") {
      if (record.status !== "pending_approval") return new Response("The receiving employee must accept before approval", { status: 409 });
      const assignment = assignments.find((row) => row.id === record.assignment_id);
      const receiver = employees.find((employee) => employee.id === record.target_employee_id);
      if (!assignment || !receiver || !validTradeTarget(receiver, assignment)) return new Response("The accepted trade is no longer eligible", { status: 409 });
      const replacement = { ...assignment, employee_id: receiver.id, employee_name: receiver.name, rank: receiver.rank };
      await db().batch([
        db().prepare("UPDATE department_schedule_requests SET status='approved',reviewed_by=?,updated_at=? WHERE department_id=? AND id=?").bind(user.userId, at, departmentId, record.id),
        db().prepare("INSERT INTO stickney_record_overrides (id,department_id,record_type,source_record_id,data_json,status,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(department_id,record_type,source_record_id) DO UPDATE SET data_json=excluded.data_json,status='active',updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(id("override"), departmentId, "schedule", assignment.id, JSON.stringify(replacement), "active", user.userId, user.userId, at, at),
      ]);
      await audit(user.userId, departmentId, "schedule_trade_approved", `${record.requester_name}'s ${record.role} assignment on ${record.start_date} was reassigned to ${receiver.name}. The source assignment was preserved.`);
      return redirectToSchedule(request, department.slug, supportId);
    }
    if (record.request_kind === "trade" && !["open", "awaiting_acceptance", "pending_approval"].includes(record.status)) return new Response("This trade is already closed", { status: 409 });
    if (record.request_kind === "time_off" && record.status !== "pending") return new Response("This request is already closed", { status: 409 });
    await db().prepare("UPDATE department_schedule_requests SET status=?,reviewed_by=?,updated_at=? WHERE department_id=? AND id=?").bind(status, user.userId, at, departmentId, record.id).run();
    await audit(user.userId, departmentId, record.request_kind === "trade" ? "schedule_trade_reviewed" : "schedule_time_off_reviewed", `${record.requester_name}'s ${record.request_kind.replaceAll("_", " ")} request was ${status}.`);
    return redirectToSchedule(request, department.slug, supportId);
  }

  return new Response("Unsupported schedule request action", { status: 400 });
}
