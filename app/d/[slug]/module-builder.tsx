import type { DepartmentModuleData, DepartmentModuleItem } from "@/db/access";
import RespondCadNotes from "./respond-cad-notes";

const defaults = {
  "live-ops": {
    heading: "Live Operations board",
    description: "Create the manual operational view your department needs now. A live CAD feed will only be shown after it is securely connected and verified.",
    instructions: "Add active incidents, apparatus status, station notices, and resources below.",
  },
  respond: {
    heading: "Response workspace",
    description: "Build department-approved response notes and resources without inventing or exposing incident data.",
    instructions: "Add response resources, staging guidance, contacts, or other authorized information below.",
  },
} as const;

type ModuleKey = keyof typeof defaults;

export default function ModuleBuilder({ moduleKey, moduleName, departmentId, data, editable, supportSessionId, recordManagerOnly = false }: { moduleKey: ModuleKey; moduleName: string; departmentId: string; data: DepartmentModuleData; editable: boolean; supportSessionId: string; recordManagerOnly?: boolean }) {
  const fallback = defaults[moduleKey];
  const heading = data.config?.heading || fallback.heading;
  const description = data.config?.description || fallback.description;
  const instructions = data.config?.instructions || fallback.instructions;
  const action = `/api/departments/${departmentId}/modules/${moduleKey}`;
  const controlId = `module-builder-${moduleKey}`;

  if (moduleKey === "respond" && !recordManagerOnly) return <RespondWorkspace departmentId={departmentId} moduleName={moduleName} heading={heading} description={description} instructions={instructions} action={action} data={data} editable={editable} supportSessionId={supportSessionId}/>;

  return <section className={`module-builder${recordManagerOnly ? " record-manager" : ""}`}>
    {!recordManagerOnly ? <header className="module-builder-intro"><div><span className="dept-section-label">{moduleName.toUpperCase()}</span><h2>{heading}</h2><p>{description}</p>{instructions ? <small>{instructions}</small> : null}</div><div className="module-connection-state"><i/>Manual workspace</div></header> : null}
    {data.items.length ? <div className="module-item-grid">{data.items.map((item) => <ModuleItem key={item.id} item={item} editable={editable} action={action} supportSessionId={supportSessionId}/>)}</div> : <div className="module-blank-state"><b>No department entries yet.</b><span>{editable ? "Use the build control below to add the first real entry." : "An authorized owner or editor can build this module."}</span></div>}
    {editable ? <section className="module-build-control">
      <input className="module-build-checkbox" id={controlId} type="checkbox"/>
      <label className="module-build-toggle" htmlFor={controlId}><span className="module-build-plus">+</span><span><b>{recordManagerOnly ? "Add or edit board records" : "Build this module"}</b><small>{recordManagerOnly ? "Manage real incidents, apparatus status, station notices, and resources" : "Configure the workspace and add real operational entries"}</small></span></label>
      <div className="module-build-panels">
        <form method="post" action={action} className="module-build-form">
          <input type="hidden" name="action" value="save_config"/><input type="hidden" name="support_session_id" value={supportSessionId}/>
          <h3>Workspace setup</h3>
          <label>Heading<input required name="heading" maxLength={160} defaultValue={heading}/></label>
          <label>Description<textarea name="description" maxLength={1500} rows={4} defaultValue={description}/></label>
          <label>Department instructions<textarea name="instructions" maxLength={3000} rows={4} defaultValue={instructions}/></label>
          <button type="submit">Save workspace</button>
        </form>
        <ModuleItemForm action={action} supportSessionId={supportSessionId}/>
      </div>
    </section> : null}
  </section>;
}

