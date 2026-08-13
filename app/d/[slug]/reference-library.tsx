import type { Department, DepartmentHydrant, DepartmentPreplan, SharedHydrant, SharedPreplan } from "@/db/access";

type Props = {
  kind: "preplans" | "hydrants";
  department: Department;
  editable: boolean;
  supportSessionId: string;
  ownPreplans: DepartmentPreplan[];
  sharedPreplans: SharedPreplan[];
  ownHydrants: DepartmentHydrant[];
  sharedHydrants: SharedHydrant[];
};

function PrivacyBanner() {
  return <div className="reference-boundary"><b>Mutual-aid view only</b><span>Other departments see only records explicitly published for mutual aid. Internal notes, department files, staffing, schedules, incidents, and every other module remain private.</span></div>;
}

function Visibility({ value }: { value: string }) {
  return <span className={`reference-visibility ${value === "mutual_aid" ? "shared" : "private"}`}>{value === "mutual_aid" ? "Shared view-only" : "Department only"}</span>;
}

export default function ReferenceLibrary(props: Props) {
  const isPreplans = props.kind === "preplans";
  return <div className="reference-workspace">
    <PrivacyBanner/>
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
  return <details className="reference-create"><summary>+ Add preplan</summary><form method="post" action={`/api/departments/${department.id}/preplans`}><input type="hidden" name="support_session_id" value={supportSessionId}/><label>Property name<input required name="property_name" maxLength={160}/></label><label>Address<input required name="address" maxLength={240}/></label><label className="wide">Operational summary shared with responders<textarea name="operational_summary" maxLength={2000}/></label><label className="wide private-field">Internal department notes<textarea name="internal_notes" maxLength={3000}/><small>Never included in mutual-aid results.</small></label><label>Last reviewed<input type="date" name="last_reviewed"/></label><label className="share-check"><input type="checkbox" name="mutual_aid" value="yes"/> Publish safe fields as shared view-only</label><button type="submit">Save preplan</button></form></details>;
}

function HydrantCreate({ department, supportSessionId }: { department: Department; supportSessionId: string }) {
  return <details className="reference-create"><summary>+ Add hydrant</summary><form method="post" action={`/api/departments/${department.id}/hydrants`}><input type="hidden" name="support_session_id" value={supportSessionId}/><label>Hydrant number<input required name="hydrant_number" maxLength={80}/></label><label>Location<input required name="location" maxLength={240}/></label><label>Latitude<input inputMode="decimal" name="latitude"/></label><label>Longitude<input inputMode="decimal" name="longitude"/></label><label>Flow GPM<input inputMode="numeric" min="0" type="number" name="flow_gpm"/></label><label>Status<select name="status"><option value="in_service">In service</option><option value="out_of_service">Out of service</option></select></label><label className="wide">Operational notes shared with responders<textarea name="operational_notes" maxLength={2000}/></label><label className="wide private-field">Internal department notes<textarea name="internal_notes" maxLength={3000}/><small>Never included in mutual-aid results.</small></label><label>Last inspected<input type="date" name="last_inspected"/></label><label className="share-check"><input type="checkbox" name="mutual_aid" value="yes"/> Publish safe fields as shared view-only</label><button type="submit">Save hydrant</button></form></details>;
}

function OwnPreplan({ record, department, editable, supportSessionId }: { record: DepartmentPreplan; department: Department; editable: boolean; supportSessionId: string }) {
  return <article className="reference-card"><div className="reference-card-top"><div><b>{record.property_name}</b><span>{record.address}</span></div><Visibility value={record.visibility}/></div>{record.operational_summary ? <p>{record.operational_summary}</p> : null}{record.internal_notes ? <div className="reference-internal"><b>Internal</b>{record.internal_notes}</div> : null}<footer><span>{record.last_reviewed ? `Reviewed ${record.last_reviewed}` : "Review date not set"}</span>{editable ? <ShareForm action={`/api/departments/${department.id}/preplans/${record.id}`} visibility={record.visibility} supportSessionId={supportSessionId}/> : null}</footer></article>;
}

function OwnHydrant({ record, department, editable, supportSessionId }: { record: DepartmentHydrant; department: Department; editable: boolean; supportSessionId: string }) {
  return <article className="reference-card"><div className="reference-card-top"><div><b>{record.hydrant_number}</b><span>{record.location}</span></div><Visibility value={record.visibility}/></div><div className="reference-facts"><span>{record.status.replaceAll("_", " ")}</span><span>{record.flow_gpm == null ? "Flow not recorded" : `${record.flow_gpm.toLocaleString()} GPM`}</span>{record.latitude && record.longitude ? <span>{record.latitude}, {record.longitude}</span> : null}</div>{record.operational_notes ? <p>{record.operational_notes}</p> : null}{record.internal_notes ? <div className="reference-internal"><b>Internal</b>{record.internal_notes}</div> : null}<footer><span>{record.last_inspected ? `Inspected ${record.last_inspected}` : "Inspection date not set"}</span>{editable ? <ShareForm action={`/api/departments/${department.id}/hydrants/${record.id}`} visibility={record.visibility} supportSessionId={supportSessionId}/> : null}</footer></article>;
}

function SharedPreplanCard({ record }: { record: SharedPreplan }) {
  return <article className="reference-card external"><div className="reference-card-top"><div><small>{record.department_name}</small><b>{record.property_name}</b><span>{record.address}</span></div><span className="view-only-lock">View only</span></div>{record.operational_summary ? <p>{record.operational_summary}</p> : <p className="reference-muted">No operational summary was published.</p>}<footer><span>{record.last_reviewed ? `Reviewed ${record.last_reviewed}` : "Review date not published"}</span></footer></article>;
}

function SharedHydrantCard({ record }: { record: SharedHydrant }) {
  return <article className="reference-card external"><div className="reference-card-top"><div><small>{record.department_name}</small><b>{record.hydrant_number}</b><span>{record.location}</span></div><span className="view-only-lock">View only</span></div><div className="reference-facts"><span>{record.status.replaceAll("_", " ")}</span><span>{record.flow_gpm == null ? "Flow not published" : `${record.flow_gpm.toLocaleString()} GPM`}</span>{record.latitude && record.longitude ? <span>{record.latitude}, {record.longitude}</span> : null}</div>{record.operational_notes ? <p>{record.operational_notes}</p> : <p className="reference-muted">No operational notes were published.</p>}<footer><span>{record.last_inspected ? `Inspected ${record.last_inspected}` : "Inspection date not published"}</span></footer></article>;
}

function ShareForm({ action, visibility, supportSessionId }: { action: string; visibility: string; supportSessionId: string }) {
  const sharing = visibility === "mutual_aid";
  return <form className="reference-share-form" method="post" action={action}><input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="visibility" value={sharing ? "department_only" : "mutual_aid"}/><button type="submit">{sharing ? "Stop sharing" : "Share view-only"}</button></form>;
}

function ReferenceEmpty({ text }: { text: string }) {
  return <div className="reference-empty"><b>No shared record</b><span>{text}</span></div>;
}
