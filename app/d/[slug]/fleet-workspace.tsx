"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { StickneyModuleData, StickneyApparatus } from "@/db/stickney";
import {
  type FleetCheckItem,
  type FleetCheckMode,
  type FleetCheckRecord,
  type FleetOverlayResponse,
  type FleetWorkOrderRecord,
  fleetCheckProgress,
  fleetCheckTemplate,
} from "@/app/lib/fleet-checks";

type Props = { departmentId: string; data: StickneyModuleData; sourceName: string; sourceSystem: string; inventoryPhotoRoute: string; editable: boolean; supportSessionId: string };
type View = "assets" | "checks" | "inventory" | "repairs" | "maintenance" | "hose";
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";

export default function FleetWorkspace({ departmentId, data, sourceName, sourceSystem, inventoryPhotoRoute, editable, supportSessionId }: Props) {
  const [view, setView] = useState<View>("checks");
  const [overlays, setOverlays] = useState<FleetOverlayResponse>({ checks: [], workOrders: [] });
  const [overlayState, setOverlayState] = useState<"loading" | "ready" | "error">("loading");
  const apparatus = data.apparatus ?? [];
  const compartments = data.compartments ?? [];
  const inventory = data.inventory ?? [];
  const photos = data.inventoryPhotos ?? [];
  const checks = data.fleetChecks ?? [];
  const exceptions = data.readinessExceptions ?? [];
  const workOrders = data.workOrders ?? [];
  const sources = data.fleetSources ?? { checks: false, readinessExceptions: false, workOrders: false };
  const unitNames = new Map(apparatus.map((unit) => [unit.id, unit.name]));
  useEffect(() => {
    let active = true;
    fetch(`/api/departments/${encodeURIComponent(departmentId)}/fleet-checks`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<FleetOverlayResponse>;
      })
      .then((result) => { if (active) { setOverlays(result); setOverlayState("ready"); } })
      .catch(() => { if (active) setOverlayState("error"); });
    return () => { active = false; };
  }, [departmentId]);
  const openOrders = workOrders.filter((order) => order.status !== "closed");
  const localOpenOrders = overlays.workOrders.filter((order) => order.status !== "closed");
  const checksInProgress = checks.filter((check) => check.status === "in_progress").length + overlays.checks.filter((check) => check.status === "in_progress").length;
  const oos = apparatus.filter((unit) => unit.status === "out_of_service");
  const checkRecordsAvailable = sources.checks || overlayState === "ready";
  const workOrdersAvailable = sources.workOrders || overlayState === "ready";

  return <section className="fleet-foundation">
    <div className="fleet-source"><div><i/><span><b>{sourceName} Apparatus & Logistics</b><small>Real fleet, inspection, inventory, repair, and service records</small></span></div><strong>Source preserved</strong></div>
    <div className="fleet-kpis"><article className={oos.length ? "danger" : ""}><span>Out of service</span><b>{oos.length}</b><small>{oos.length ? oos.map((unit) => unit.name).join(", ") : apparatus.some((unit) => unit.status === "not_recorded") ? "Service status is not connected" : "All units in service"}</small></article><article className={openOrders.length + localOpenOrders.length ? "warning" : ""}><span>Open work orders</span><b className={!workOrdersAvailable ? "text-value" : ""}>{workOrdersAvailable ? openOrders.length + localOpenOrders.length : "Not connected"}</b><small>{workOrdersAvailable ? openOrders.length + localOpenOrders.length ? "Repair records need attention" : "No open repair records" : "No work-order source was found"}</small></article><article className={checksInProgress ? "warning" : ""}><span>Checks in progress</span><b className={!checkRecordsAvailable ? "text-value" : ""}>{checkRecordsAvailable ? checksInProgress : "Not connected"}</b><small>{checkRecordsAvailable ? `${checks.length + overlays.checks.length} saved check records` : "No check source was found"}</small></article><article><span>Hose tests</span><b className="text-value">Not connected</b><small>No hose-testing table was found</small></article></div>
    <div className="fleet-tabs" role="tablist" aria-label="Apparatus and logistics views">{[["assets","Add / Scan Assets"],["checks","Apparatus Checks"],["inventory","Inventory"],["repairs","Repairs / Work Orders"],["maintenance","Maintenance Plan"],["hose","Hose Testing"]].map(([key,text]) => <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key as View)}>{text}</button>)}</div>
    {view === "assets" ? <AssetsView departmentId={departmentId} inventoryPhotoRoute={inventoryPhotoRoute} apparatus={apparatus} compartments={compartments} photos={photos} checks={checks} editable={editable} supportSessionId={supportSessionId}/> : null}
    {view === "checks" ? <ApparatusChecks departmentId={departmentId} apparatus={apparatus} inventory={inventory} sourceChecks={checks} sourceName={sourceName} editable={editable} supportSessionId={supportSessionId} overlays={overlays} overlayState={overlayState} onOverlays={setOverlays}/> : null}
    {view === "inventory" ? <div className="fleet-panel"><header><div><span>APPARATUS INVENTORY</span><h2>Equipment by unit</h2><p>Real active equipment and compartment assignments.</p></div><b>{inventory.length}</b></header>{apparatus.map((unit) => { const items = inventory.filter((item) => item.apparatus_id === unit.id); return <details className="fleet-inventory-unit" key={unit.id}><summary><span><b>{unit.name}</b><small>{unit.asset_type}</small></span><strong>{items.length} items</strong></summary>{items.length ? <div>{items.map((item) => <article key={item.id}><b>{item.name}</b><span>{compartments.find((compartment) => compartment.id === item.compartment_id)?.label || "Not assigned"}</span><small>{item.quantity_required} required · {item.equipment_category || "Equipment"}</small></article>)}</div> : <Empty title="No active equipment" text="No active inventory is assigned to this unit."/>}</details>; })}</div> : null}
    {view === "repairs" ? <RepairWorkspace departmentId={departmentId} sourceName={sourceName} sourceOrders={workOrders} exceptions={exceptions} sourceFlags={sources} unitNames={unitNames} localOrders={overlays.workOrders} editable={editable} supportSessionId={supportSessionId} onOverlays={setOverlays}/> : null}
    {view === "maintenance" ? <div className="fleet-panel"><header><div><span>MAINTENANCE PLAN</span><h2>Verified service information</h2><p>Schedules and manufacturer resources remain unverified until a department user reviews them.</p></div><b>{apparatus.filter((unit) => unit.service_profile_verified_at).length} verified</b></header><div className="fleet-maintenance">{apparatus.map((unit) => <article key={unit.id}><header><div><span>{unit.asset_type}</span><h3>{unit.name}</h3></div><em className={unit.service_profile_verified_at ? "ready" : "warning"}>{unit.service_profile_verified_at ? "Verified" : "Needs review"}</em></header><dl><div><dt>Weekly check</dt><dd>{unit.weekly_due_day == null ? "Not scheduled" : dayNames[unit.weekly_due_day]}</dd></div><div><dt>Service schedule</dt><dd>{unit.maintenance_schedule || "Not entered"}</dd></div><div><dt>Preferred vendor</dt><dd>{unit.preferred_vendor || "Not entered"}</dd></div></dl><div className="fleet-resource-links">{unit.owner_manual_url ? <a href={unit.owner_manual_url} target="_blank" rel="noreferrer">Owner manual</a> : <span>Owner manual not linked</span>}{unit.service_manual_url ? <a href={unit.service_manual_url} target="_blank" rel="noreferrer">Service manual</a> : <span>Service manual not linked</span>}{unit.parts_catalog_url ? <a href={unit.parts_catalog_url} target="_blank" rel="noreferrer">Parts catalog</a> : <span>Parts catalog not linked</span>}</div>{editable ? <details className="fleet-edit"><summary>Edit service profile</summary><ApparatusForm departmentId={departmentId} unit={unit} supportSessionId={supportSessionId}/></details> : null}</article>)}</div></div> : null}
    {view === "hose" ? <div className="fleet-panel"><header><div><span>HOSE TESTING</span><h2>NFPA hose-testing workspace</h2><p>No hose-testing dataset is connected to this {sourceName} bridge.</p></div><b>0 records</b></header><Empty title="Hose testing is not connected" text="No hose inventory, annual test dates, failed lengths, or service-test results were found. Nothing has been invented from the fictional demo."/></div> : null}
    <p className="fleet-footer">The original records in {sourceSystem} remain in place. This workspace reads protected operational data; authorized setup edits are stored as audited PrePlan 360 overlays. Empty maintenance and hose states are shown honestly.</p>
  </section>;
}