function RespondWorkspace({ departmentId, moduleName, heading, description, instructions, action, data, editable, supportSessionId }: { departmentId: string; moduleName: string; heading: string; description: string; instructions: string; action: string; data: DepartmentModuleData; editable: boolean; supportSessionId: string }) {
  const activeIncident = data.items.find((item) => item.item_type === "incident" && item.operational_status === "active");
  const incidents = data.items.filter((item) => item.item_type === "incident");
  const apparatus = data.items.filter((item) => item.item_type === "apparatus");
  const resources = data.items.filter((item) => item.item_type === "resource");
  const guidance = data.items.filter((item) => item.item_type === "station" || item.item_type === "notice");
  return <section className={`respond-department-workspace${activeIncident ? " incident-active" : " standby"}`}>
    <header className="respond-department-status"><div><span className="dept-section-label">{moduleName.toUpperCase()}</span><h2>{heading}</h2><p>{description}</p></div><div className={`respond-source-state${activeIncident ? " active" : ""}`}><i/><span><b>{activeIncident ? "Department incident active" : "No active incident"}</b><small>Manual records · CAD not connected</small></span></div></header>
    <div className="respond-department-grid">
      <RespondPanel label="Dispatch" title={activeIncident?.title || "No active incident"} tone={activeIncident ? "danger" : "warning"} items={activeIncident ? [activeIncident] : incidents.filter((item) => item.operational_status !== "closed")} empty="No live incident feed is connected. Authorized users can add a verified incident record."/>
      <RespondPanel label="Preplan intelligence" title={`${resources.length} connected record${resources.length === 1 ? "" : "s"}`} tone="ready" items={resources} empty="No department-approved preplan, building systems, water-supply, or response resource is linked yet."/>
      <RespondPanel label="Apparatus response" title={`${apparatus.filter((item) => item.operational_status !== "offline").length} available record${apparatus.length === 1 ? "" : "s"}`} tone={apparatus.some((item) => item.operational_status === "attention" || item.operational_status === "offline") ? "danger" : "ready"} items={apparatus} empty="No apparatus response status has been entered."/>
      <RespondPanel label="Staging and guidance" title={`${guidance.length} department entr${guidance.length === 1 ? "y" : "ies"}`} tone="information" items={guidance} empty="No verified staging note, contact, or department guidance has been entered."/>
      <DepartmentRespondContext departmentId={departmentId} activeIncident={activeIncident} incidents={incidents} resources={resources}/>
    </div>
    {instructions ? <div className="respond-department-note"><b>Department instructions</b><span>{instructions}</span></div> : null}
    {editable ? <details className="respond-department-manage"><summary><span className="module-build-plus">+</span><span><b>Configure Respond and manage records</b><small>Changes are saved only to this department workspace.</small></span></summary><div className="module-build-panels">
      <form method="post" action={action} className="module-build-form"><input type="hidden" name="action" value="save_config"/><input type="hidden" name="support_session_id" value={supportSessionId}/><h3>Workspace setup</h3><label>Heading<input required name="heading" maxLength={160} defaultValue={heading}/></label><label>Description<textarea name="description" maxLength={1500} rows={4} defaultValue={description}/></label><label>Department instructions<textarea name="instructions" maxLength={3000} rows={4} defaultValue={instructions}/></label><button type="submit">Save workspace</button></form>
      <ModuleItemForm action={action} supportSessionId={supportSessionId}/>
      {data.items.length ? <div className="respond-record-manager"><h3>Edit existing records</h3>{data.items.map((item) => <ModuleItem key={item.id} item={item} editable action={action} supportSessionId={supportSessionId}/>)}</div> : null}
    </div></details> : null}
  </section>;
}

function DepartmentRespondContext({ departmentId, activeIncident, incidents, resources }: { departmentId: string; activeIncident?: DepartmentModuleItem; incidents: DepartmentModuleItem[]; resources: DepartmentModuleItem[] }) {
  const currentLocation = activeIncident?.location || "";
  const exactHistory = currentLocation ? incidents.filter((item) => item.id !== activeIncident?.id && normalizeLocation(item.location) === normalizeLocation(currentLocation)) : [];
  const currentArea = areaLocationKey(currentLocation);
  const areaHistory = currentArea ? incidents.filter((item) => item.id !== activeIncident?.id && normalizeLocation(item.location) !== normalizeLocation(currentLocation) && areaLocationKey(item.location) === currentArea) : [];
  const aSideResource = resources.find((item) => /\ba[\s-]?side\b/i.test(item.title) && /photo|image|view/i.test(item.title));
  const aSideLink = safeLink(aSideResource?.link_url || "");
  const streetViewLink = currentLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentLocation)}` : "";
  return <section className="respond-department-context">
    <header><span>Incident context</span><b>A-side → CAD notes → exact history → area history</b></header>
    <div className="respond-context-grid">
      <article className="respond-context-media"><ContextLabel label="A-side view" value={aSideLink ? "Saved image" : "Street View fallback"}/><div className={`respond-aside-view${aSideLink ? " saved" : ""}`} style={aSideLink ? { backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(4, 9, 14, .85)), url(${JSON.stringify(aSideLink)})` } : undefined}><span>A</span><div><b>{aSideLink ? "Saved department A-side image" : "No saved A-side photo"}</b><small>{aSideLink ? "Confirm image date and building before use." : currentLocation ? "Locate the incident address, then open the available panorama." : "An active incident location is required for the fallback."}</small></div>{aSideLink ? <a href={aSideLink} target="_blank" rel="noreferrer">Open image</a> : streetViewLink ? <a href={streetViewLink} target="_blank" rel="noreferrer">Locate for Street View</a> : null}</div></article>
      <RespondCadNotes departmentId={departmentId} address={currentLocation} fallback={activeIncident?.summary || "No current CAD notes are available. CAD is not connected; an authorized user may enter a verified incident note."}/>
      <article><ContextLabel label="Exact-address history" value={`${exactHistory.length} found`}/><DepartmentHistoryRows items={exactHistory} empty="No prior incident at this exact saved address."/></article>
      <article><ContextLabel label="Area history" value={`${areaHistory.length} same-street`}/><DepartmentHistoryRows items={areaHistory} empty="No other incident on this saved street."/></article>
    </div>
  </section>;
}

function ContextLabel({ label, value }: { label: string; value: string }) {
  return <div className="respond-context-label"><span>{label}</span><b>{value}</b></div>;
}

