import type { Department, DepartmentHydrant, DepartmentPreplan, SharedHydrant, SharedPreplan } from "@/db/access";
import PreplanMap, { type MapHydrant, type MapPoint, type MapPreplan } from "./preplan-map";

type Props = {
  kind: "preplans" | "hydrants";
  department: Department;
  editable: boolean;
  supportSessionId: string;
  ownPreplans: DepartmentPreplan[];
  sharedPreplans: SharedPreplan[];
  ownHydrants: DepartmentHydrant[];
  sharedHydrants: SharedHydrant[];
  showMap?: boolean;
};

function PrivacyBanner() {
  return <div className="reference-boundary"><b>Mutual-aid view only</b><span>Other departments see only records explicitly published for mutual aid. Internal notes, department files, staffing, schedules, incidents, and every other module remain private.</span></div>;
}

function Visibility({ value }: { value: string }) {
  return <span className={`reference-visibility ${value === "mutual_aid" ? "shared" : "private"}`}>{value === "mutual_aid" ? "Shared view-only" : "Department only"}</span>;
}

function numberOrNull(value: string) {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) ? parsed : null;
}

function footprint(value: string): MapPoint[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng)).map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })) : [];
  } catch {
    return [];
  }
}

function footprintText(value: string) {
  return footprint(value).map((point) => `${point.lat}, ${point.lng}`).join("\n");
}

export default function ReferenceLibrary(props: Props) {
  const isPreplans = props.kind === "preplans";
  const mapPreplans: MapPreplan[] = [...props.ownPreplans.map((record) => ({ id: `own-${record.id}`, name: record.property_name, address: record.address, latitude: numberOrNull(record.latitude), longitude: numberOrNull(record.longitude), footprint: footprint(record.footprint_json), targetId: `preplan-${record.id}` })), ...props.sharedPreplans.map((record) => ({ id: `shared-${record.id}`, name: record.property_name, address: record.address, latitude: numberOrNull(record.latitude), longitude: numberOrNull(record.longitude), footprint: footprint(record.footprint_json), targetId: `shared-preplan-${record.id}`, sourceLabel: record.department_name }))];
  const mapHydrants: MapHydrant[] = [...props.ownHydrants.map((record) => ({ id: `own-${record.id}`, name: record.hydrant_number, location: record.location, latitude: numberOrNull(record.latitude), longitude: numberOrNull(record.longitude), status: record.status, targetId: `hydrant-${record.id}` })), ...props.sharedHydrants.map((record) => ({ id: `shared-${record.id}`, name: record.hydrant_number, location: record.location, latitude: numberOrNull(record.latitude), longitude: numberOrNull(record.longitude), status: record.status, targetId: `shared-hydrant-${record.id}` }))];
  return <div className="reference-workspace">
    <PrivacyBanner/>
    {props.showMap !== false ? <PreplanMap departmentSlug={props.department.slug} preplans={mapPreplans} hydrants={mapHydrants}/> : null}
    <div className="reference-columns">
      <section className="reference-panel"><div className="reference-panel-head"><div><span>YOUR DEPARTMENT</span><h2>{isPreplans ? "Preplan records" : "Hydrant records"}</h2></div><b>{isPreplans ? props.ownPreplans.length : props.ownHydrants.length}</b></div>
        {props.editable ? isPreplans ? <PreplanCreate department={props.department} supportSessionId={props.supportSessionId}/> : <HydrantCreate department={props.department} supportSessionId={props.supportSessionId}/> : <div className="reference-readonly-note">Department members can view records. Only authorized administrators can add records or change sharing.</div>}
        <div className="reference-list">{isPreplans ? props.ownPreplans.length ? props.ownPreplans.map((record) => <OwnPreplan key={record.id} record={record} department={props.department} editable={props.editable} supportSessionId={props.supportSessionId}/>) : <ReferenceEmpty text="No preplans have been added to this department."/> : props.ownHydrants.length ? props.ownHydrants.map((record) => <OwnHydrant key={record.id} record={record} department={props.department} editable={props.editable} supportSessionId={props.supportSessionId}/>) : <ReferenceEmpty text="No hydrants have been added to this department."/>}</div>
      </section>
      <section className="reference-panel shared-library"><div className="reference-panel-head"><div><span>MUTUAL AID</span><h2>Shared by other departments</h2></div><b>{isPreplans ? props.sharedPreplans.length : props.sharedHydrants.length}</b></div><div className="reference-readonly-note locked">Viewing is enforced server-side. No add, edit, share, unshare, or delete action is available for another department&apos;s record.</div>
        <div className="reference-list">{isPreplans ? props.sharedPreplans.length ? props.sharedPreplans.map((record) => <SharedPreplanCard key={record.id} record={record}/>) : <ReferenceEmpty text="No other department has published a preplan for mutual-aid viewing."/> : props.sharedHydrants.length ? props.sharedHydrants.map((record) => <SharedHydrantCard key={record.id} record={record}/>) : <ReferenceEmpty text="No other department has published a hydrant for mutual-aid viewing."/>}</div>
      </section>
    </div>
  </div>;
}