function ApparatusChecks({ departmentId, apparatus, inventory, sourceChecks, sourceName, editable, supportSessionId, overlays, overlayState, onOverlays }: {
  departmentId: string;
  apparatus: StickneyApparatus[];
  inventory: NonNullable<StickneyModuleData["inventory"]>;
  sourceChecks: NonNullable<StickneyModuleData["fleetChecks"]>;
  sourceName: string;
  editable: boolean;
  supportSessionId: string;
  overlays: FleetOverlayResponse;
  overlayState: "loading" | "ready" | "error";
  onOverlays: (value: FleetOverlayResponse) => void;
}) {
  const [activeUnitId, setActiveUnitId] = useState(apparatus[0]?.id || "");
  const [mode, setMode] = useState<FleetCheckMode>("daily");
  const template = useMemo(() => fleetCheckTemplate(inventory, activeUnitId, mode), [activeUnitId, inventory, mode]);
  const [draftId, setDraftId] = useState("");
  const [mapping, setMapping] = useState<FleetCheckRecord["mapping"]>(template.mapping);
  const [items, setItems] = useState<FleetCheckItem[]>(template.items);
  const [evidence, setEvidence] = useState<Record<string, File>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const activeUnit = apparatus.find((unit) => unit.id === activeUnitId) || apparatus[0];

  const progress = fleetCheckProgress(items);
  const grouped = useMemo(() => {
    const groups = new Map<string, FleetCheckItem[]>();
    items.forEach((item) => groups.set(item.category, [...(groups.get(item.category) ?? []), item]));
    return [...groups.entries()];
  }, [items]);

  function updateItem(sourceItemId: string, change: Partial<FleetCheckItem>) {
    setItems((current) => current.map((item) => item.source_item_id === sourceItemId ? { ...item, ...change } : item));
    setSaveState("idle");
  }

  function startNew() {
    setDraftId("");
    setMapping(template.mapping);
    setItems(template.items.map((item) => ({ ...item })));
    setEvidence({});
    setSaveState("idle");
    setMessage("");
  }

  function loadDraft(nextUnitId: string, nextMode: FleetCheckMode, preferred?: FleetCheckRecord) {
    const nextTemplate = fleetCheckTemplate(inventory, nextUnitId, nextMode);
    const current = preferred || overlays.checks.find((check) => check.apparatus_id === nextUnitId && check.check_type === nextMode && check.status === "in_progress");
    setActiveUnitId(nextUnitId);
    setMode(nextMode);
    setDraftId(current?.id || "");
    setMapping(current?.mapping || nextTemplate.mapping);
    setItems(current?.items.map((item) => ({ ...item })) || nextTemplate.items.map((item) => ({ ...item })));
    setEvidence({});
    setSaveState("idle");
    setMessage(current ? "Saved in-progress check loaded." : "");
  }

  function markAllPass() {
    setItems((current) => current.map((item) => item.source_item_id === "__odometer__" ? item : { ...item, result: "pass" }));
    setSaveState("idle");
  }

  async function save(completing: boolean) {
    if (!activeUnit || !editable || saveState === "saving") return;
    const validationItems = items.map((item) => evidence[item.source_item_id] ? { ...item, photo_url: "pending-upload" } : item);
    if (!items.length) { setSaveState("error"); setMessage("No active inventory is available for this unit."); return; }
    const pending = validationItems.find((item) => item.source_item_id === "__odometer__" ? completing && item.numeric_reading == null : completing && item.result === "pending");
    const incompleteIssue = validationItems.find((item) => (item.result === "fail" || item.result === "missing") && (!item.note.trim() || !item.photo_url));
    if (pending) { setSaveState("error"); setMessage(pending.source_item_id === "__odometer__" ? "Record the odometer before completing this check." : "Complete every item before submitting this check."); return; }
    if (incompleteIssue) { setSaveState("error"); setMessage(`Add a write-up note and photo for ${incompleteIssue.item_name}.`); return; }
    setSaveState("saving");
    setMessage(completing ? "Submitting apparatus check…" : "Saving check progress…");
    const body = new FormData();
    body.set("action", "save_check");
    body.set("support_session_id", supportSessionId);
    body.set("payload", JSON.stringify({ id: draftId, apparatus_id: activeUnit.id, apparatus_name: activeUnit.name, check_type: mode, status: completing ? "completed" : "in_progress", mapping, items }));
    items.forEach((item, index) => { const file = evidence[item.source_item_id]; if (file) body.set(`evidence_${index}`, file); });
    try {
      const response = await fetch(`/api/departments/${encodeURIComponent(departmentId)}/fleet-checks`, { method: "POST", body });
      const result = await response.json() as FleetOverlayResponse & { error?: string; savedCheckId?: string };
      if (!response.ok) throw new Error(result.error || "The apparatus check could not be saved.");
      onOverlays({ checks: result.checks, workOrders: result.workOrders });
      setDraftId(result.savedCheckId || draftId);
      setEvidence({});
      setSaveState("saved");
      setMessage(completing ? "Check completed and added to department history." : "Check progress saved for this department.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "The apparatus check could not be saved.");
    }
  }

  const localHistory = overlays.checks.slice(0, 12);
  return <div className="fleet-panel fleet-check-workspace">
    <header><div><span>APPARATUS CHECKS</span><h2>Daily and weekly apparatus checks</h2><p>Run a live check against {sourceName}&apos;s real unit and inventory records. Source records stay unchanged.</p></div><b>{overlayState === "loading" ? "Loading" : `${sourceChecks.length + overlays.checks.length} saved`}</b></header>
    {overlayState === "error" ? <div className="fleet-check-message error">Saved PrePlan 360 check history is temporarily unavailable. The imported source records remain safe.</div> : null}
    {apparatus.length ? <>
      <div className="fleet-unit-bar" role="tablist" aria-label="Choose apparatus">{apparatus.map((unit) => <button type="button" role="tab" aria-selected={unit.id === activeUnitId} className={unit.id === activeUnitId ? "active" : ""} key={unit.id} onClick={() => loadDraft(unit.id, mode)}>{unit.name}<small>{label(unit.asset_type)}{unit.status === "out_of_service" ? " · OOS" : ""}</small></button>)}</div>
      <div className="fleet-check-toolbar"><div><button type="button" className={mode === "daily" ? "active" : ""} onClick={() => loadDraft(activeUnitId, "daily")}>Daily Vehicle Check</button><button type="button" className={mode === "weekly" ? "active" : ""} onClick={() => loadDraft(activeUnitId, "weekly")}>Weekly Apparatus Check</button></div><div className={`fleet-check-progress ${progress.failed ? "failed" : ""}`}><i style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }}/></div><b>{progress.completed}/{progress.total}</b><button type="button" onClick={markAllPass} disabled={!editable}>✓ Mark all pass</button><button type="button" onClick={startNew}>Reset</button></div>
      <div className={`fleet-check-mapping ${mapping}`}><b>{mapping === "department" ? "Department check mapping" : mapping === "active_inventory" ? "Active inventory fallback" : "No inventory mapping"}</b><span>{mapping === "department" ? `Only ${mode} items mapped by ${sourceName} are shown.` : mapping === "active_inventory" ? `${sourceName} has not tagged ${mode} items, so this check uses the unit's real active inventory without inventing equipment.` : "Add active inventory to this unit before running the check."}</span></div>
      <section className="fleet-check-sheet"><header><div><span>{activeUnit?.asset_type || "Apparatus"}</span><h3>{activeUnit?.name || "Choose apparatus"} · {mode === "daily" ? "Daily Vehicle Check" : "Weekly Apparatus Check"}</h3></div>{draftId ? <button type="button" onClick={startNew}>Start new check</button> : null}</header>
        {grouped.map(([category, categoryItems]) => <section className="fleet-check-category" key={category}><h4>{category}</h4>{categoryItems.map((item) => <article className={`fleet-check-row ${item.result}`} key={item.source_item_id}><div className="fleet-check-item"><b>{item.item_name}</b>{item.source_item_id === "__odometer__" ? <label>Current odometer<input aria-label="Current odometer" type="number" inputMode="numeric" min="0" step="1" value={item.numeric_reading ?? ""} onChange={(event) => updateItem(item.source_item_id, { numeric_reading: event.target.value === "" ? null : Number(event.target.value), result: event.target.value === "" ? "pending" : "pass" })}/></label> : null}</div>{item.source_item_id !== "__odometer__" ? <div className="fleet-result-buttons">{(["pass", "fail", "missing", "na"] as const).map((result) => <button type="button" key={result} className={item.result === result ? "active" : ""} onClick={() => updateItem(item.source_item_id, { result })} disabled={!editable}>{result === "na" ? "N/A" : label(result)}</button>)}</div> : null}{item.result === "fail" || item.result === "missing" ? <div className="fleet-check-writeup"><label>Write-up note<textarea required value={item.note} onChange={(event) => updateItem(item.source_item_id, { note: event.target.value })} placeholder="Describe the deficiency, location, and immediate action."/></label><label>Photo evidence<input required type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) setEvidence((current) => ({ ...current, [item.source_item_id]: file })); }}/><small>{evidence[item.source_item_id]?.name || (item.photo_url ? "Saved photo attached" : "Take a photo or choose one from this device")}</small></label>{item.photo_url && draftId ? <a target="_blank" rel="noreferrer" href={`/api/departments/${departmentId}/fleet-evidence/${encodeURIComponent(draftId)}/${encodeURIComponent(item.source_item_id)}`}>View saved evidence</a> : null}</div> : null}</article>)}</section>)}
        {!items.length ? <Empty title="No check items" text="This unit has no active inventory records to use for a real apparatus check."/> : null}
        <footer><div className={`fleet-check-message ${saveState}`} aria-live="polite">{message || (editable ? "Save partial progress, or complete every item and submit the check." : "You have view-only fleet permission.")}</div><button type="button" onClick={() => void save(false)} disabled={!editable || saveState === "saving"}>Save progress</button><button type="button" className="primary" onClick={() => void save(true)} disabled={!editable || saveState === "saving" || !items.length}>Complete & submit check</button></footer>
      </section>
    </> : <Empty title="No apparatus connected" text="Add or import an apparatus before starting a daily or weekly check."/>}
    {localHistory.length || sourceChecks.length ? <section className="fleet-check-history"><header><div><span>CHECK HISTORY</span><h3>Saved department activity</h3></div><b>{localHistory.length + sourceChecks.length}</b></header><div className="fleet-check-list">{localHistory.map((check) => { const checkProgress = fleetCheckProgress(check.items); return <article key={check.id}><div><strong>{check.apparatus_name}</strong><span>{label(check.check_type)} check · PrePlan 360</span><small>{date(check.started_at)} by {check.started_by}</small>{check.status === "in_progress" ? <button type="button" onClick={() => loadDraft(check.apparatus_id, check.check_type, check)}>Resume check</button> : null}</div><em className={check.status === "completed" ? "ready" : "warning"}>{label(check.status)}</em><dl><div><dt>Items</dt><dd>{checkProgress.total}</dd></div><div><dt>Complete</dt><dd>{checkProgress.completed}</dd></div><div><dt>Issues</dt><dd>{checkProgress.failed}</dd></div><div><dt>Odometer</dt><dd>{check.items.find((item) => item.source_item_id === "__odometer__")?.numeric_reading?.toLocaleString() || "Not recorded"}</dd></div></dl></article>; })}{sourceChecks.map((check) => <article key={`source-${check.id}`}><div><strong>{apparatus.find((unit) => unit.id === check.apparatus_id)?.name || "Unknown apparatus"}</strong><span>{label(check.check_type)} check · {sourceName}</span><small>Started {date(check.started_at)} by {check.started_by || "Not recorded"}</small></div><em className={check.status === "completed" ? "ready" : "warning"}>{label(check.status)}</em><dl><div><dt>Items</dt><dd>{check.item_count}</dd></div><div><dt>Pending</dt><dd>{check.pending_count}</dd></div><div><dt>Failed</dt><dd>{check.failed_count}</dd></div><div><dt>Odometer</dt><dd>{check.latest_odometer == null ? "Not recorded" : Number(check.latest_odometer).toLocaleString()}</dd></div></dl></article>)}</div></section> : null}
  </div>;
}

