import type { DepartmentAsset, DepartmentModuleData } from "@/db/access";
import type { DepartmentSourcePresentation } from "@/db/department-source";
import type { FoundationSettings } from "@/db/foundation";
import type { StickneyApparatus, StickneyModuleData, StickneyScheduleAssignment } from "@/db/stickney";

type SharedProps = {
  departmentId: string;
  departmentName: string;
  supportQuery: string;
  source: DepartmentSourcePresentation | null;
  sourceData: StickneyModuleData | null;
  connectionError?: string;
};

type ApparatusRow = {
  id: string;
  unit: string;
  type: string;
  status: string;
  detail: string;
};

function chicagoDate(offsetDays = 0) {
  const current = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${current}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

function apparatusRows(sourceData: StickneyModuleData | null, assets: DepartmentAsset[]) {
  const imported: ApparatusRow[] = (sourceData?.apparatus || []).map((item: StickneyApparatus) => ({
    id: item.id,
    unit: item.name,
    type: item.asset_type || "Apparatus",
    status: item.status || "Status not entered",
    detail: [item.year, item.manufacturer, item.model].filter(Boolean).join(" · "),
  }));
  const importedUnits = new Set(imported.map((item) => item.unit.trim().toLowerCase()));
  const native = assets
    .filter((asset) => /apparatus|vehicle|engine|truck|ambulance|medic|command/i.test(`${asset.asset_type} ${asset.category}`))
    .filter((asset) => !importedUnits.has((asset.unit_number || asset.name).trim().toLowerCase()))
    .map((asset): ApparatusRow => ({
      id: asset.id,
      unit: asset.unit_number || asset.name,
      type: asset.asset_type || asset.category || "Apparatus",
      status: asset.status || "Status not entered",
      detail: [asset.manufacturer, asset.model].filter(Boolean).join(" · "),
    }));
  return [...imported, ...native];
}

function inService(status: string) {
  return /available|in service|ready|active|operational|reserve/i.test(status) && !/out of service|\boos\b|offline|retired|unavailable|failed/i.test(status);
}

function SourceLine({ source, departmentName, connectionError }: { source: DepartmentSourcePresentation | null; departmentName: string; connectionError?: string }) {
  return <div className={`ops-source-line${connectionError ? " error" : ""}`}><i/><div><b>{connectionError ? "Department source temporarily unavailable" : source ? source.recordsLabel : `${departmentName} saved records`}</b><span>{connectionError || (source ? source.recordsDescription : "This shared foundation loads only records saved under this department ID.")}</span></div></div>;
}

export function CommandCenterWorkspace({ departmentName, supportQuery, source, sourceData, connectionError, liveOpsData, assets, settings }: SharedProps & { liveOpsData: DepartmentModuleData; assets: DepartmentAsset[]; settings: FoundationSettings }) {
  const today = chicagoDate();
  const schedule = sourceData?.schedule || [];
  const todayAssignments = schedule.filter((assignment) => assignment.work_date === today);
  const employeeById = new Map((sourceData?.employees || []).map((employee) => [employee.id, employee]));
  const onDuty = new Set(todayAssignments.map((assignment) => assignment.employee_id || assignment.employee_name)).size;
  const units = apparatusRows(sourceData, assets);
  const availableUnits = units.filter((unit) => inService(unit.status)).length;
  const attentionUnits = units.filter((unit) => !inService(unit.status));
  const activeIncident = liveOpsData.items.find((item) => item.item_type === "incident" && item.operational_status === "active");
  const recentIncidents = liveOpsData.items
    .filter((item) => item.item_type === "incident")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);
  const day = sourceData?.dutyContext?.dayOfWeek;
  const currentDuties = (sourceData?.duties || []).filter((duty) => day === undefined || duty.day_of_week === day);
  const openDuties = currentDuties.filter((duty) => !duty.completed_date);
  const summary = sourceData?.summary;
  const staffingGap = settings.minimum_staffing > 0 ? Math.max(0, settings.minimum_staffing - onDuty) : 0;

  return <section className="ops-foundation" data-workspace="command-center">
    <SourceLine source={source} departmentName={departmentName} connectionError={connectionError}/>
    {activeIncident ? <a className="ops-incident-banner" href={`?module=active-incident${supportQuery}`}><span>ACTIVE INCIDENT</span><b>{activeIncident.title}</b><small>{activeIncident.location || activeIncident.summary || "Location not entered"}</small><strong>Open incident board →</strong></a> : null}
    <nav className="ops-command-strip" aria-label="Command Center actions">
      <a href={`?module=respond${supportQuery}`}><span>RESPOND</span><b>Location intelligence</b></a>
      <a href={`?module=active-incident${supportQuery}`}><span>INCIDENT</span><b>{activeIncident ? "Open active board" : "Command standby"}</b></a>
      <a href={`?module=scheduling${supportQuery}`}><span>SCHEDULE</span><b>{todayAssignments.length ? `${todayAssignments.length} assignments today` : "No assignments today"}</b></a>
      <a href={`?module=daily-log${supportQuery}`}><span>DAILY LOG</span><b>Staffing and calls</b></a>
    </nav>
    <div className="ops-kpis">
      <article className={units.length && availableUnits < units.length ? "warning" : "ready"}><b>{units.length ? `${availableUnits}/${units.length}` : "—"}</b><span>Apparatus in service</span><small>{units.length ? "From this department’s fleet" : "No fleet records connected"}</small></article>
      <article className={settings.minimum_staffing > 0 && onDuty < settings.minimum_staffing ? "danger" : "ready"}><b>{onDuty || "—"}</b><span>Personnel on duty</span><small>{todayAssignments.length ? `${todayAssignments.length} riding assignment${todayAssignments.length === 1 ? "" : "s"}` : "No approved assignments today"}</small></article>
      <article><b>{currentDuties.length || "—"}</b><span>Today&apos;s duty records</span><small>{currentDuties.length ? "Open Daily Duties for completion state" : "No duty records due today"}</small></article>
      <article className={activeIncident ? "danger" : "muted"}><b>{activeIncident ? "ACTIVE" : "NONE"}</b><span>Incident status</span><small>{activeIncident ? "Saved department incident" : "CAD feed not inferred"}</small></article>
    </div>
    <div className="ops-columns ops-command-grid">
      <section className="ops-card"><header><div><span>APPARATUS STATUS</span><h2>Department fleet</h2></div><a href={`?module=fleet${supportQuery}`}>Open Apparatus</a></header>
        {units.length ? <div className="ops-table-wrap"><table><thead><tr><th>Unit</th><th>Type</th><th>Status</th></tr></thead><tbody>{units.slice(0, 6).map((unit) => <tr key={unit.id}><td><b>{unit.unit}</b><small>{unit.detail || "Details not entered"}</small></td><td>{unit.type}</td><td><span className={inService(unit.status) ? "ops-status ready" : "ops-status danger"}>{unit.status}</span></td></tr>)}</tbody></table>{units.length > 6 ? <p className="ops-table-more">Showing 6 of {units.length} units. Open Apparatus for the complete fleet.</p> : null}</div> : <Empty text="No apparatus records are connected to this department."/>}
      </section>
      <section className="ops-card"><header><div><span>ON-DUTY ROSTER</span><h2>Today&apos;s riding assignments</h2></div><a href={`?module=scheduling${supportQuery}`}>Open Schedule</a></header>
        {todayAssignments.length ? <div className="ops-list ops-roster-list">{todayAssignments.slice(0, 6).map((assignment) => { const employee = employeeById.get(assignment.employee_id); return <article key={assignment.id}><b>{assignment.role || "Position not entered"}<em>{assignment.employee_name || employee?.name || "Employee not entered"}</em></b><span>{[assignment.rank || employee?.rank, assignment.shift_name, assignment.start_time && assignment.end_time ? `${assignment.start_time}–${assignment.end_time}` : ""].filter(Boolean).join(" · ")}</span></article>; })}{todayAssignments.length > 6 ? <p className="ops-list-more">+ {todayAssignments.length - 6} more assignments in Scheduling</p> : null}</div> : <Empty text="No approved schedule assignments are available for today."/>}
      </section>
      <section className="ops-card"><header><div><span>OPERATIONAL PRIORITIES</span><h2>Items needing attention</h2></div></header>
        {activeIncident || staffingGap || attentionUnits.length || openDuties.length ? <div className="ops-priority-list">{activeIncident ? <a className="danger" href={`?module=active-incident${supportQuery}`}><b>Active incident</b><span>{activeIncident.title}</span></a> : null}{staffingGap ? <a className="warning" href={`?module=scheduling${supportQuery}`}><b>Below minimum staffing</b><span>{staffingGap} position{staffingGap === 1 ? "" : "s"} below the configured minimum</span></a> : null}{attentionUnits.length ? <a className="warning" href={`?module=fleet${supportQuery}`}><b>Fleet status review</b><span>{attentionUnits.length} unit{attentionUnits.length === 1 ? "" : "s"} not marked in service</span></a> : null}{openDuties.length ? <a href={`?module=duties${supportQuery}`}><b>Open daily duties</b><span>{openDuties.length} current record{openDuties.length === 1 ? "" : "s"} without completion</span></a> : null}</div> : <Empty text="No saved department record currently creates a Command Center priority."/>}
      </section>
      <section className="ops-card"><header><div><span>DAILY DUTIES</span><h2>Current duty list</h2></div><a href={`?module=duties${supportQuery}`}>Open Duties</a></header>
        {currentDuties.length ? <div className="ops-list">{currentDuties.slice(0, 8).map((duty) => <article key={duty.id}><b>{duty.duty}</b><span>{duty.detail || duty.category || duty.shift_key || "Department duty"}</span></article>)}</div> : <Empty text="No current duty records are connected. No completion is assumed."/>}
      </section>
      <section className="ops-card"><header><div><span>INCIDENT HISTORY</span><h2>Recent department records</h2></div><a href={`?module=live-ops${supportQuery}`}>Open Live Operations</a></header>
        {recentIncidents.length ? <div className="ops-list">{recentIncidents.map((incident) => <article key={incident.id}><b>{incident.title}<em className={`ops-status ${incident.operational_status === "active" ? "danger" : "muted"}`}>{incident.operational_status || "Status not entered"}</em></b><span>{incident.location || incident.summary || "Location and summary not entered"}</span></article>)}</div> : <Empty text="No saved incident history is available in this department workspace."/>}
      </section>
    </div>
    <section className="ops-module-links" aria-label="Integrated department modules">
      <a href={`?module=preplans${supportQuery}`}><span>Pre-Plans</span><b>{summary ? summary.preplans + summary.preplan_imports : sourceData?.preplans?.length ?? 0}</b><small>Department properties</small></a>
      <a href={`?module=fleet${supportQuery}`}><span>Apparatus & Logistics</span><b>{units.length}</b><small>Department units</small></a>
      <a href={`?module=scheduling${supportQuery}`}><span>Scheduling</span><b>{todayAssignments.length}</b><small>Assignments today</small></a>
      <a href={`?module=daily-log${supportQuery}`}><span>Daily Log</span><b>OPEN</b><small>Staffing, calls, and notes</small></a>
      <a href={`?module=inspections${supportQuery}`}><span>Inspections</span><b>OWNER</b><small>Development workbench</small></a>
      <a href={`?module=hydrants${supportQuery}`}><span>Hydrants</span><b>{summary?.hydrants ?? sourceData?.hydrants?.length ?? 0}</b><small>Department water supply</small></a>
    </section>
    <p className="ops-truth">Command Center combines this department&apos;s existing schedule, fleet, duty, incident, preplan, and hydrant records. Missing feeds stay visibly unconnected; demo names and counts are never substituted.</p>
  </section>;
}

