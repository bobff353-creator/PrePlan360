import type { DepartmentModuleData, DepartmentModuleItem } from "@/db/access";

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
    <div className="module-form-row"><label>Resource link<input name="link_url" type="url" maxLength={1000} placeholder="https://" defaultValue={item?.link_url}/></label><label>Order<input name="sort_order" type="number" min={-9999} max={9999} defaultValue={item?.sort_order ?? 0}/></label></div>
    <button type="submit">{item ? "Save entry" : "Add entry"}</button>
  </form>;
}

function safeLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""; } catch { return ""; }
}
