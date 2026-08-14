/* eslint-disable @next/next/no-img-element -- protected operational images are streamed by authenticated API routes */
import { STICKNEY_WORK_ROLES, stickneyEmployeeActiveOn, stickneyEmployeeRoles, type StickneyEmployee, type StickneyModuleData, type StickneyScheduleAssignment } from "@/db/stickney";
import type { DepartmentSourcePresentation } from "@/db/department-source";
import type { DepartmentScheduleRequest } from "@/db/access";
import StaffingWorkspace from "./staffing-workspace";
import FleetWorkspace from "./fleet-workspace";
import DailyDutiesWorkspace from "./daily-duties-workspace";
import PreplanMap from "./preplan-map";
import ScheduleCalendar from "./schedule-calendar";
import DocumentsWorkspace from "./documents-workspace";
import ScheduleRequestsWorkspace from "./schedule-requests-workspace";

type Props = {
  module: string;
  departmentId: string;
  departmentSlug: string;
  source: DepartmentSourcePresentation;
  data: StickneyModuleData;
  minimumStaffing: number;
  scheduleRequests: DepartmentScheduleRequest[];
  selfEmployeeId: string;
  editable: boolean;
  supportSessionId?: string;
  connectionError?: string;
  inventoryQuery?: string;
  inventoryUnit?: string;
  inventoryPage?: string;
  inventoryPhotoPage?: string;
};

function SourceNotice({ source, inherited = false }: { source: DepartmentSourcePresentation; inherited?: boolean }) {
  return (
    <div className="stickney-source-notice">
      <b>{inherited ? "Department foundation records" : source.recordsLabel}</b>
      <span>{inherited ? "Audited personnel and schedule records saved inside this department build." : source.recordsDescription}</span>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="stickney-empty">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "Date not entered";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

const scheduleColors = [["#8b1e24", "Deep red"], ["#111318", "Black"], ["#c89b2c", "Gold"], ["#2569bd", "Blue"], ["#d96b22", "Orange"]] as const;

function scheduleColor(name: string, saved?: string) {
  if (scheduleColors.some(([value]) => value === saved?.toLowerCase())) return saved!.toLowerCase();
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return scheduleColors[hash % scheduleColors.length][0];
}

function chicagoDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function stickneyFootprint(value?: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng)).map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })) : [];
  } catch {
    return [];
  }
}

function EditableRecord({
  departmentId,
  recordType,
  recordId,
  fields,
  editable,
  supportSessionId,
}: {
  departmentId: string;
  recordType: string;
  recordId: string;
  fields: Array<{
    name: string;
    label: string;
    value: string | number | null | undefined;
    multiline?: boolean;
  }>;
  editable: boolean;
  supportSessionId: string;
}) {
  if (!editable) return null;
  return (
    <details className="stickney-record-editor">
      <summary>Edit this record</summary>
      <form method="post" action={`/api/departments/${departmentId}/stickney-records`}>
        <input type="hidden" name="record_type" value={recordType} />
        <input type="hidden" name="record_id" value={recordId} />
        <input type="hidden" name="support_session_id" value={supportSessionId} />
        {fields.map((field) => (
          <label key={field.name}>
            {field.label}
            {field.multiline ? <textarea name={field.name} defaultValue={String(field.value ?? "")} rows={3} /> : <input name={field.name} defaultValue={String(field.value ?? "")} />}
          </label>
        ))}
        <button type="submit">Save change</button>
      </form>
    </details>
  );
}