function normalizeLocation(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitUnits(value: string) {
  return value.split(/[,;|]/).map((unit) => unit.trim()).filter(Boolean);
}

export function ActiveIncidentWorkspace({ departmentName, supportQuery, source, sourceData, connectionError, liveOpsData, assets, editable }: SharedProps & { liveOpsData: DepartmentModuleData; assets: DepartmentAsset[]; editable: boolean }) {
  const incident = liveOpsData.items.find((item) => item.item_type === "incident" && item.operational_status === "active");
  const units = apparatusRows(sourceData, assets);
  if (!incident) return <section className="ops-foundation" data-workspace="active-incident"><SourceLine source={source} departmentName={departmentName} connectionError={connectionError}/><div className="ops-standby"><span>NO ACTIVE INCIDENT</span><h2>Incident Command is standing by.</h2><p>No active department incident record is saved. This does not claim that CAD is clear or that every unit is available.</p><div><a href={`?module=respond${supportQuery}`}>Open Respond</a>{editable ? <a href={`?module=live-ops${supportQuery}`}>Add incident in Live Operations</a> : null}</div></div><p className="ops-truth">The command board opens only from a real incident saved under this department. Fictional demo incident values are not copied into department builds.</p></section>;

  const dispatched = splitUnits(incident.contact);
  const matchedUnits = dispatched.map((unitName) => units.find((unit) => normalizeLocation(unit.unit) === normalizeLocation(unitName))).filter((unit): unit is ApparatusRow => Boolean(unit));
  const locationKey = normalizeLocation(incident.location);
  const linkedPreplan = (sourceData?.preplans || []).find((preplan) => normalizeLocation(preplan.address) === locationKey || incident.title.toLowerCase().includes(preplan.business_name.toLowerCase()));
  const updated = new Date(incident.updated_at);

  return <section className="ops-foundation" data-workspace="active-incident">
    <SourceLine source={source} departmentName={departmentName} connectionError={connectionError}/>
    <nav className="ops-command-strip" aria-label="Incident actions">
      <a href={`?module=respond${supportQuery}`}><span>RESPOND</span><b>Location intelligence</b></a>
      <a href={`?module=preplans${supportQuery}${linkedPreplan ? `#stickney-preplan-${linkedPreplan.id}` : ""}`}><span>PREPLAN</span><b>{linkedPreplan ? linkedPreplan.business_name : "Find property record"}</b></a>
      <a href={`?module=hydrants${supportQuery}`}><span>WATER SUPPLY</span><b>Open department hydrants</b></a>
      <a href={`?module=daily-log${supportQuery}`}><span>DAILY LOG</span><b>Record calls and notes</b></a>
    </nav>
    <header className="ops-active-head"><div><span>ACTIVE · MANUAL DEPARTMENT RECORD</span><h2>{incident.title}</h2><p>{incident.location || "Location not entered"}</p></div><div><b>{Number.isNaN(updated.getTime()) ? "Update time unavailable" : updated.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b><span>Last saved update</span></div></header>
    <div className="ops-kpis incident">
      <article className="danger"><b>{dispatched.length || "—"}</b><span>Units entered</span><small>{dispatched.length ? dispatched.join(" · ") : "No units entered on incident record"}</small></article>
      <article><b>{linkedPreplan ? "MATCH" : "NONE"}</b><span>Linked preplan</span><small>{linkedPreplan ? linkedPreplan.business_name : "No exact saved address match"}</small></article>
      <article><b>{sourceData?.hydrants?.length ?? 0}</b><span>Hydrant records</span><small>Open Hydrants to select verified water supply</small></article>
      <article><b>MANUAL</b><span>Incident source</span><small>Live CAD is not claimed</small></article>
    </div>
    <div className="ops-columns">
      <section className="ops-card ops-wide"><header><div><span>INCIDENT SUMMARY</span><h2>Current department notes</h2></div><a href={`?module=respond${supportQuery}`}>Open Respond intelligence</a></header><p className="ops-incident-summary">{incident.summary || "No incident summary has been entered."}</p>{incident.link_url ? <a className="ops-primary-link" href={incident.link_url} target="_blank" rel="noreferrer">Open linked incident resource</a> : null}</section>
      <section className="ops-card"><header><div><span>APPARATUS</span><h2>Entered response</h2></div><a href={`?module=fleet${supportQuery}`}>Open fleet</a></header>{dispatched.length ? <div className="ops-list">{dispatched.map((unitName) => { const unit = units.find((candidate) => normalizeLocation(candidate.unit) === normalizeLocation(unitName)); return <article key={unitName}><b>{unitName}</b><span>{unit ? `${unit.type} · ${unit.status}` : "Unit is not matched to the department fleet"}</span></article>; })}</div> : <Empty text="No responding units have been entered."/>}</section>
      <section className="ops-card"><header><div><span>COMMAND STRUCTURE</span><h2>Assignments</h2></div></header><Empty text="Command positions, PAR, benchmarks, and tactical assignments have not been entered in the live department record. The demo values are not copied."/></section>
      <section className="ops-card"><header><div><span>PREPLAN & WATER</span><h2>{linkedPreplan?.business_name || "No exact preplan match"}</h2></div>{linkedPreplan ? <a href={`?module=preplans${supportQuery}`}>Open Preplan</a> : null}</header>{linkedPreplan ? <div className="ops-list"><article><b>{linkedPreplan.address}</b><span>{[linkedPreplan.construction_type, linkedPreplan.floor_count ? `${linkedPreplan.floor_count} floor${linkedPreplan.floor_count === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Building details not entered"}</span></article><article><b>FDC</b><span>{linkedPreplan.fdc || "Not entered"}</span></article><article><b>Suggested fire flow</b><span>{linkedPreplan.suggested_fire_flow_gpm ? `${linkedPreplan.suggested_fire_flow_gpm.toLocaleString()} GPM` : "Not entered"}</span></article></div> : <Empty text="Open Pre-Plans to review or build the correct property record."/>}</section>
    </div>
    {matchedUnits.length !== dispatched.length ? <p className="ops-truth warning">Some entered incident units do not match a current apparatus record. They remain visible but are not silently reassigned.</p> : <p className="ops-truth">This board uses only the active incident, apparatus, preplan, and hydrant records under this department. Every unavailable command field stays empty.</p>}
  </section>;
}

function assignmentHours(assignment: StickneyScheduleAssignment) {
  const parse = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0; };
  const start = parse(assignment.start_time);
  let end = parse(assignment.end_time);
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function PayrollWorkspace({ departmentName, supportQuery, source, sourceData, connectionError, settings, editable }: SharedProps & { settings: FoundationSettings; editable: boolean }) {
  const periodEnd = chicagoDate();
  const periodStart = chicagoDate(-(Math.max(1, settings.overtime_period_days) - 1));
  const assignments = (sourceData?.schedule || []).filter((assignment) => assignment.work_date >= periodStart && assignment.work_date <= periodEnd);
  const employees = new Map((sourceData?.employees || []).map((employee) => [employee.id, employee]));
  const ledger = new Map<string, { id: string; name: string; rank: string; hours: number; shifts: number }>();
  for (const assignment of assignments) {
    const id = assignment.employee_id || assignment.employee_name;
    const current = ledger.get(id) || { id, name: assignment.employee_name || employees.get(id)?.name || "Employee name unavailable", rank: assignment.rank || employees.get(id)?.rank || "Rank not entered", hours: 0, shifts: 0 };
    current.hours += assignmentHours(assignment);
    current.shifts += 1;
    ledger.set(id, current);
  }
  for (const employee of employees.values()) {
    const overlapsPeriod = (!employee.start_date || employee.start_date <= periodEnd) && (!employee.employment_end_date || employee.employment_end_date >= periodStart);
    if (!overlapsPeriod) continue;
    if (!ledger.has(employee.id)) ledger.set(employee.id, { id: employee.id, name: employee.name, rank: employee.rank, hours: 0, shifts: 0 });
  }
  const rows = [...ledger.values()].sort((a, b) => a.name.localeCompare(b.name));
  const totalHours = rows.reduce((total, row) => total + row.hours, 0);
  const totalOvertime = rows.reduce((total, row) => total + Math.max(0, row.hours - settings.overtime_threshold_hours), 0);
  const csv = [
    ["Employee ID", "Employee", "Rank", "Scheduled hours", "Calculated OT hours", "Period start", "Period end", "Pay rate status"],
    ...rows.map((row) => [row.id, row.name, row.rank, row.hours.toFixed(2), Math.max(0, row.hours - settings.overtime_threshold_hours).toFixed(2), periodStart, periodEnd, "Not connected"]),
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");

  return <section className="ops-foundation" data-workspace="payroll">
    <SourceLine source={source} departmentName={departmentName} connectionError={connectionError}/>
    <div className="ops-kpis">
      <article><b>{totalHours.toFixed(1)}</b><span>Scheduled hours</span><small>{displayDate(periodStart)} – {displayDate(periodEnd)}</small></article>
      <article className={totalOvertime > 0 ? "warning" : "ready"}><b>{totalOvertime.toFixed(1)}</b><span>Threshold hours</span><small>Over {settings.overtime_threshold_hours}h · schedule calculation</small></article>
      <article><b>{rows.length}</b><span>Employee records</span><small>Current roster plus period history</small></article>
      <article className="muted"><b>NOT CONNECTED</b><span>Pay rates & gross</span><small>No wages are guessed or copied from demo data</small></article>
    </div>
    <section className="ops-card"><header><div><span>PAY PERIOD</span><h2>Schedule hours ledger</h2><p>{settings.overtime_period_days}-day period · {settings.overtime_assignment_rule}</p></div><a download={`${departmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-schedule-hours-${periodEnd}.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}>Download CSV</a></header>
      {rows.length ? <div className="ops-table-wrap"><table><thead><tr><th>Employee</th><th>Rank</th><th>Assignments</th><th>Scheduled hours</th><th>Over threshold</th><th>Gross</th></tr></thead><tbody>{rows.map((row) => { const overtime = Math.max(0, row.hours - settings.overtime_threshold_hours); return <tr key={row.id}><td><b>{row.name}</b><small>{row.id}</small></td><td>{row.rank}</td><td>{row.shifts}</td><td>{row.hours.toFixed(1)}</td><td><span className={`ops-status ${overtime > 0 ? "warning" : "ready"}`}>{overtime.toFixed(1)}</span></td><td><span className="ops-status muted">Rate not connected</span></td></tr>; })}</tbody></table></div> : <Empty text="No schedule assignments or roster records are available for this period."/>}
    </section>
    <div className="ops-columns">
      <section className="ops-card"><header><div><span>RULES</span><h2>Department settings</h2></div></header><dl className="ops-rules"><div><dt>Period</dt><dd>{settings.overtime_period_days} days</dd></div><div><dt>OT threshold</dt><dd>{settings.overtime_threshold_hours} hours</dd></div><div><dt>Assignment rule</dt><dd>{settings.overtime_assignment_rule}</dd></div></dl><p>{settings.overtime_notes}</p></section>
      <section className="ops-card"><header><div><span>CONNECTION STATUS</span><h2>Gross pay protected</h2></div></header><p>Scheduled hours are real department assignments. Regular rates, acting pay, holiday multipliers, accruals, approvals, and finance exports require a verified payroll source before gross pay can be calculated.</p><div className="ops-actions"><a href={`?module=scheduling${supportQuery}`}>Open Scheduling</a><a href={`?module=staffing${supportQuery}`}>Open Roster</a></div></section>
    </div>
    <p className="ops-truth">{editable ? "You have payroll editing privilege, but this release will not invent pay rates. Connect verified rates and approval records before enabling gross calculations." : "This is a read-only schedule-derived ledger. Payroll editing requires the payroll privilege."}</p>
  </section>;
}

function Empty({ text }: { text: string }) {
  return <div className="ops-empty"><b>Not connected</b><span>{text}</span></div>;
}
