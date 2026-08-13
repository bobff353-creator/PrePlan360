"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { StickneyEmployee } from "@/db/stickney";

type Props = {
  departmentId: string;
  employees: StickneyEmployee[];
  editable: boolean;
  supportSessionId: string;
};
type Tab = "employees" | "shifts" | "alerts";

// Keep this qualification list synchronized with the demo roster foundation.
const WORK_ROLES = ["Officer", "Driver / Engineer", "Medic", "Firefighter", "Command", "Other"] as const;
const present = (value: string | null | undefined, fallback = "Not entered") => value?.trim() || fallback;
const initials = (name: string) =>
  name
    .split(/[,\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const enabled = (value: number | string) => Number(value) === 1;
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const activeOn = (employee: StickneyEmployee, date = localDate()) => (!employee.start_date || employee.start_date <= date) && (!employee.employment_end_date || date <= employee.employment_end_date);
const rolesFor = (employee: StickneyEmployee | null) => {
  if (employee?.qualified_roles?.length) return employee.qualified_roles.filter((role) => WORK_ROLES.includes(role as (typeof WORK_ROLES)[number]));
  const text = `${employee?.rank ?? ""} ${employee?.station_role ?? ""} ${employee?.driver_status ?? ""}`;
  const roles: string[] = [];
  if (/chief|captain|lieutenant|officer/i.test(text)) roles.push("Officer");
  if (/engineer|driver|pump/i.test(text)) roles.push("Driver / Engineer");
  if (/paramedic|emt-p|medic/i.test(text)) roles.push("Medic");
  if (/firefighter|ff\b/i.test(text)) roles.push("Firefighter");
  if (/chief|command/i.test(text)) roles.push("Command");
  return roles.length ? [...new Set(roles)] : ["Firefighter"];
};

export default function StaffingWorkspace({ departmentId, employees, editable, supportSessionId }: Props) {
  const [tab, setTab] = useState<Tab>("employees");
  const [search, setSearch] = useState("");
  const [shift, setShift] = useState("all");
  const [reviewing, setReviewing] = useState(false);
  const activeEmployees = useMemo(() => employees.filter((employee) => activeOn(employee)), [employees]);
  const shifts = useMemo(() => [...new Set(activeEmployees.map((employee) => employee.home_shift).filter(Boolean))].sort(), [activeEmployees]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => (shift === "all" || present(employee.home_shift, "Unassigned") === shift) && (!query || [employee.name, employee.rank, employee.station_role, employee.home_shift, employee.employee_number, ...rolesFor(employee)].join(" ").toLowerCase().includes(query)));
  }, [employees, search, shift]);
  const missingContact = activeEmployees.filter((employee) => !employee.phone && !employee.email).length;
  const assigned = activeEmployees.filter((employee) => employee.home_shift).length;

  return (
    <section className="staffing-foundation">
      <div className="staffing-source">
        <div>
          <i />
          <span>
            <b>Live Stickney personnel workspace</b>
            <small>Real department records with audited edits saved only in this build</small>
          </span>
        </div>
        <strong>Source preserved</strong>
      </div>
      <div className="staffing-kpis">
        <article>
          <span>Active employees</span>
          <b>{activeEmployees.length}</b>
          <small>Inside employment dates today</small>
        </article>
        <article className={missingContact ? "warning" : ""}>
          <span>Missing phone + email</span>
          <b>{missingContact}</b>
          <small>Active employee contact readiness</small>
        </article>
        <article>
          <span>Home shift assigned</span>
          <b>{assigned}</b>
          <small>{activeEmployees.length - assigned} active and unassigned</small>
        </article>
        <article>
          <span>Ended employment</span>
          <b>{employees.length - activeEmployees.length}</b>
          <small>History retained; future staffing excluded</small>
        </article>
      </div>
      <div className="staffing-tabs" role="tablist" aria-label="Roster workspace views">
        <button className={tab === "employees" ? "active" : ""} onClick={() => setTab("employees")}>
          Employees
        </button>
        <button className={tab === "shifts" ? "active" : ""} onClick={() => setTab("shifts")}>
          Shift assignments
        </button>
        <button className={tab === "alerts" ? "active" : ""} onClick={() => setTab("alerts")}>
          Email & text alerts
        </button>
      </div>
      {tab === "employees" ? (
        <>
          <div className="staffing-toolbar">
            <div>
              <input aria-label="Search employees" placeholder="Search employee, rank, shift, or role…" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select aria-label="Filter by shift" value={shift} onChange={(event) => setShift(event.target.value)}>
                <option value="all">All shifts</option>
                {shifts.map((item) => (
                  <option key={item}>{item}</option>
                ))}
                <option>Unassigned</option>
              </select>
            </div>
            {editable ? (
              <details className="staffing-add">
                <summary>Add employee</summary>
                <EmployeeForm departmentId={departmentId} employee={null} supportSessionId={supportSessionId} />
              </details>
            ) : null}
          </div>
          <div className="staffing-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Rank / assignment</th>
                  <th>Home shift</th>
                  <th>Roles able to work</th>
                  <th>Employment</th>
                  <th>Status</th>
                  {editable ? <th>Edit</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => {
                  const active = activeOn(employee);
                  return (
                    <tr key={employee.id}>
                      <td>
                        <div className="staffing-name">
                          {employee.photo_updated_at ? <Image unoptimized width={36} height={36} src={`/api/departments/${departmentId}/stickney-photo/${employee.id}?v=${encodeURIComponent(employee.photo_updated_at)}`} alt={`${employee.name} profile`} /> : <span>{initials(employee.name)}</span>}
                          <div>
                            <b>{employee.name}</b>
                            <small>{present(employee.employee_number, "Employee ID not entered")}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <b>{present(employee.rank)}</b>
                        <small>{present(employee.station_role, "Assignment needed")}</small>
                      </td>
                      <td>
                        <em className={employee.home_shift ? "ready" : "warning"}>{present(employee.home_shift, "Unassigned")}</em>
                      </td>
                      <td>
                        <div className="staffing-role-tags">
                          {rolesFor(employee).map((role) => (
                            <span key={role}>{role}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <b>{present(employee.employment_type)}</b>
                        <small>{employee.employment_end_date ? `Last day ${employee.employment_end_date}` : "No end date"}</small>
                      </td>
                      <td>
                        <em className={active ? "ready" : "warning"}>{active ? "Active" : "Ended"}</em>
                      </td>
                      {editable ? (
                        <td>
                          <details className="staffing-edit">
                            <summary>Edit</summary>
                            <EmployeeForm departmentId={departmentId} employee={employee} supportSessionId={supportSessionId} />
                          </details>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length ? null : <div className="staffing-no-results">No employees match these filters.</div>}
          </div>
        </>
      ) : null}
      {tab === "shifts" ? (
        <div className="staffing-shifts">
          {[...shifts, "Unassigned"].map((item) => {
            const members = activeEmployees.filter((employee) => present(employee.home_shift, "Unassigned") === item);
            const officers = members.filter((employee) => rolesFor(employee).some((role) => role === "Officer" || role === "Command")).length;
            const medics = members.filter((employee) => rolesFor(employee).includes("Medic")).length;
            const drivers = members.filter((employee) => rolesFor(employee).includes("Driver / Engineer")).length;
            return (
              <article key={item}>
                <header>
                  <div>
                    <h3>{item}</h3>
                    <small>Active home-shift assignment</small>
                  </div>
                  <em className={members.length >= 7 ? "ready" : "warning"}>{members.length} / 7</em>
                </header>
                <div className="staffing-coverage">
                  <span>
                    Minimum<b>{members.length} / 7</b>
                  </span>
                  <span>
                    Officer<b>{officers} / 1</b>
                  </span>
                  <span>
                    Paramedic<b>{medics} / 1</b>
                  </span>
                  <span>
                    Driver<b>{drivers} / 1</b>
                  </span>
                </div>
                {members.length ? (
                  members.map((employee) => (
                    <div className="staffing-shift-member" key={employee.id}>
                      <span>{initials(employee.name)}</span>
                      <div>
                        <b>{employee.name}</b>
                        <small>{employee.rank}</small>
                      </div>
                      <em>{rolesFor(employee).join(" · ")}</em>
                      {editable ? (
                        <details className="staffing-edit">
                          <summary>Edit</summary>
                          <EmployeeForm departmentId={departmentId} employee={employee} supportSessionId={supportSessionId} />
                        </details>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p>No active employees assigned.</p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
      {tab === "alerts" ? (
        <div className="staffing-alerts">
          <section>
            <h3>Alert composer</h3>
            <div className="staffing-alert-form">
              <label>
                Audience
                <select>
                  <option>All active employees</option>
                  {shifts.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Channel
                <select>
                  <option>Email + text where enabled</option>
                  <option>Text only</option>
                  <option>Email only</option>
                </select>
              </label>
              <label>
                Alert type
                <select>
                  <option>Emergency staffing</option>
                  <option>Schedule change</option>
                  <option>Open shift / overtime</option>
                  <option>General notice</option>
                </select>
              </label>
              <label className="wide">
                Message
                <textarea rows={4} placeholder="Write the alert. Do not include protected medical or disciplinary information." />
              </label>
            </div>
            <button onClick={() => setReviewing(true)}>Review recipients</button>
            {reviewing ? (
              <div className="staffing-review">
                <b>No message sent</b>
                <span>{activeEmployees.filter((employee) => (employee.phone && enabled(employee.station_notify_text)) || (employee.email && enabled(employee.station_notify_email))).length} active employees have at least one enabled delivery method. A delivery provider is not connected.</span>
              </div>
            ) : null}
          </section>
          <aside>
            <h3>Delivery readiness</h3>
            <div>
              <b>
                <i />
                Email provider not connected
              </b>
              <small>
                {activeEmployees.filter((employee) => employee.email && enabled(employee.station_notify_email)).length} of {activeEmployees.length} active employees have email alerts enabled.
              </small>
            </div>
            <div>
              <b>
                <i />
                Text provider not connected
              </b>
              <small>
                {activeEmployees.filter((employee) => employee.phone && enabled(employee.station_notify_text)).length} of {activeEmployees.length} active employees have text alerts enabled.
              </small>
            </div>
          </aside>
        </div>
      ) : null}
      <p className="staffing-footer">The original Stickney Firehouse Manager records are never deleted or overwritten here. Last-day and role changes are audited PrePlan 360 overlays. Ended employees leave future staffing and new payroll selection while historical records remain intact.</p>
    </section>
  );
}

function EmployeeForm({ departmentId, employee, supportSessionId }: { departmentId: string; employee: StickneyEmployee | null; supportSessionId: string }) {
  const field = (name: keyof StickneyEmployee, label: string, type = "text") => (
    <label>
      {label}
      <input name={name} type={type} defaultValue={String(employee?.[name] ?? "")} />
    </label>
  );
  const selectedRoles = rolesFor(employee);
  return (
    <form className="staffing-form" method="post" action={`/api/departments/${departmentId}/stickney-records`}>
      <input type="hidden" name="record_type" value="employee" />
      <input type="hidden" name="record_id" value={employee?.id ?? "new"} />
      <input type="hidden" name="support_session_id" value={supportSessionId} />
      {field("name", "Display name")}
      {field("employee_number", "Employee / payroll ID")}
      {field("rank", "Rank / title")}
      {field("station_role", "Operational role")}
      {field("home_shift", "Home shift")}
      {field("employment_type", "Employment type")}
      {field("driver_status", "Driver status")}
      {field("start_date", "Start date", "date")}
      {field("employment_end_date", "Last day of work", "date")}
      <label className="wide">
        Roles able to work
        <select name="qualified_roles" multiple size={Math.min(WORK_ROLES.length, 6)} defaultValue={selectedRoles}>
          {WORK_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <small>Choose every schedule role this employee is qualified to fill.</small>
      </label>
      {field("phone", "Mobile phone", "tel")}
      {field("email", "Email address", "email")}
      {field("emergency_name", "Emergency contact name")}
      {field("emergency_relationship", "Relationship")}
      {field("emergency_phone", "Emergency contact phone", "tel")}
      <label className="wide">
        Administrative notes
        <textarea name="notes" rows={3} defaultValue={employee?.notes ?? ""} />
      </label>
      <fieldset className="wide">
        <legend>Notification preferences</legend>
        <label>
          <input name="station_notify_text" type="checkbox" value="1" defaultChecked={enabled(employee?.station_notify_text ?? 0)} />
          Text alerts
        </label>
        <label>
          <input name="station_notify_email" type="checkbox" value="1" defaultChecked={enabled(employee?.station_notify_email ?? 0)} />
          Email alerts
        </label>
        <label>
          <input name="schedule_sms_opt_in" type="checkbox" value="1" defaultChecked={enabled(employee?.schedule_sms_opt_in ?? 0)} />
          Schedule text opt-in
        </label>
      </fieldset>
      <p className="staffing-form-note wide">The last day is still a valid work day. Later schedule dates and new pay periods exclude this employee; saved history is preserved.</p>
      <button type="submit">{employee ? "Save employee" : "Add employee"}</button>
    </form>
  );
}