export default function StickneyWorkspace({ module, departmentId, departmentSlug, source, data, minimumStaffing, scheduleRequests, selfEmployeeId, editable, supportSessionId = "", connectionError, inventoryQuery = "", inventoryUnit = "", inventoryPage = "1", inventoryPhotoPage = "1" }: Props) {
  if (connectionError) {
    return (
      <section className="stickney-panel">
        <SourceNotice source={source} />
        <Empty title={`${source.name} connection unavailable`} text={connectionError} />
      </section>
    );
  }
  if (module === "dashboard" && data.summary) return <StickneyDashboard source={source} data={data} />;
  if (module === "staffing") return <Staffing source={source} departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} />;
  if (module === "scheduling") return <Schedule source={source} departmentId={departmentId} data={data} minimumStaffing={minimumStaffing} requests={scheduleRequests} selfEmployeeId={selfEmployeeId} editable={editable} supportSessionId={supportSessionId} />;
  if (module === "preplans") return <Preplans source={source} departmentId={departmentId} departmentSlug={departmentSlug} data={data} editable={editable} supportSessionId={supportSessionId} />;
  if (module === "hydrants") return <Hydrants source={source} departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} />;
  if (module === "fleet") return <Fleet source={source} departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} />;
  if (module === "inventory") return <Inventory source={source} departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} query={inventoryQuery} selectedUnit={inventoryUnit} requestedPage={inventoryPage} requestedPhotoPage={inventoryPhotoPage} />;
  if (module === "duties") return <Duties source={source} departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} />;
  if (module === "documents") return <Documents source={source} departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} />;
  if (module === "phones") return <Phones source={source} departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} />;
  return (
    <section className="stickney-panel">
      <SourceNotice source={source} />
      <Empty title={`No ${source.name} reader for this module`} text="This module remains in its existing PrePlan 360 state." />
    </section>
  );
}

function StickneyDashboard({ source, data }: { source: DepartmentSourcePresentation; data: StickneyModuleData }) {
  const summary = data.summary!;
  const cards = [
    ["Personnel", summary.employees, "Active employees", "staffing"],
    ["Schedule", summary.schedule_assignments, "Saved filled assignments", "scheduling"],
    ["Preplans", summary.preplans + summary.preplan_imports, `${summary.preplans} built · ${summary.preplan_imports} imported`, "preplans"],
    ["Apparatus", summary.apparatus, "Connected inventory profiles", "fleet"],
    ["Inventory", summary.inventory_items, `${summary.inventory_photos} private photo records`, "inventory"],
    ["Daily duties", summary.duties, "Recurring duty records", "duties"],
    ["Documents", summary.box_cards + summary.policies, `${summary.box_cards} box cards · ${summary.policies} policies`, "documents"],
    ["Phone numbers", summary.phone_numbers, "Important contacts", "phones"],
  ] as const;
  return (
    <section className="stickney-panel">
      <SourceNotice source={source} />
      <div className="stickney-metric-grid">
        {cards.map(([label, count, detail, link]) => (
          <a href={`?module=${link}`} key={label}>
            <span>{label}</span>
            <b>{Number(count).toLocaleString()}</b>
            <small>{detail}</small>
          </a>
        ))}
      </div>
      <div className="stickney-integrity">
        <b>Source preserved</b>
        <p>This department reads only its own protected source adapter. No records are removed from {source.systemName}, and other departments cannot load this data.</p>
      </div>
    </section>
  );
}