function DepartmentHistoryRows({ items, empty }: { items: DepartmentModuleItem[]; empty: string }) {
  return items.length ? <div className="respond-context-history">{items.slice(0, 2).map((item) => <div key={item.id}><b>{item.title}</b><small>{item.location || "Location not entered"} · {item.operational_status}</small></div>)}</div> : <p className="respond-context-empty">{empty}</p>;
}

function RespondPanel({ label, title, tone, items, empty }: { label: string; title: string; tone: "ready" | "warning" | "danger" | "information"; items: DepartmentModuleItem[]; empty: string }) {
  return <article className={`respond-department-panel ${tone}`}><header><span>{label}</span><b>{items.length ? `${items.length} saved` : "Truthful empty state"}</b></header><h3>{title}</h3>{items.length ? <div className="respond-department-list">{items.slice(0, 3).map((item) => { const link = safeLink(item.link_url); return <div key={item.id}><span><b>{item.title}</b><small>{item.location || item.summary || item.contact || "No additional details entered."}</small></span><em>{item.operational_status}</em>{link ? <a href={link} target="_blank" rel="noreferrer">Open</a> : null}</div>; })}{items.length > 3 ? <small className="respond-more-count">+{items.length - 3} more saved in Manage records</small> : null}</div> : <p>{empty}</p>}</article>;
}

function ModuleItem({ item, editable, action, supportSessionId }: { item: DepartmentModuleItem; editable: boolean; action: string; supportSessionId: string }) {
  const link = safeLink(item.link_url);
  return <article className={`module-item status-${item.operational_status}`}><header><span>{item.item_type}</span><b>{item.operational_status}</b></header><h3>{item.title}</h3>{item.summary ? <p>{item.summary}</p> : null}<dl>{item.location ? <><dt>Location</dt><dd>{item.location}</dd></> : null}{item.contact ? <><dt>Contact</dt><dd>{item.contact}</dd></> : null}</dl>{link ? <a href={link} target="_blank" rel="noreferrer">Open resource</a> : null}{editable ? <details className="module-item-editor"><summary>Edit entry</summary><ModuleItemForm action={action} supportSessionId={supportSessionId} item={item}/><form method="post" action={action} className="module-archive-form"><input type="hidden" name="action" value="archive_item"/><input type="hidden" name="item_id" value={item.id}/><input type="hidden" name="support_session_id" value={supportSessionId}/><button type="submit">Archive entry</button></form></details> : null}</article>;
}

function ModuleItemForm({ action, supportSessionId, item }: { action: string; supportSessionId: string; item?: DepartmentModuleItem }) {
  return <form method="post" action={action} className="module-build-form module-item-form">
    <input type="hidden" name="action" value="save_item"/><input type="hidden" name="support_session_id" value={supportSessionId}/>{item ? <input type="hidden" name="item_id" value={item.id}/> : null}
    <h3>{item ? "Edit entry" : "Add an entry"}</h3>
    <label>Title<input required name="title" maxLength={200} defaultValue={item?.title}/></label>
    <div className="module-form-row"><label>Type<select name="item_type" defaultValue={item?.item_type || "notice"}><option value="incident">Incident</option><option value="apparatus">Apparatus</option><option value="station">Station</option><option value="notice">Notice</option><option value="resource">Resource</option></select></label><label>Status<select name="operational_status" defaultValue={item?.operational_status || "ready"}><option value="active">Active</option><option value="ready">Ready</option><option value="attention">Needs attention</option><option value="closed">Closed</option><option value="offline">Offline</option><option value="draft">Draft</option></select></label></div>
    <label>Details<textarea name="summary" maxLength={5000} rows={4} defaultValue={item?.summary}/></label>
    <div className="module-form-row"><label>Location<input name="location" maxLength={300} defaultValue={item?.location}/></label><label>Contact<input name="contact" maxLength={300} defaultValue={item?.contact}/></label></div>
    <div className="module-form-row"><label>Resource link / A-side image URL<input name="link_url" type="url" maxLength={1000} placeholder="https://" defaultValue={item?.link_url}/></label><label>Order<input name="sort_order" type="number" min={-9999} max={9999} defaultValue={item?.sort_order ?? 0}/></label></div>
    <button type="submit">{item ? "Save entry" : "Add entry"}</button>
  </form>;
}

function safeLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""; } catch { return ""; }
}

function normalizeLocation(value?: string | null) {
  return String(value || "").toLowerCase().replace(/\b(street)\b/g, "st").replace(/\b(avenue)\b/g, "ave").replace(/\b(road)\b/g, "rd").replace(/\b(drive)\b/g, "dr").replace(/[^a-z0-9]+/g, " ").trim();
}

function areaLocationKey(value?: string | null) {
  const parts = normalizeLocation(value).split(" ").filter(Boolean);
  if (parts.length && /^\d+$/.test(parts[0])) parts.shift();
  return parts.slice(0, 2).join(" ");
}
