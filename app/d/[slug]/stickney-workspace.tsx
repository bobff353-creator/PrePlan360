/* eslint-disable @next/next/no-img-element -- protected operational images are streamed by authenticated API routes */
import type { StickneyModuleData } from "@/db/stickney";
import StaffingWorkspace from "./staffing-workspace";

type Props = {
  module: string;
  departmentId: string;
  data: StickneyModuleData;
  editable: boolean;
  supportSessionId?: string;
  connectionError?: string;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function SourceNotice() {
  return <div className="stickney-source-notice"><b>Live Stickney records</b><span>Read-only connection to Stickney Firehouse Manager. The source records remain in place and are not deleted or rewritten.</span></div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="stickney-empty"><b>{title}</b><span>{text}</span></div>;
}

function formatDate(value: string) {
  if (!value) return "Date not entered";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function documentHref(value: string) {
  if (value.startsWith("/box-cards/")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function EditableRecord({ departmentId, recordType, recordId, fields, editable, supportSessionId }: { departmentId: string; recordType: string; recordId: string; fields: Array<{ name: string; label: string; value: string | number | null | undefined; multiline?: boolean }>; editable: boolean; supportSessionId: string }) {
  if (!editable) return null;
  return <details className="stickney-record-editor"><summary>Edit this record</summary><form method="post" action={`/api/departments/${departmentId}/stickney-records`}><input type="hidden" name="record_type" value={recordType}/><input type="hidden" name="record_id" value={recordId}/><input type="hidden" name="support_session_id" value={supportSessionId}/>{fields.map((field) => <label key={field.name}>{field.label}{field.multiline ? <textarea name={field.name} defaultValue={String(field.value ?? "")} rows={3}/> : <input name={field.name} defaultValue={String(field.value ?? "")}/>}</label>)}<button type="submit">Save change</button></form></details>;
}

export default function StickneyWorkspace({ module, departmentId, data, editable, supportSessionId = "", connectionError }: Props) {
  if (connectionError) {
    return <section className="stickney-panel"><SourceNotice/><Empty title="Stickney connection unavailable" text={connectionError}/></section>;
  }
  if (module === "dashboard" && data.summary) return <StickneyDashboard data={data}/>;
  if (module === "staffing") return <Staffing departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  if (module === "scheduling") return <Schedule departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  if (module === "preplans") return <Preplans departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  if (module === "hydrants") return <Hydrants departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  if (module === "fleet") return <Fleet departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  if (module === "inventory") return <Inventory departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  if (module === "duties") return <Duties departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  if (module === "documents") return <Documents departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  if (module === "phones") return <Phones departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId}/>;
  return <section className="stickney-panel"><SourceNotice/><Empty title="No Stickney reader for this module" text="This module remains in its existing PrePlan 360 state."/></section>;
}

function StickneyDashboard({ data }: { data: StickneyModuleData }) {
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
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-metric-grid">{cards.map(([label, count, detail, link]) => <a href={`?module=${link}`} key={label}><span>{label}</span><b>{Number(count).toLocaleString()}</b><small>{detail}</small></a>)}</div><div className="stickney-integrity"><b>Source preserved</b><p>This build reads only the Stickney department bridge. No records were removed from Stickney Firehouse Manager, and other PrePlan 360 departments cannot load this data.</p></div></section>;
}

function Staffing({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const employees = data.employees ?? [];
  return employees.length ? <StaffingWorkspace departmentId={departmentId} employees={employees} editable={editable} supportSessionId={supportSessionId}/> : <section className="stickney-panel"><SourceNotice/><Empty title="No active employees" text="The Stickney source returned no active employee records."/></section>;
}

function Schedule({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const rows = data.schedule ?? [];
  const grouped = Map.groupBy(rows, (row) => row.work_date);
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-section-head"><div><span>SCHEDULE</span><h2>Six-week staffing window</h2><p>Seven days of history and 35 days ahead from the live station schedule.</p></div><b>{rows.length}</b></div>{rows.length ? <div className="stickney-schedule">{[...grouped.entries()].map(([date, assignments]) => <section key={date}><header><b>{formatDate(date)}</b><span>{assignments.length} assigned</span></header><div>{assignments.map((row) => <article key={row.id}><time>{row.start_time || "Start not set"}{row.end_time ? `–${row.end_time}` : ""}</time><b>{row.employee_name}</b><span>{row.rank}</span><small>{row.shift_name}{row.role ? ` · ${row.role}` : ""}</small><EditableRecord departmentId={departmentId} recordType="schedule" recordId={row.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"work_date",label:"Work date",value:row.work_date},{name:"shift_name",label:"Shift",value:row.shift_name},{name:"start_time",label:"Start time",value:row.start_time},{name:"end_time",label:"End time",value:row.end_time},{name:"role",label:"Role",value:row.role},{name:"employee_name",label:"Employee",value:row.employee_name},{name:"rank",label:"Rank",value:row.rank}]}/></article>)}</div></section>)}</div> : <Empty title="No filled assignments in this window" text="The saved schedule remains in Stickney Firehouse Manager; this view shows only the current six-week window."/>}</section>;
}

function Preplans({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const preplans = data.preplans ?? [];
  const imports = data.preplanImports ?? [];
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-section-head"><div><span>FIELD PREPLANS</span><h2>Stickney building records</h2><p>Source records plus audited changes made in this build.</p></div><b>{preplans.length + imports.length}</b></div>{preplans.length ? <div className="stickney-card-grid">{preplans.map((plan) => <article key={plan.id}><span>{plan.status || "Preplan"}</span><h3>{plan.business_name}</h3><p>{plan.address}</p><dl><div><dt>Construction</dt><dd>{plan.construction_type || plan.construction || "Not entered"}</dd></div><div><dt>Floors</dt><dd>{plan.floor_count || "Not entered"}</dd></div><div><dt>Fire flow</dt><dd>{plan.suggested_fire_flow_gpm ? `${Number(plan.suggested_fire_flow_gpm).toLocaleString()} GPM` : "Not calculated"}</dd></div><div><dt>Access</dt><dd>{plan.access_info || plan.knox_box || "Not entered"}</dd></div></dl>{plan.alarm_system || plan.sprinkler_system || plan.fdc ? <small>{[plan.alarm_system,plan.sprinkler_system,plan.fdc].filter(Boolean).join(" · ")}</small> : null}<EditableRecord departmentId={departmentId} recordType="preplan" recordId={plan.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"business_name",label:"Business name",value:plan.business_name},{name:"address",label:"Address",value:plan.address},{name:"construction_type",label:"Construction",value:plan.construction_type},{name:"floor_count",label:"Floors",value:plan.floor_count},{name:"access_info",label:"Access information",value:plan.access_info,multiline:true},{name:"alarm_system",label:"Alarm system",value:plan.alarm_system},{name:"sprinkler_system",label:"Sprinkler system",value:plan.sprinkler_system},{name:"fdc",label:"FDC",value:plan.fdc}]}/></article>)}</div> : <Empty title="No completed field preplans" text="No completed plans were returned from the source."/>}<details className="stickney-archive"><summary>Imported occupancy queue <b>{imports.length}</b></summary>{imports.length ? <div className="stickney-table"><table><thead><tr><th>Business</th><th>Address</th><th>Status</th><th>Location</th></tr></thead><tbody>{imports.map((row) => <tr key={row.id}><td>{row.business_name || "Unnamed"}</td><td>{row.address}</td><td>{row.linked_preplan_id ? "Linked" : row.status}</td><td>{row.latitude != null && row.longitude != null ? `${row.latitude}, ${row.longitude}` : "Not geocoded"}</td></tr>)}</tbody></table></div> : <Empty title="No imported occupancies" text="The source import queue is empty."/>}</details></section>;
}

function Hydrants({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const hydrants = data.hydrants ?? [];
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-section-head"><div><span>HYDRANTS</span><h2>Stickney hydrant records</h2></div><b>{hydrants.length}</b></div>{hydrants.length ? <div className="stickney-card-grid">{hydrants.map((hydrant) => <article key={hydrant.id}><span>{hydrant.service_status || "Status not entered"}</span><h3>{hydrant.hydrant_number || "Unnumbered hydrant"}</h3><p>{hydrant.address}</p><small>{[hydrant.manufacturer,hydrant.model,hydrant.notes].filter(Boolean).join(" · ")}</small><EditableRecord departmentId={departmentId} recordType="hydrant" recordId={hydrant.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"hydrant_number",label:"Hydrant number",value:hydrant.hydrant_number},{name:"address",label:"Address",value:hydrant.address},{name:"service_status",label:"Status",value:hydrant.service_status},{name:"manufacturer",label:"Manufacturer",value:hydrant.manufacturer},{name:"model",label:"Model",value:hydrant.model},{name:"notes",label:"Notes",value:hydrant.notes,multiline:true}]}/></article>)}</div> : <Empty title="No Stickney hydrants are stored" text="The source currently has zero field-hydrant records. Nothing was deleted during this connection."/>}</section>;
}

function Fleet({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const apparatus = data.apparatus ?? [];
  const compartments = data.compartments ?? [];
  const photos = data.inventoryPhotos ?? [];
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-section-head"><div><span>APPARATUS</span><h2>Vehicles and apparatus</h2><p>Current profiles from Stickney&apos;s operational inventory.</p></div><b>{apparatus.length}</b></div>{apparatus.length ? <div className="stickney-card-grid apparatus">{apparatus.map((unit) => { const unitCompartments = compartments.filter((item) => item.apparatus_id === unit.id); const unitPhotos = photos.filter((item) => item.apparatus_id === unit.id); return <article key={unit.id}>{unitPhotos[0] ? <img className="stickney-apparatus-photo" src={`/api/departments/${departmentId}/stickney-inventory-photo/${unitPhotos[0].id}`} alt={`${unit.name} inventory view`}/> : null}<span>{unit.asset_type || "Apparatus"}</span><h3>{unit.name}</h3><p>{[unit.year,unit.manufacturer,unit.model].filter(Boolean).join(" ") || "Vehicle details not entered"}</p><dl><div><dt>Compartments</dt><dd>{unitCompartments.length}</dd></div><div><dt>Photos</dt><dd>{unitPhotos.length}</dd></div><div><dt>Weekly due</dt><dd>{unit.weekly_due_day == null ? "Not set" : dayNames[unit.weekly_due_day] || `Day ${unit.weekly_due_day}`}</dd></div></dl><EditableRecord departmentId={departmentId} recordType="apparatus" recordId={unit.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"name",label:"Name",value:unit.name},{name:"asset_type",label:"Asset type",value:unit.asset_type},{name:"manufacturer",label:"Manufacturer",value:unit.manufacturer},{name:"model",label:"Model",value:unit.model},{name:"year",label:"Year",value:unit.year},{name:"weekly_due_day",label:"Weekly due day",value:unit.weekly_due_day}]}/></article>; })}</div> : <Empty title="No apparatus profiles" text="The Stickney inventory source returned no apparatus profiles."/>}</section>;
}

function Inventory({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const apparatus = data.apparatus ?? [];
  const compartments = data.compartments ?? [];
  const items = data.inventory ?? [];
  const photos = data.inventoryPhotos ?? [];
  const unitName = new Map(apparatus.map((item) => [item.id, item.name]));
  const compartmentName = new Map(compartments.map((item) => [item.id, item.label]));
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-section-head"><div><span>INVENTORY</span><h2>Apparatus equipment</h2><p>All active records from the Stickney operational inventory bridge.</p></div><b>{items.length.toLocaleString()}</b></div>{photos.length ? <div className="stickney-photo-gallery">{photos.map((photo) => <figure key={photo.id}><img src={`/api/departments/${departmentId}/stickney-inventory-photo/${photo.id}`} alt={`${unitName.get(photo.apparatus_id) || "Apparatus"} ${photo.view_level} inventory view`}/><figcaption><b>{unitName.get(photo.apparatus_id) || "Apparatus"}</b><span>{[photo.view_level, photo.door_state].filter(Boolean).join(" · ")}</span></figcaption></figure>)}</div> : <div className="stickney-photo-status"><b>No inventory pictures stored</b><span>The source currently has no active inventory photo views.</span></div>}{items.length ? <div className="stickney-table inventory"><table><thead><tr><th>Apparatus</th><th>Compartment</th><th>Item</th><th>Required</th><th>Category</th><th>Identification</th><th>Edit</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{unitName.get(item.apparatus_id) || "Unknown unit"}</td><td>{item.compartment_id ? compartmentName.get(item.compartment_id) || "Unlabeled" : "Not assigned"}</td><td><b>{item.name}</b><small>{[item.manufacturer,item.model].filter(Boolean).join(" ")}</small></td><td>{item.quantity_required}</td><td>{item.equipment_category || (item.check_types ?? []).join(", ") || "Uncategorized"}</td><td>{item.serial_number || item.barcode || "—"}</td><td><EditableRecord departmentId={departmentId} recordType="inventory" recordId={item.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"name",label:"Name",value:item.name},{name:"manufacturer",label:"Manufacturer",value:item.manufacturer},{name:"model",label:"Model",value:item.model},{name:"serial_number",label:"Serial number",value:item.serial_number},{name:"barcode",label:"Barcode",value:item.barcode},{name:"quantity_required",label:"Required quantity",value:item.quantity_required},{name:"equipment_category",label:"Category",value:item.equipment_category}]}/></td></tr>)}</tbody></table></div> : <Empty title="No active inventory" text="The Stickney operational inventory returned no active equipment records."/>}</section>;
}

function Duties({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const duties = data.duties ?? [];
  const grouped = Map.groupBy(duties, (row) => Number(row.day_of_week));
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-section-head"><div><span>DAILY DUTIES</span><h2>Recurring station duties</h2></div><b>{duties.length}</b></div>{duties.length ? <div className="stickney-duty-grid">{[...grouped.entries()].map(([day, rows]) => <article key={day}><h3>{dayNames[day] || `Day ${day}`}</h3>{rows.map((row) => <div key={row.id}><b>{row.shift_key}</b><p>{row.duty || "No duty text entered"}</p><EditableRecord departmentId={departmentId} recordType="duty" recordId={row.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"shift_key",label:"Shift",value:row.shift_key},{name:"duty",label:"Duty",value:row.duty,multiline:true}]}/></div>)}</article>)}</div> : <Empty title="No daily duties" text="The source returned no recurring duty records."/>}</section>;
}

function Documents({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const boxCards = data.boxCards ?? [];
  const policies = data.policies ?? [];
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-section-head"><div><span>DOCUMENTS</span><h2>Policies and box cards</h2></div><b>{boxCards.length + policies.length}</b></div><div className="stickney-document-columns"><section><header><h3>Box cards</h3><b>{boxCards.length}</b></header>{boxCards.map((card) => { const href = documentHref(card.document_url); return <article key={card.id}><span>{card.department || "Stickney"}{card.box_number ? ` · Box ${card.box_number}` : ""}</span><h4>{card.title}</h4><p>{card.address}</p>{card.access_notes ? <small>{card.access_notes}</small> : null}{href ? <a href={href} target="_blank" rel="noreferrer">Open document{card.document_page ? ` · page ${card.document_page}` : ""}</a> : <em>Document file not linked</em>}<EditableRecord departmentId={departmentId} recordType="box_card" recordId={card.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"title",label:"Title",value:card.title},{name:"address",label:"Address",value:card.address},{name:"box_number",label:"Box number",value:card.box_number},{name:"access_notes",label:"Access notes",value:card.access_notes,multiline:true},{name:"details",label:"Details",value:card.details,multiline:true}]}/></article>; })}</section><section><header><h3>Policies</h3><b>{policies.length}</b></header>{policies.map((policy) => <details key={policy.id}><summary><span>{[policy.policy_number,policy.category].filter(Boolean).join(" · ")}</span><b>{policy.title}</b></summary><p>{policy.body || "No policy body was imported."}</p><small>{policy.effective_date ? `Effective ${formatDate(policy.effective_date)}` : "Effective date not entered"}</small><EditableRecord departmentId={departmentId} recordType="policy" recordId={policy.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"title",label:"Title",value:policy.title},{name:"policy_number",label:"Policy number",value:policy.policy_number},{name:"category",label:"Category",value:policy.category},{name:"effective_date",label:"Effective date",value:policy.effective_date},{name:"body",label:"Policy body",value:policy.body,multiline:true}]}/></details>)}</section></div></section>;
}

function Phones({ departmentId, data, editable, supportSessionId }: { departmentId: string; data: StickneyModuleData; editable: boolean; supportSessionId: string }) {
  const rows = data.phoneNumbers ?? [];
  return <section className="stickney-panel"><SourceNotice/><div className="stickney-section-head"><div><span>IMPORTANT NUMBERS</span><h2>Department phone directory</h2></div><b>{rows.length}</b></div>{rows.length ? <div className="stickney-phone-grid">{rows.map((row) => <article key={row.id}><span>{row.category}</span><h3>{row.name}</h3><div>{row.emergency_number ? <a href={`tel:${row.emergency_number.replace(/[^\d+]/g, "")}`}><small>Emergency</small><b>{row.emergency_number}</b></a> : null}{row.non_emergency_number ? <a href={`tel:${row.non_emergency_number.replace(/[^\d+]/g, "")}`}><small>Non-emergency</small><b>{row.non_emergency_number}</b></a> : null}</div>{row.notes ? <p>{row.notes}</p> : null}<EditableRecord departmentId={departmentId} recordType="phone" recordId={row.id} editable={editable} supportSessionId={supportSessionId} fields={[{name:"category",label:"Category",value:row.category},{name:"name",label:"Name",value:row.name},{name:"emergency_number",label:"Emergency number",value:row.emergency_number},{name:"non_emergency_number",label:"Non-emergency number",value:row.non_emergency_number},{name:"notes",label:"Notes",value:row.notes,multiline:true}]}/></article>)}</div> : <Empty title="No important phone numbers" text="The source phone directory is empty."/>}</section>;
}