function Staffing({ source, departmentId, data, editable, supportSessionId }: { source: DepartmentSourcePresentation; departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const employees = data.employees ?? [];
  return <StaffingWorkspace departmentId={departmentId} employees={employees} sourceName={source.name} sourceSystem={source.systemName} employeePhotoRoute={source.employeePhotoRoute} editable={editable} supportSessionId={supportSessionId} />;
}

function ScheduleForm({ departmentId, supportSessionId, employees, assignment }: { departmentId: string; supportSessionId: string; employees: StickneyEmployee[]; assignment?: StickneyScheduleAssignment }) {
  // The API rechecks both the employment date and selected qualified role before saving.
  const eligibleEmployees = employees.filter((employee) => !assignment || employee.id === assignment.employee_id || stickneyEmployeeActiveOn(employee, assignment.work_date));
  return (
    <details className="stickney-record-editor">
      <summary>{assignment ? "Edit this assignment" : "Add schedule assignment"}</summary>
      <form method="post" action={`/api/departments/${departmentId}/stickney-records`}>
        <input type="hidden" name="record_type" value="schedule" />
        <input type="hidden" name="record_id" value={assignment?.id ?? "new"} />
        <input type="hidden" name="support_session_id" value={supportSessionId} />
        <label>
          Work date
          <input required name="work_date" type="date" defaultValue={assignment?.work_date ?? ""} />
        </label>
        <label>
          Shift
          <input required name="shift_name" defaultValue={assignment?.shift_name ?? "24-Hour Tour"} />
        </label>
        <label className="schedule-color-field">
          Shift color
          <select name="shift_color" defaultValue={scheduleColor(assignment?.shift_name ?? "24-Hour Tour", assignment?.shift_color)}>
            {scheduleColors.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Start time
          <input required name="start_time" type="time" defaultValue={assignment?.start_time ?? "07:00"} />
        </label>
        <label>
          End time
          <input required name="end_time" type="time" defaultValue={assignment?.end_time ?? "07:00"} />
        </label>
        <label>
          Employee
          <select required name="employee_id" defaultValue={assignment?.employee_id ?? ""}>
            <option value="" disabled>
              Select active employee
            </option>
            {eligibleEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {stickneyEmployeeRoles(employee).join(", ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Role
          <select required name="role" defaultValue={assignment?.role ?? "Firefighter"}>
            {STICKNEY_WORK_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Save assignment</button>
      </form>
    </details>
  );
}

function Schedule({ source, departmentId, data, minimumStaffing, requests, selfEmployeeId, editable, supportSessionId }: { source: DepartmentSourcePresentation; departmentId: string; data: StickneyModuleData; minimumStaffing: number; requests: DepartmentScheduleRequest[]; selfEmployeeId: string; editable: boolean; supportSessionId: string }) {
  const rows = data.schedule ?? [];
  const employees = new Map((data.employees ?? []).map((employee) => [employee.id, employee]));
  const grouped = Map.groupBy(rows, (row) => row.work_date);
  const eligible = (row: (typeof rows)[number]) => {
    const employee = employees.get(row.employee_id);
    return !employee || (stickneyEmployeeActiveOn(employee, row.work_date) && stickneyEmployeeRoles(employee).includes(row.role));
  };
  return (
    <section className="stickney-panel">
      <SourceNotice source={source} inherited={!rows.length} />
      <div className="stickney-section-head">
        <div>
          <span>SCHEDULE</span>
          <h2>Six-week staffing window</h2>
          <p>Employment dates and qualified roles are checked against each assignment. Historical rows remain visible.</p>
        </div>
        <b>{rows.filter(eligible).length}</b>
      </div>
      {editable && (data.employees ?? []).length ? <ScheduleForm departmentId={departmentId} supportSessionId={supportSessionId} employees={data.employees ?? []} /> : null}
      <ScheduleCalendar
        rows={rows}
        today={chicagoDate()}
        minimumStaffing={minimumStaffing}
        eligibleAssignmentIds={rows.filter(eligible).map((row) => row.id)}
      />
      <ScheduleRequestsWorkspace departmentId={departmentId} employees={data.employees ?? []} assignments={rows} requests={requests} selfEmployeeId={selfEmployeeId} canManage={editable} supportSessionId={supportSessionId} today={chicagoDate()} />
      {rows.length ? (
        <details className="stickney-archive schedule-assignment-records">
          <summary>Assignment records</summary>
        <div className="stickney-schedule">
          {[...grouped.entries()].map(([date, assignments]) => {
            const valid = assignments.filter(eligible).length;
            return (
              <section key={date}>
                <header>
                  <b>{formatDate(date)}</b>
                  <span>
                    {valid} eligible · {assignments.length} saved
                  </span>
                </header>
                <div>
                  {assignments.map((row) => {
                    const employee = employees.get(row.employee_id);
                    const validAssignment = eligible(row);
                    return (
                      <article key={row.id} className={validAssignment ? "" : "stickney-schedule-conflict"}>
                        <time>
                          {row.start_time || "Start not set"}
                          {row.end_time ? `–${row.end_time}` : ""}
                        </time>
                        <b>{row.employee_name}</b>
                        <span>{validAssignment ? row.rank : "Employment date or role conflict"}</span>
                        <small>
                          {row.shift_name}
                          {row.role ? ` · ${row.role}` : ""}
                          {employee ? ` · Able: ${stickneyEmployeeRoles(employee).join(", ")}` : ""}
                        </small>
                        {editable ? <ScheduleForm departmentId={departmentId} supportSessionId={supportSessionId} employees={data.employees ?? []} assignment={row} /> : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        </details>
      ) : (
        <Empty title="No filled assignments in this window" text={(data.employees ?? []).length ? "Add a dated assignment above. Only employment-date and qualified-role matches are accepted." : "Add active employees and their roles in Roster & Staffing before building assignments."} />
      )}
      <p className="staffing-footer">Employees outside their employment dates do not count as eligible staffing. A role also must appear under Roles able to work. Saved rows are retained so prior schedule and payroll history is never erased.</p>
    </section>
  );
}

function Preplans({ source, departmentId, departmentSlug, data, editable, supportSessionId }: { source: DepartmentSourcePresentation; departmentId: string; departmentSlug: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const preplans = data.preplans ?? [];
  const imports = data.preplanImports ?? [];
  const hydrants = data.hydrants ?? [];
  const support = supportSessionId ? `&support=${encodeURIComponent(supportSessionId)}` : "";
  return (
    <section className="stickney-panel">
      <SourceNotice source={source} />
      <div className="stickney-section-head">
        <div>
          <span>FIELD PREPLANS</span>
          <h2>{source.name} building records</h2>
          <p>Source records plus audited changes made in this build.</p>
        </div>
        <b>{preplans.length + imports.length}</b>
      </div>
      <PreplanMap departmentId={departmentId} departmentSlug={departmentSlug} preplans={preplans.map((plan) => ({ id: plan.id, name: plan.business_name, address: plan.address, latitude: plan.latitude, longitude: plan.longitude, footprint: stickneyFootprint(plan.footprint_json), targetId: `stickney-preplan-${plan.id}` }))} hydrants={hydrants.map((hydrant) => ({ id: hydrant.id, name: hydrant.hydrant_number || "Unnumbered hydrant", location: hydrant.address, latitude: hydrant.latitude, longitude: hydrant.longitude, status: hydrant.service_status || "Status not entered", href: `/d/${departmentSlug}?module=hydrants${support}` }))} editable={editable}/>
      {preplans.length ? (
        <div className="stickney-card-grid">
          {preplans.map((plan) => (
            <article key={plan.id} id={`stickney-preplan-${plan.id}`}>
              <span>{plan.status || "Preplan"}</span>
              <h3>{plan.business_name}</h3>
              <p>{plan.address}</p>
              <dl>
                <div>
                  <dt>Construction</dt>
                  <dd>{plan.construction_type || plan.construction || "Not entered"}</dd>
                </div>
                <div>
                  <dt>Floors</dt>
                  <dd>{plan.floor_count || "Not entered"}</dd>
                </div>
                <div>
                  <dt>Fire flow</dt>
                  <dd>{plan.suggested_fire_flow_gpm ? `${Number(plan.suggested_fire_flow_gpm).toLocaleString()} GPM` : "Not calculated"}</dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>{plan.access_info || plan.knox_box || "Not entered"}</dd>
                </div>
              </dl>
              {plan.alarm_system || plan.sprinkler_system || plan.fdc ? <small>{[plan.alarm_system, plan.sprinkler_system, plan.fdc].filter(Boolean).join(" · ")}</small> : null}
              <EditableRecord
                departmentId={departmentId}
                recordType="preplan"
                recordId={plan.id}
                editable={editable}
                supportSessionId={supportSessionId}
                fields={[
                  {
                    name: "business_name",
                    label: "Business name",
                    value: plan.business_name,
                  },
                  { name: "address", label: "Address", value: plan.address },
                  { name: "latitude", label: "Verified latitude", value: plan.latitude },
                  { name: "longitude", label: "Verified longitude", value: plan.longitude },
                  { name: "footprint_json", label: "Verified footprint JSON", value: plan.footprint_json || "[]", multiline: true },
                  {
                    name: "construction_type",
                    label: "Construction",
                    value: plan.construction_type,
                  },
                  {
                    name: "floor_count",
                    label: "Floors",
                    value: plan.floor_count,
                  },
                  {
                    name: "access_info",
                    label: "Access information",
                    value: plan.access_info,
                    multiline: true,
                  },
                  {
                    name: "alarm_system",
                    label: "Alarm system",
                    value: plan.alarm_system,
                  },
                  {
                    name: "sprinkler_system",
                    label: "Sprinkler system",
                    value: plan.sprinkler_system,
                  },
                  { name: "fdc", label: "FDC", value: plan.fdc },
                ]}
              />
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No completed field preplans" text="No completed plans were returned from the source." />
      )}
      <details className="stickney-archive">
        <summary>
          Imported occupancy queue <b>{imports.length}</b>
        </summary>
        {imports.length ? (
          <div className="stickney-table">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((row) => (
                  <tr key={row.id}>
                    <td>{row.business_name || "Unnamed"}</td>
                    <td>{row.address}</td>
                    <td>{row.linked_preplan_id ? "Linked" : row.status}</td>
                    <td>{row.latitude != null && row.longitude != null ? `${row.latitude}, ${row.longitude}` : "Not geocoded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No imported occupancies" text="The source import queue is empty." />
        )}
      </details>
    </section>
  );
}

function Hydrants({ source, departmentId, data, editable, supportSessionId }: { source: DepartmentSourcePresentation; departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const hydrants = data.hydrants ?? [];
  return (
    <section className="stickney-panel">
      <SourceNotice source={source} />
      <div className="stickney-section-head">
        <div>
          <span>HYDRANTS</span>
          <h2>{source.name} hydrant records</h2>
        </div>
        <b>{hydrants.length}</b>
      </div>
      {hydrants.length ? (
        <div className="stickney-card-grid">
          {hydrants.map((hydrant) => (
            <article key={hydrant.id}>
              <span>{hydrant.service_status || "Status not entered"}</span>
              <h3>{hydrant.hydrant_number || "Unnumbered hydrant"}</h3>
              <p>{hydrant.address}</p>
              <small>{[hydrant.manufacturer, hydrant.model, hydrant.notes].filter(Boolean).join(" · ")}</small>
              <EditableRecord
                departmentId={departmentId}
                recordType="hydrant"
                recordId={hydrant.id}
                editable={editable}
                supportSessionId={supportSessionId}
                fields={[
                  {
                    name: "hydrant_number",
                    label: "Hydrant number",
                    value: hydrant.hydrant_number,
                  },
                  { name: "address", label: "Address", value: hydrant.address },
                  { name: "latitude", label: "Verified latitude", value: hydrant.latitude },
                  { name: "longitude", label: "Verified longitude", value: hydrant.longitude },
                  {
                    name: "service_status",
                    label: "Status",
                    value: hydrant.service_status,
                  },
                  {
                    name: "manufacturer",
                    label: "Manufacturer",
                    value: hydrant.manufacturer,
                  },
                  { name: "model", label: "Model", value: hydrant.model },
                  {
                    name: "notes",
                    label: "Notes",
                    value: hydrant.notes,
                    multiline: true,
                  },
                ]}
              />
            </article>
          ))}
        </div>
      ) : (
        <Empty title={`No ${source.name} hydrants are stored`} text="The source currently has zero field-hydrant records. Nothing was deleted during this connection." />
      )}
    </section>
  );
}

function Fleet({ source, departmentId, data, editable, supportSessionId }: { source: DepartmentSourcePresentation; departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  return <FleetWorkspace departmentId={departmentId} data={data} sourceName={source.name} sourceSystem={source.systemName} inventoryPhotoRoute={source.inventoryPhotoRoute} editable={editable} supportSessionId={supportSessionId} />;
}

function Inventory({ source, departmentId, data, editable, supportSessionId, query, selectedUnit, requestedPage, requestedPhotoPage }: { source: DepartmentSourcePresentation; departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string; query: string; selectedUnit: string; requestedPage: string; requestedPhotoPage: string }) {
  const apparatus = data.apparatus ?? [];
  const compartments = data.compartments ?? [];
  const items = data.inventory ?? [];
  const photos = data.inventoryPhotos ?? [];
  const unitName = new Map(apparatus.map((item) => [item.id, item.name]));
  const compartmentName = new Map(compartments.map((item) => [item.id, item.label]));
  const normalizedQuery = query.trim().toLowerCase();
  const activeUnit = apparatus.some((unit) => unit.id === selectedUnit) ? selectedUnit : "";
  const filteredItems = items.filter((item) => {
    if (activeUnit && item.apparatus_id !== activeUnit) return false;
    if (!normalizedQuery) return true;
    return [unitName.get(item.apparatus_id), item.compartment_id ? compartmentName.get(item.compartment_id) : "", item.name, item.manufacturer, item.model, item.serial_number, item.barcode, item.equipment_category, ...(item.check_types ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const itemPageSize = 75;
  const itemPageCount = Math.max(1, Math.ceil(filteredItems.length / itemPageSize));
  const itemPage = Math.min(itemPageCount, Math.max(1, Number.parseInt(requestedPage, 10) || 1));
  const visibleItems = filteredItems.slice((itemPage - 1) * itemPageSize, itemPage * itemPageSize);
  const filteredPhotos = photos.filter((photo) => !activeUnit || photo.apparatus_id === activeUnit);
  const photoPageSize = 18;
  const photoPageCount = Math.max(1, Math.ceil(filteredPhotos.length / photoPageSize));
  const photoPage = Math.min(photoPageCount, Math.max(1, Number.parseInt(requestedPhotoPage, 10) || 1));
  const visiblePhotos = filteredPhotos.slice((photoPage - 1) * photoPageSize, photoPage * photoPageSize);
  const inventoryHref = (nextItemPage = itemPage, nextPhotoPage = photoPage) => {
    const params = new URLSearchParams({ module: "inventory" });
    if (query.trim()) params.set("invQ", query.trim());
    if (activeUnit) params.set("invUnit", activeUnit);
    if (nextItemPage > 1) params.set("invPage", String(nextItemPage));
    if (nextPhotoPage > 1) params.set("photoPage", String(nextPhotoPage));
    if (supportSessionId) params.set("support", supportSessionId);
    return `?${params.toString()}`;
  };
  const clearParams = new URLSearchParams({ module: "inventory" });
  if (supportSessionId) clearParams.set("support", supportSessionId);
  return (
    <section className="stickney-panel">
      <SourceNotice source={source} />
      <div className="stickney-section-head">
        <div>
          <span>INVENTORY</span>
          <h2>Apparatus equipment</h2>
          <p>All active records from the {source.name} operational inventory bridge.</p>
        </div>
        <b>{items.length.toLocaleString()}</b>
      </div>
      <form className="inventory-browser" method="get">
        <input type="hidden" name="module" value="inventory" />
        {supportSessionId ? <input type="hidden" name="support" value={supportSessionId} /> : null}
        <label><span>Search inventory</span><input name="invQ" defaultValue={query} placeholder="Item, compartment, serial, barcode, category..." /></label>
        <label><span>Apparatus</span><select name="invUnit" defaultValue={activeUnit}><option value="">All apparatus</option>{apparatus.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
        <button type="submit">Find records</button>
        <a href={`?${clearParams.toString()}`}>Clear</a>
      </form>
      <div className="inventory-results"><b>{filteredItems.length.toLocaleString()} matching item{filteredItems.length === 1 ? "" : "s"}</b><span>Showing no more than {itemPageSize} rows at once so the department app stays responsive.</span></div>
      {filteredPhotos.length ? (
        <>
        <div className="stickney-photo-gallery">
          {visiblePhotos.map((photo) => (
            <figure key={photo.id}>
              <img loading="lazy" src={`/api/departments/${departmentId}/${source.inventoryPhotoRoute}/${photo.id}`} alt={`${unitName.get(photo.apparatus_id) || "Apparatus"} ${photo.view_level} inventory view`} />
              <figcaption>
                <b>{unitName.get(photo.apparatus_id) || "Apparatus"}</b>
                <span>{[photo.view_level, photo.door_state].filter(Boolean).join(" · ")}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        {photoPageCount > 1 ? <nav className="inventory-pagination" aria-label="Inventory photo pages">{photoPage > 1 ? <a href={inventoryHref(itemPage, photoPage - 1)}>Previous photos</a> : <span>Previous photos</span>}<b>Photos {(photoPage - 1) * photoPageSize + 1}-{Math.min(photoPage * photoPageSize, filteredPhotos.length)} of {filteredPhotos.length}</b>{photoPage < photoPageCount ? <a href={inventoryHref(itemPage, photoPage + 1)}>Next photos</a> : <span>Next photos</span>}</nav> : null}
        </>
      ) : (
        <div className="stickney-photo-status">
          <b>No inventory pictures stored</b>
          <span>{activeUnit ? "No active inventory photo views are attached to this apparatus." : "The source currently has no active inventory photo views."}</span>
        </div>
      )}
      {visibleItems.length ? (
        <div className="stickney-table inventory">
          <table>
            <thead>
              <tr>
                <th>Apparatus</th>
                <th>Compartment</th>
                <th>Item</th>
                <th>Required</th>
                <th>Category</th>
                <th>Identification</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td>{unitName.get(item.apparatus_id) || "Unknown unit"}</td>
                  <td>{item.compartment_id ? compartmentName.get(item.compartment_id) || "Unlabeled" : "Not assigned"}</td>
                  <td>
                    <b>{item.name}</b>
                    <small>{[item.manufacturer, item.model].filter(Boolean).join(" ")}</small>
                  </td>
                  <td>{item.quantity_required}</td>
                  <td>{item.equipment_category || (item.check_types ?? []).join(", ") || "Uncategorized"}</td>
                  <td>{item.serial_number || item.barcode || "—"}</td>
                  <td>
                    <EditableRecord
                      departmentId={departmentId}
                      recordType="inventory"
                      recordId={item.id}
                      editable={editable}
                      supportSessionId={supportSessionId}
                      fields={[
                        { name: "name", label: "Name", value: item.name },
                        {
                          name: "manufacturer",
                          label: "Manufacturer",
                          value: item.manufacturer,
                        },
                        { name: "model", label: "Model", value: item.model },
                        {
                          name: "serial_number",
                          label: "Serial number",
                          value: item.serial_number,
                        },
                        {
                          name: "barcode",
                          label: "Barcode",
                          value: item.barcode,
                        },
                        {
                          name: "quantity_required",
                          label: "Required quantity",
                          value: item.quantity_required,
                        },
                        {
                          name: "equipment_category",
                          label: "Category",
                          value: item.equipment_category,
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={items.length ? "No matching inventory" : "No active inventory"} text={items.length ? "Change the search or apparatus filter to see other preserved records." : `The ${source.name} operational inventory returned no active equipment records.`} />
      )}
      {itemPageCount > 1 ? <nav className="inventory-pagination" aria-label="Inventory item pages">{itemPage > 1 ? <a href={inventoryHref(itemPage - 1, photoPage)}>Previous</a> : <span>Previous</span>}<b>Items {(itemPage - 1) * itemPageSize + 1}-{Math.min(itemPage * itemPageSize, filteredItems.length)} of {filteredItems.length.toLocaleString()}</b>{itemPage < itemPageCount ? <a href={inventoryHref(itemPage + 1, photoPage)}>Next</a> : <span>Next</span>}</nav> : null}
    </section>
  );
}

function Duties({ source, departmentId, data, editable, supportSessionId }: { source: DepartmentSourcePresentation; departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  return <DailyDutiesWorkspace departmentId={departmentId} data={data} sourceName={source.name} sourceSystem={source.systemName} editable={editable} supportSessionId={supportSessionId} />;
}

function Documents({ source, departmentId, data, editable, supportSessionId }: { source: DepartmentSourcePresentation; departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const boxCards = data.boxCards ?? [];
  const policies = data.policies ?? [];
  return <DocumentsWorkspace departmentId={departmentId} boxCards={boxCards} policies={policies} sourceName={source.name} sourceSystem={source.systemName} editable={editable} supportSessionId={supportSessionId} />;
}

function Phones({ source, departmentId, data, editable, supportSessionId }: { source: DepartmentSourcePresentation; departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const rows = data.phoneNumbers ?? [];
  return (
    <section className="stickney-panel">
      <SourceNotice source={source} />
      <div className="stickney-section-head">
        <div>
          <span>IMPORTANT NUMBERS</span>
          <h2>Department phone directory</h2>
        </div>
        <b>{rows.length}</b>
      </div>
      {rows.length ? (
        <div className="stickney-phone-grid">
          {rows.map((row) => (
            <article key={row.id}>
              <span>{row.category}</span>
              <h3>{row.name}</h3>
              <div>
                {row.emergency_number ? (
                  <a href={`tel:${row.emergency_number.replace(/[^\d+]/g, "")}`}>
                    <small>Emergency</small>
                    <b>{row.emergency_number}</b>
                  </a>
                ) : null}
                {row.non_emergency_number ? (
                  <a href={`tel:${row.non_emergency_number.replace(/[^\d+]/g, "")}`}>
                    <small>Non-emergency</small>
                    <b>{row.non_emergency_number}</b>
                  </a>
                ) : null}
              </div>
              {row.notes ? <p>{row.notes}</p> : null}
              <EditableRecord
                departmentId={departmentId}
                recordType="phone"
                recordId={row.id}
                editable={editable}
                supportSessionId={supportSessionId}
                fields={[
                  { name: "category", label: "Category", value: row.category },
                  { name: "name", label: "Name", value: row.name },
                  {
                    name: "emergency_number",
                    label: "Emergency number",
                    value: row.emergency_number,
                  },
                  {
                    name: "non_emergency_number",
                    label: "Non-emergency number",
                    value: row.non_emergency_number,
                  },
                  {
                    name: "notes",
                    label: "Notes",
                    value: row.notes,
                    multiline: true,
                  },
                ]}
              />
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No important phone numbers" text="The source phone directory is empty." />
      )}
    </section>
  );
}
