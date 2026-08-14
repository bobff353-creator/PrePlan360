import type { DepartmentScheduleRequest } from "@/db/access";
import {
  stickneyEmployeeActiveOn,
  stickneyEmployeeRoles,
  type StickneyEmployee,
  type StickneyScheduleAssignment,
} from "@/db/stickney";

type Props = {
  departmentId: string;
  employees: StickneyEmployee[];
  assignments: StickneyScheduleAssignment[];
  requests: DepartmentScheduleRequest[];
  selfEmployeeId: string;
  canManage: boolean;
  supportSessionId: string;
  today: string;
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function eligibleForTrade(employee: StickneyEmployee, assignment: StickneyScheduleAssignment) {
  return stickneyEmployeeActiveOn(employee, assignment.work_date) && stickneyEmployeeRoles(employee).includes(assignment.role);
}

function EmployeeField({ employees, selfEmployee, canManage }: { employees: StickneyEmployee[]; selfEmployee: StickneyEmployee | null; canManage: boolean }) {
  if (!canManage && selfEmployee) return <><input type="hidden" name="requester_employee_id" value={selfEmployee.id} /><strong className="schedule-request-self">{selfEmployee.name}</strong></>;
  return (
    <select required id="time-off-requester" name="requester_employee_id" defaultValue={selfEmployee?.id ?? ""}>
      <option value="" disabled>Select employee</option>
      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
    </select>
  );
}

export default function ScheduleRequestsWorkspace({ departmentId, employees, assignments, requests, selfEmployeeId, canManage, supportSessionId, today }: Props) {
  const selfEmployee = employees.find((employee) => employee.id === selfEmployeeId) ?? null;
  const canSubmit = canManage || Boolean(selfEmployee);
  const visibleAssignments = assignments.filter((assignment) => assignment.work_date >= today && (canManage || assignment.employee_id === selfEmployeeId));
  const visibleRequests = canManage
    ? requests
    : requests.filter((record) => record.requester_employee_id === selfEmployeeId || record.target_employee_id === selfEmployeeId || (record.request_kind === "trade" && record.target_scope === "department" && record.status === "open"));
  const action = `/api/departments/${departmentId}/schedule-requests`;
  const hidden = <input type="hidden" name="support_session_id" value={supportSessionId} />;

  return (
    <section className="schedule-requests-workspace" aria-label="Schedule requests and trades">
      <header>
        <div>
          <span>EMPLOYEE ACTIONS</span>
          <h2>Time off and shift trades</h2>
          <p>Employees can submit their own requests when their signed-in email matches the department roster. Scheduling-authorized members can submit or review on behalf of the department.</p>
        </div>
        <strong>{visibleRequests.filter((request) => ["pending", "open", "awaiting_acceptance", "pending_approval"].includes(request.status)).length} open</strong>
      </header>
      {canSubmit ? (
        <div className="schedule-request-actions">
          <details>
            <summary>Request time off</summary>
            <form method="post" action={action}>
              <input type="hidden" name="action" value="create_time_off" />
              {hidden}
              {canManage ? <label htmlFor="time-off-requester">Employee<EmployeeField employees={employees} selfEmployee={selfEmployee} canManage={canManage} /></label> : <div className="schedule-request-employee"><span>Employee</span><EmployeeField employees={employees} selfEmployee={selfEmployee} canManage={canManage} /></div>}
              <label>Type<select name="leave_type" defaultValue="Vacation"><option>Vacation</option><option>Sick</option><option>Floating</option><option>Recovery</option><option>Other</option></select></label>
              <label>First day<input required type="date" name="start_date" min={today} /></label>
              <label>Last day<input required type="date" name="end_date" min={today} /></label>
              <label>Hours<input required type="number" name="hours" min="1" max="720" defaultValue="24" /></label>
              <label className="wide">Reason or note<textarea name="note" rows={3} maxLength={2000} /></label>
              <button type="submit">Submit time-off request</button>
            </form>
          </details>
          <details>
            <summary>Request a shift trade</summary>
            <form method="post" action={action}>
              <input type="hidden" name="action" value="create_trade" />
              {hidden}
              <label className="wide">Your assigned shift<select required name="assignment_id" defaultValue=""><option value="" disabled>Select an upcoming assignment</option>{visibleAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.work_date} - {assignment.shift_name} - {assignment.employee_name} - {assignment.role}</option>)}</select></label>
              <label>Offer to<select name="target_scope" defaultValue="employee"><option value="employee">One employee</option><option value="department">Anyone eligible</option></select></label>
              <label>Employee<select name="target_employee_id" defaultValue=""><option value="">Select if offering directly</option>{employees.filter((employee) => employee.id !== selfEmployeeId).map((employee) => <option key={employee.id} value={employee.id}>{employee.name} - {stickneyEmployeeRoles(employee).join(", ")}</option>)}</select></label>
              <label className="wide">Trade note<textarea name="note" rows={3} maxLength={2000} /></label>
              <button type="submit">Send trade request</button>
            </form>
          </details>
        </div>
      ) : (
        <p className="schedule-request-truth">Your sign-in is not matched to an employee email in this roster. Ask a department administrator to connect the record before using employee self-service.</p>
      )}
      <div className="schedule-request-records">
        {visibleRequests.length ? visibleRequests.map((record) => {
          const assignment = assignments.find((row) => row.id === record.assignment_id);
          const selfCanAccept = Boolean(selfEmployee && assignment && selfEmployee.id !== record.requester_employee_id && eligibleForTrade(selfEmployee, assignment) && (record.target_scope === "department" || record.target_employee_id === selfEmployee.id));
          const eligibleAcceptors = assignment ? employees.filter((employee) => employee.id !== record.requester_employee_id && eligibleForTrade(employee, assignment)) : [];
          const canAccept = record.request_kind === "trade" && ["open", "awaiting_acceptance"].includes(record.status) && (canManage || selfCanAccept);
          const canReview = canManage && (record.request_kind === "time_off" ? record.status === "pending" : record.status === "pending_approval");
          return (
            <article key={record.id} className={`schedule-request-record ${record.request_kind}`}>
              <header><div><span>{record.request_kind === "time_off" ? record.leave_type : `${record.role} trade`}</span><h3>{record.requester_name}</h3></div><b className={`status-${record.status}`}>{statusLabel(record.status)}</b></header>
              <p>{record.start_date}{record.end_date !== record.start_date ? ` through ${record.end_date}` : ""}{record.hours ? ` - ${record.hours} hours` : ""}</p>
              {record.request_kind === "trade" ? <p>Offered to: {record.target_name || "Department eligible pool"}</p> : null}
              {record.note ? <small>{record.note}</small> : null}
              {canAccept ? <form method="post" action={action} className="schedule-request-review"><input type="hidden" name="request_id" value={record.id} />{hidden}{canManage ? <select required name="accepting_employee_id" defaultValue={record.target_employee_id}>{eligibleAcceptors.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select> : <input type="hidden" name="accepting_employee_id" value={selfEmployeeId} />}<button type="submit" name="action" value="accept_trade">Accept trade</button>{record.target_scope === "employee" ? <button type="submit" name="action" value="decline_trade" className="danger">Decline</button> : null}</form> : null}
              {canReview ? <form method="post" action={action} className="schedule-request-review"><input type="hidden" name="request_id" value={record.id} />{hidden}<button type="submit" name="action" value="approve">Approve</button><button type="submit" name="action" value="deny" className="danger">Deny</button></form> : null}
            </article>
          );
        }) : <p className="schedule-request-truth">No time-off or trade requests are recorded for this view.</p>}
      </div>
    </section>
  );
}