function PreplanCreate({ department, supportSessionId }: { department: Department; supportSessionId: string }) {
  return <details className="reference-create"><summary>+ Add preplan</summary><form method="post" action={`/api/departments/${department.id}/preplans`}><input type="hidden" name="support_session_id" value={supportSessionId}/><label>Property name<input required name="property_name" maxLength={160}/></label><label>Address<input required name="address" maxLength={240}/></label><label>Verified latitude<input inputMode="decimal" name="latitude" placeholder="41.000000"/></label><label>Verified longitude<input inputMode="decimal" name="longitude" placeholder="-87.000000"/></label><label className="wide">Building footprint coordinates<textarea name="footprint" maxLength={4000} placeholder={"One verified latitude, longitude pair per line\n41.000100, -87.000100\n41.000100, -87.000000\n41.000000, -87.000000"}/><small>Optional. At least three verified corners are required before a footprint is highlighted.</small></label><label className="wide">Operational summary shared with responders<textarea name="operational_summary" maxLength={2000}/></label><label className="wide private-field">Internal department notes<textarea name="internal_notes" maxLength={3000}/><small>Never included in mutual-aid results.</small></label><label>Last reviewed<input type="date" name="last_reviewed"/></label><label className="share-check"><input type="checkbox" name="mutual_aid" value="yes"/> Publish safe fields as shared view-only</label><button type="submit">Save preplan</button></form></details>;
}

function HydrantCreate({ department, supportSessionId }: { department: Department; supportSessionId: string }) {
  return <details className="reference-create"><summary>+ Add hydrant</summary><form method="post" action={`/api/departments/${department.id}/hydrants`}><input type="hidden" name="support_session_id" value={supportSessionId}/><label>Hydrant number<input required name="hydrant_number" maxLength={80}/></label><label>Location<input required name="location" maxLength={240}/></label><label>Latitude<input inputMode="decimal" name="latitude"/></label><label>Longitude<input inputMode="decimal" name="longitude"/></label><label>Flow GPM<input inputMode="numeric" min="0" type="number" name="flow_gpm"/></label><label>Status<select name="status"><option value="in_service">In service</option><option value="out_of_service">Out of service</option></select></label><label className="wide">Operational notes shared with responders<textarea name="operational_notes" maxLength={2000}/></label><label className="wide private-field">Internal department notes<textarea name="internal_notes" maxLength={3000}/><small>Never included in mutual-aid results.</small></label><label>Last inspected<input type="date" name="last_inspected"/></label><label className="share-check"><input type="checkbox" name="mutual_aid" value="yes"/> Publish safe fields as shared view-only</label><button type="submit">Save hydrant</button></form></details>;
}

function OwnPreplan({ record, department, editable, supportSessionId }: { record: DepartmentPreplan; department: Department; editable: boolean; supportSessionId: string }) {
  const points = footprint(record.footprint_json);
  return <details className="reference-card reference-preplan-card" id={`preplan-${record.id}`}><summary><div className="reference-card-top"><div><b>{record.property_name}</b><span>{record.address}</span></div><Visibility value={record.visibility}/></div><div className="reference-facts"><span>{record.latitude && record.longitude ? points.length >= 3 ? "Mapped footprint" : "Location only" : "Not mapped"}</span><span>Open building</span></div></summary><div className="reference-card-body">{record.operational_summary ? <p>{record.operational_summary}</p> : null}{record.internal_notes ? <div className="reference-internal"><b>Internal</b>{record.internal_notes}</div> : null}{editable ? <details className="reference-map-edit"><summary>Edit map location</summary><form method="post" action={`/api/departments/${department.id}/preplans/${record.id}`}><input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="mode" value="map"/><label>Verified latitude<input inputMode="decimal" name="latitude" defaultValue={record.latitude}/></label><label>Verified longitude<input inputMode="decimal" name="longitude" defaultValue={record.longitude}/></label><label className="wide">Footprint corners<textarea name="footprint" defaultValue={footprintText(record.footprint_json)} placeholder="One latitude, longitude pair per line"/></label><button type="submit">Save map</button></form></details> : null}<footer><span>{record.last_reviewed ? `Reviewed ${record.last_reviewed}` : "Review date not set"}</span>{editable ? <ShareForm action={`/api/departments/${department.id}/preplans/${record.id}`} visibility={record.visibility} supportSessionId={supportSessionId}/> : null}</footer></div></details>;
}