function RepairWorkspace({ departmentId, sourceName, sourceOrders, exceptions, sourceFlags, unitNames, localOrders, editable, supportSessionId, onOverlays }: {
  departmentId: string;
  sourceName: string;
  sourceOrders: NonNullable<StickneyModuleData["workOrders"]>;
  exceptions: NonNullable<StickneyModuleData["readinessExceptions"]>;
  sourceFlags: NonNullable<StickneyModuleData["fleetSources"]>;
  unitNames: Map<string, string>;
  localOrders: FleetWorkOrderRecord[];
  editable: boolean;
  supportSessionId: string;
  onOverlays: (value: FleetOverlayResponse) => void;
}) {
  const [message, setMessage] = useState("");
  const openCount = sourceOrders.filter((order) => order.status !== "closed").length + localOrders.filter((order) => order.status !== "closed").length;
  async function update(order: FleetWorkOrderRecord, status: FleetWorkOrderRecord["status"]) {
    const body = new FormData();
    body.set("action", "update_work_order");
    body.set("support_session_id", supportSessionId);
    body.set("work_order_id", order.id);
    body.set("status", status);
    const response = await fetch(`/api/departments/${encodeURIComponent(departmentId)}/fleet-checks`, { method: "POST", body });
    const result = await response.json() as FleetOverlayResponse & { error?: string };
    if (!response.ok) { setMessage(result.error || "Work order could not be updated."); return; }
    onOverlays(result);
    setMessage(`${order.apparatus_name} · ${order.item_name} updated to ${label(status)}.`);
  }
  return <div className="fleet-panel"><header><div><span>REPAIRS / WORK ORDERS</span><h2>Readiness exceptions and repair history</h2><p>Failed and missing apparatus check items become department work orders. Imported {sourceName} records remain preserved.</p></div><b>{openCount} open</b></header>
    {message ? <div className="fleet-check-message saved" role="status">{message}</div> : null}
    {localOrders.length ? <section className="fleet-local-orders"><header><span>PREPLAN 360 WORK ORDERS</span><b>{localOrders.length}</b></header><div className="fleet-work-orders">{localOrders.map((order) => <article key={order.id}><header><b>{order.item_name}</b><em className={order.status === "closed" ? "ready" : "warning"}>{label(order.status)}</em></header><span>{order.apparatus_name} · {label(order.priority)} · {label(order.result)}</span><p>{order.note}</p><small>Reported {date(order.reported_at)} by {order.reported_by}</small><footer>{order.photo_url ? <a target="_blank" rel="noreferrer" href={`/api/departments/${departmentId}/fleet-evidence/${encodeURIComponent(order.check_id)}/${encodeURIComponent(order.source_item_id)}`}>View photo</a> : null}{editable ? <select aria-label={`Status for ${order.item_name}`} value={order.status} onChange={(event) => void update(order, event.target.value as FleetWorkOrderRecord["status"])}><option value="open">Open</option><option value="in_progress">In progress</option><option value="parts">Awaiting parts</option><option value="closed">Closed</option></select> : null}</footer></article>)}</div></section> : null}
    {exceptions.length ? <div className="fleet-exceptions">{exceptions.map((item) => <article key={item.id}><em className={item.priority}>{item.priority}</em><div><b>{unitNames.get(item.apparatus_id) || "Unknown apparatus"} · {label(item.result)}</b><p>{item.notes || "No note entered"}</p><small>Opened {date(item.opened_at)} by {item.opened_by}</small></div></article>)}</div> : null}
    {sourceOrders.length ? <section className="fleet-source-orders"><header><span>{sourceName.toUpperCase()} SOURCE WORK ORDERS</span><b>{sourceOrders.length}</b></header><div className="fleet-work-orders">{sourceOrders.map((order) => <article key={order.id}><header><b>{order.summary}</b><em className={order.status === "closed" ? "ready" : "warning"}>{label(order.status)}</em></header><span>{unitNames.get(order.apparatus_id) || "Unknown apparatus"} · {label(order.priority)}</span><p>{order.details || "No repair details entered"}</p><small>Opened {date(order.opened_at)}{order.vendor ? ` · ${order.vendor}` : ""}</small></article>)}</div></section> : null}
    {!localOrders.length && !exceptions.length && !sourceOrders.length ? <Empty title={sourceFlags.workOrders || sourceFlags.readinessExceptions ? "No open repairs" : "No imported repair source"} text={sourceFlags.workOrders || sourceFlags.readinessExceptions ? "No repair or readiness records currently require attention." : "Complete a failed or missing apparatus check item to create the first PrePlan 360 work order."}/> : null}
  </div>;
}

function AssetsView({ departmentId, inventoryPhotoRoute, apparatus, compartments, photos, checks, editable, supportSessionId }: { departmentId: string; inventoryPhotoRoute: string; apparatus: StickneyApparatus[]; compartments: NonNullable<StickneyModuleData["compartments"]>; photos: NonNullable<StickneyModuleData["inventoryPhotos"]>; checks: NonNullable<StickneyModuleData["fleetChecks"]>; editable: boolean; supportSessionId: string }) {
  const [selected, setSelected] = useState(apparatus[0]?.id || "");
  const unit = apparatus.find((item) => item.id === selected);
  return <div className="fleet-assets"><section className="fleet-capture"><span>MOBILE ASSET CAPTURE</span><h2>Add apparatus or equipment</h2><p>Authorized users can create a reviewed apparatus profile here. Camera-based VIN/barcode capture remains available in the separate PrePlan 360 native asset workspace.</p>{editable ? <details><summary>Add apparatus</summary><ApparatusForm departmentId={departmentId} unit={null} supportSessionId={supportSessionId}/></details> : <b>View-only permission</b>}<a href="#native-assets" onClick={() => { const details = document.getElementById("native-assets") as HTMLDetailsElement | null; if (details) details.open = true; }}>Open separate VIN, barcode, QR, and odometer capture</a></section><section className="fleet-intelligence"><span>MAINTENANCE INTELLIGENCE</span><h2>Build the service record</h2><p>Store reviewed VIN identity, manuals, parts catalogs, vendors, service schedules, due dates, and repair notes. Human verification is required before operational use.</p><div><span>Official manuals<small>Reviewed manufacturer link</small></span><span>Parts catalogs<small>Ordering and diagram source</small></span><span>Maintenance guidance<small>Verified interval and due day</small></span><span>Repair information<small>Work orders and history</small></span></div></section><aside><header><span>APPARATUS</span><b>{apparatus.length}</b></header>{apparatus.map((item) => <button className={item.id === selected ? "active" : ""} key={item.id} onClick={() => setSelected(item.id)}><i className={item.status}/><span><b>{item.name}</b><small>{item.asset_type}</small></span><em>{label(item.status)}</em></button>)}</aside><main>{unit ? <><header><div><span>{unit.asset_type}</span><h2>{unit.name}</h2><p>{[unit.year,unit.manufacturer,unit.model].filter(Boolean).join(" ") || "Vehicle details not entered"}</p></div><em className={unit.status === "in_service" ? "ready" : "danger"}>{label(unit.status)}</em></header>{photos.find((photo) => photo.apparatus_id === unit.id) ? <Image unoptimized width={640} height={360} src={`/api/departments/${departmentId}/${inventoryPhotoRoute}/${photos.find((photo) => photo.apparatus_id === unit.id)!.id}`} alt={`${unit.name} inventory view`}/> : null}<dl><div><dt>VIN</dt><dd>{unit.vin || "Not entered"}</dd></div><div><dt>Compartments</dt><dd>{compartments.filter((item) => item.apparatus_id === unit.id).length}</dd></div><div><dt>Photos</dt><dd>{photos.filter((item) => item.apparatus_id === unit.id).length}</dd></div><div><dt>Checks</dt><dd>{checks.filter((item) => item.apparatus_id === unit.id).length}</dd></div><div><dt>Weekly due</dt><dd>{unit.weekly_due_day == null ? "Not scheduled" : dayNames[unit.weekly_due_day]}</dd></div><div><dt>Last odometer</dt><dd>{checks.find((item) => item.apparatus_id === unit.id && item.latest_odometer != null)?.latest_odometer?.toLocaleString() || "Not recorded"}</dd></div></dl>{editable ? <details className="fleet-edit"><summary>Edit apparatus profile</summary><ApparatusForm departmentId={departmentId} unit={unit} supportSessionId={supportSessionId}/></details> : null}</> : <Empty title="No apparatus selected" text="Choose a unit from the apparatus list."/>}</main></div>;
}