function OwnHydrant({ record, department, editable, supportSessionId }: { record: DepartmentHydrant; department: Department; editable: boolean; supportSessionId: string }) {
  return <article className="reference-card" id={`hydrant-${record.id}`}><div className="reference-card-top"><div><b>{record.hydrant_number}</b><span>{record.location}</span></div><Visibility value={record.visibility}/></div><div className="reference-facts"><span>{record.status.replaceAll("_", " ")}</span><span>{record.flow_gpm == null ? "Flow not recorded" : `${record.flow_gpm.toLocaleString()} GPM`}</span>{record.latitude && record.longitude ? <span>{record.latitude}, {record.longitude}</span> : null}</div>{record.operational_notes ? <p>{record.operational_notes}</p> : null}{record.internal_notes ? <div className="reference-internal"><b>Internal</b>{record.internal_notes}</div> : null}<footer><span>{record.last_inspected ? `Inspected ${record.last_inspected}` : "Inspection date not set"}</span>{editable ? <ShareForm action={`/api/departments/${department.id}/hydrants/${record.id}`} visibility={record.visibility} supportSessionId={supportSessionId}/> : null}</footer></article>;
}

function SharedPreplanCard({ record }: { record: SharedPreplan }) {
  const points = footprint(record.footprint_json);
  return <details className="reference-card reference-preplan-card external" id={`shared-preplan-${record.id}`}><summary><div className="reference-card-top"><div><small>{record.department_name}</small><b>{record.property_name}</b><span>{record.address}</span></div><span className="view-only-lock">View only</span></div><div className="reference-facts"><span>{record.latitude && record.longitude ? points.length >= 3 ? "Mapped footprint" : "Location only" : "Not mapped"}</span><span>Open building</span></div></summary><div className="reference-card-body">{record.operational_summary ? <p>{record.operational_summary}</p> : <p className="reference-muted">No operational summary was published.</p>}<footer><span>{record.last_reviewed ? `Reviewed ${record.last_reviewed}` : "Review date not published"}</span></footer></div></details>;
}

function SharedHydrantCard({ record }: { record: SharedHydrant }) {
  return <article className="reference-card external" id={`shared-hydrant-${record.id}`}><div className="reference-card-top"><div><small>{record.department_name}</small><b>{record.hydrant_number}</b><span>{record.location}</span></div><span className="view-only-lock">View only</span></div><div className="reference-facts"><span>{record.status.replaceAll("_", " ")}</span><span>{record.flow_gpm == null ? "Flow not published" : `${record.flow_gpm.toLocaleString()} GPM`}</span>{record.latitude && record.longitude ? <span>{record.latitude}, {record.longitude}</span> : null}</div>{record.operational_notes ? <p>{record.operational_notes}</p> : <p className="reference-muted">No operational notes were published.</p>}<footer><span>{record.last_inspected ? `Inspected ${record.last_inspected}` : "Inspection date not published"}</span></footer></article>;
}

function ShareForm({ action, visibility, supportSessionId }: { action: string; visibility: string; supportSessionId: string }) {
  const sharing = visibility === "mutual_aid";
  return <form className="reference-share-form" method="post" action={action}><input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="visibility" value={sharing ? "department_only" : "mutual_aid"}/><button type="submit">{sharing ? "Stop sharing" : "Share view-only"}</button></form>;
}

function ReferenceEmpty({ text }: { text: string }) {
  return <div className="reference-empty"><b>No shared record</b><span>{text}</span></div>;
}