function ApparatusForm({ departmentId, unit, supportSessionId }: { departmentId: string; unit: StickneyApparatus | null; supportSessionId: string }) {
  const field = (name: keyof StickneyApparatus, text: string, type = "text") => <label>{text}<input name={name} type={type} defaultValue={String(unit?.[name] ?? "")}/></label>;
  return <form className="fleet-form" method="post" action={`/api/departments/${departmentId}/stickney-records`}><input type="hidden" name="record_type" value="apparatus"/><input type="hidden" name="record_id" value={unit?.id || "new"}/><input type="hidden" name="support_session_id" value={supportSessionId}/>{field("name","Unit name")}{field("asset_type","Asset type")}<label>Status<select name="status" defaultValue={unit?.status || "in_service"}><option value="in_service">In service</option><option value="out_of_service">Out of service</option><option value="reserve">Reserve</option></select></label>{field("vin","VIN")}{field("manufacturer","Manufacturer")}{field("model","Model")}{field("year","Year","number")}<label>Weekly due day (0–6)<input name="weekly_due_day" type="number" min="0" max="6" defaultValue={String(unit?.weekly_due_day ?? "")}/></label>{field("preferred_vendor","Preferred vendor")}{field("owner_manual_url","Owner manual URL","url")}{field("service_manual_url","Service manual URL","url")}{field("parts_catalog_url","Parts catalog URL","url")}<label className="wide">Maintenance schedule<textarea name="maintenance_schedule" rows={4} defaultValue={unit?.maintenance_schedule || ""}/></label><button type="submit">{unit ? "Save apparatus" : "Add apparatus"}</button></form>;
}

function Empty({ title, text }: { title: string; text: string }) { return <div className="fleet-empty"><b>{title}</b><span>{text}</span></div>; }
