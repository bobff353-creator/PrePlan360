"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { DepartmentModuleData, DepartmentModuleItem } from "@/db/access";
import { liveBoardPanels, liveBoardWidgets, type FoundationSettings, type LiveBoardWidth } from "@/db/foundation";
import ModuleBuilder from "./module-builder";

type Props = {
  departmentId: string;
  departmentName: string;
  vehicleCount: number;
  settings: FoundationSettings;
  data: DepartmentModuleData;
  editable: boolean;
  supportSessionId: string;
};

const panelLabels = new Map(liveBoardPanels.map((panel) => [panel.key, panel.label]));

export default function LiveOpsBoard({ departmentId, departmentName, vehicleCount, settings, data, editable, supportSessionId }: Props) {
  const definitions = useMemo(() => [
    ...liveBoardWidgets,
    ...settings.live_board_external_links.map((entry) => ({ key: entry.id, label: entry.title })),
  ], [settings.live_board_external_links]);
  const [order, setOrder] = useState(settings.live_board_order);
  const [hidden, setHidden] = useState(settings.live_board_hidden);
  const [widths, setWidths] = useState(settings.live_board_widths);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragged, setDragged] = useState("");
  const [panelIndex, setPanelIndex] = useState(0);
  const [clock, setClock] = useState<Date | null>(null);
  const activePanels = settings.live_board_panels.length ? settings.live_board_panels : ["equipment" as const];

  useEffect(() => {
    const update = () => setClock(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activePanels.length < 2) return;
    const timer = window.setInterval(() => setPanelIndex((current) => (current + 1) % activePanels.length), settings.board_rotation_seconds * 1000);
    return () => window.clearInterval(timer);
  }, [activePanels.length, settings.board_rotation_seconds]);

  const currentPanel = activePanels[panelIndex % activePanels.length];
  const visibleOrder = order.filter((id) => !hidden.includes(id));
  const activeIncident = data.items.find((item) => item.item_type === "incident" && item.operational_status === "active");
  const apparatus = data.items.filter((item) => item.item_type === "apparatus");

  function move(id: string, direction: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function drop(target: string) {
    if (!dragged || dragged === target) return;
    setOrder((current) => {
      const next = current.filter((id) => id !== dragged);
      const index = next.indexOf(target);
      next.splice(index < 0 ? next.length : index, 0, dragged);
      return next;
    });
    setDragged("");
  }

  return <section className="live-ops-foundation">
    <header className="live-ops-head">
      <div><span>{departmentName.toUpperCase()}</span><h2>{settings.live_board_title}</h2></div>
      <div className="live-ops-head-actions">{editable ? <button type="button" onClick={() => setSettingsOpen((open) => !open)}>{settingsOpen ? "Close settings" : "Customize board"}</button> : null}<div className="live-ops-clock"><b>{clock ? clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</b><span>{clock ? clock.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : ""}</span><small><i/> Saved department display</small></div></div>
    </header>

    {settingsOpen && editable ? <BoardSettings action={`/api/departments/${departmentId}/live-ops-board`} settings={settings} definitions={definitions} order={order} hidden={hidden} widths={widths} supportSessionId={supportSessionId} onMove={move} onHidden={setHidden} onWidth={(id, width) => setWidths((current) => ({ ...current, [id]: width }))}/> : null}

    <div className="live-ops-canvas">
      {visibleOrder.map((id) => <section key={id} className={`live-ops-widget width-${widths[id] || "half"}`} draggable={editable} onDragStart={() => setDragged(id)} onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()} onDrop={() => drop(id)} onDragEnd={() => setDragged("")}>
        {editable ? <div className="live-widget-grip"><span>Move</span><b>≡</b></div> : null}
        {id === "summary" ? <SummaryWidget settings={settings} activeIncident={activeIncident}/> : id === "station" ? <StationWidget panel={currentPanel} items={data.items} settings={settings} index={panelIndex} onSelect={setPanelIndex}/> : id === "apparatus" ? <ApparatusWidget apparatus={apparatus} configuredCount={vehicleCount}/> : <ExternalWidget link={settings.live_board_external_links.find((entry) => entry.id === id)}/>} 
      </section>)}
      {!visibleOrder.length ? <div className="live-board-empty"><b>No board cards are visible.</b><span>{editable ? "Open Customize board to restore a card." : "An authorized department editor can restore this display."}</span></div> : null}
    </div>

    <footer className="live-ops-note">This board uses saved department records. CAD, staffing, weather, and outside sources appear only after a department connects or enters them.</footer>
    {editable ? <details className="live-ops-records"><summary>Manage live board records</summary><ModuleBuilder moduleKey="live-ops" moduleName="Live Operations" departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} recordManagerOnly/></details> : null}
  </section>;
}

function SummaryWidget({ settings, activeIncident }: { settings: FoundationSettings; activeIncident?: DepartmentModuleItem }) {
  return <div className="live-summary">
    <article className="unconnected"><span>Staffing</span><strong>Not connected</strong><small>Connect scheduling to show coverage</small></article>
    <article><span>Officer in charge</span><strong>Not assigned</strong><small>No current command assignment</small></article>
    <article className={activeIncident ? "active" : ""}><span>Active call</span><strong>{activeIncident?.title || "None"}</strong><small>{activeIncident ? activeIncident.location || activeIncident.summary || "Department entry is active" : "No active department incident entry"}</small></article>
    <article className="next-shift"><span>Next shift change</span><strong>{settings.shift_start_time}</strong><small>{settings.shift_hours_on} on / {settings.shift_hours_off} off rule</small></article>
  </div>;
}

function StationWidget({ panel, items, settings, index, onSelect }: { panel: FoundationSettings["live_board_panels"][number]; items: DepartmentModuleItem[]; settings: FoundationSettings; index: number; onSelect: (index: number) => void }) {
  return <div className="live-card"><h3>{panelLabels.get(panel) || "Station information"}</h3><div className="live-rotation-body"><PanelContent panel={panel} items={items} settings={settings}/></div><div className="live-rotation-dots">{settings.live_board_panels.map((key, panelIndex) => <button type="button" className={panelIndex === index % settings.live_board_panels.length ? "active" : ""} key={key} onClick={() => onSelect(panelIndex)} aria-label={`Show ${panelLabels.get(key)}`}/>)}<span>Rotates every {settings.board_rotation_seconds} seconds</span></div></div>;
}

function PanelContent({ panel, items, settings }: { panel: FoundationSettings["live_board_panels"][number]; items: DepartmentModuleItem[]; settings: FoundationSettings }) {
  const equipment = items.filter((item) => item.item_type === "apparatus" && ["attention", "offline"].includes(item.operational_status));
  const duty = items.filter((item) => ["station", "notice"].includes(item.item_type) && item.operational_status === "active");
  const training = items.filter((item) => item.item_type === "resource" && ["active", "ready"].includes(item.operational_status));
  if (panel === "equipment") return <ItemList items={equipment} empty="No equipment issues are recorded on this board."/>;
  if (panel === "duty") return <ItemList items={duty} empty="No current daily duty is connected to this board."/>;
  if (panel === "training") return <ItemList items={training} empty="No upcoming training entries are recorded on this board."/>;
  if (panel === "closecalls") return <EmptySource title="Close-call source not connected" text="Configure an authorized source before outside reports are shown."/>;
  if (panel === "lodd") return <EmptySource title="Official LODD source not connected" text="This board does not display an unverified live total."/>;
  if (panel === "weather") return <LinkedSource title="Weather source" url={settings.live_board_weather_url}/>;
  if (panel === "alerts") return <LinkedSource title="Weather alerts source" url={settings.live_board_alerts_url}/>;
  return <LinkedSource title="Weather radar source" url={settings.live_board_radar_url} detail={`Configured refresh: ${settings.live_board_radar_refresh_minutes} minutes`}/>;
}

function ItemList({ items, empty }: { items: DepartmentModuleItem[]; empty: string }) {
  if (!items.length) return <EmptySource title={empty}/>;
  return <div className="live-news-list">{items.slice(0, 5).map((item) => <article key={item.id}><b>{item.title}</b><span>{item.summary || item.location || item.operational_status}</span></article>)}</div>;
}

function EmptySource({ title, text }: { title: string; text?: string }) {
  return <div className="live-source-empty"><b>{title}</b>{text ? <span>{text}</span> : null}</div>;
}

function LinkedSource({ title, url, detail }: { title: string; url: string; detail?: string }) {
  if (!url) return <EmptySource title={`${title} not configured`} text="An authorized editor can add a complete HTTPS display link in board settings."/>;
  return <div className="live-linked-source"><b>{title} configured</b>{detail ? <span>{detail}</span> : null}<a href={url} target="_blank" rel="noreferrer">Open source</a></div>;
}

function ApparatusWidget({ apparatus, configuredCount }: { apparatus: DepartmentModuleItem[]; configuredCount: number }) {
  return <div className="live-card"><h3>Apparatus status · Fleet + CAD</h3>{apparatus.length ? <div className="live-apparatus-strip">{apparatus.map((item) => <article className={item.operational_status} key={item.id}><b>{item.title}</b><span>{item.operational_status}</span></article>)}</div> : <EmptySource title="No apparatus status records" text={configuredCount ? `${configuredCount} vehicles are configured in the department profile, but their live status is not connected.` : "Add real apparatus entries or connect an authorized fleet source."}/>}<p>Units are never shown as available, committed, or out of service without a saved department record.</p></div>;
}

function ExternalWidget({ link }: { link?: FoundationSettings["live_board_external_links"][number] }) {
  return <div className="live-card"><h3>{link?.title || "External display"}</h3>{link ? <div className="live-linked-source"><b>Outside display link</b><span>Open the configured source in a separate tab.</span><a href={link.url} target="_blank" rel="noreferrer">Open source</a></div> : <EmptySource title="External display not found"/>}</div>;
}

function BoardSettings({ action, settings, definitions, order, hidden, widths, supportSessionId, onMove, onHidden, onWidth }: {
  action: string;
  settings: FoundationSettings;
  definitions: { key: string; label: string }[];
  order: string[];
  hidden: string[];
  widths: Record<string, LiveBoardWidth>;
  supportSessionId: string;
  onMove: (id: string, direction: -1 | 1) => void;
  onHidden: (hidden: string[]) => void;
  onWidth: (id: string, width: LiveBoardWidth) => void;
}) {
  const definitionMap = new Map(definitions.map((definition) => [definition.key, definition.label]));
  return <form method="post" action={action} className="live-board-settings">
    <input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="live_board_order" value={order.join(",")}/><input type="hidden" name="live_board_visibility_marker" value="yes"/>
    <header><div><span>THIS DEPARTMENT</span><h3>Live Ops Board settings</h3><p>These choices save as a department override. The owner master remains unchanged.</p></div><button type="submit">Save board</button></header>
    <div className="live-settings-grid">
      <section><h4>Board identity and timing</h4><label>Board title<input name="live_board_title" maxLength={80} required defaultValue={settings.live_board_title}/></label><div className="live-settings-row"><label>Rotation seconds<input name="board_rotation_seconds" type="number" min={5} max={300} defaultValue={settings.board_rotation_seconds}/></label><label>Response seconds<input name="response_duration_seconds" type="number" min={5} max={600} defaultValue={settings.response_duration_seconds}/></label></div></section>
      <section><h4>Station information rotation</h4><div className="live-panel-checks">{liveBoardPanels.map((panel) => <label key={panel.key}><input type="checkbox" name="live_board_panels" value={panel.key} defaultChecked={settings.live_board_panels.includes(panel.key)}/>{panel.label}</label>)}</div></section>
      <section className="full"><h4>Board layout</h4><div className="live-layout-list">{order.map((id, index) => <article key={id}><label><input type="checkbox" name="live_board_visible" value={id} checked={!hidden.includes(id)} onChange={(event) => onHidden(event.target.checked ? hidden.filter((value) => value !== id) : [...hidden, id])}/><span>{definitionMap.get(id) || id}</span></label><select name={`live_board_width_${id}`} value={widths[id] || "half"} onChange={(event) => onWidth(id, event.target.value as LiveBoardWidth)}><option value="third">One third</option><option value="half">Half</option><option value="full">Full</option></select><button type="button" onClick={() => onMove(id, -1)} disabled={index === 0}>Up</button><button type="button" onClick={() => onMove(id, 1)} disabled={index === order.length - 1}>Down</button></article>)}</div><small>Checked cards are visible. Drag cards on the board or use Up and Down.</small></section>
      <section className="full"><h4>Weather, radar, and outside links</h4><div className="live-source-fields"><label>Weather display link<input name="live_board_weather_url" type="url" placeholder="https://" defaultValue={settings.live_board_weather_url}/></label><label>Weather alerts link<input name="live_board_alerts_url" type="url" placeholder="https://" defaultValue={settings.live_board_alerts_url}/></label><label>Radar link<input name="live_board_radar_url" type="url" placeholder="https://" defaultValue={settings.live_board_radar_url}/></label><label>Radar refresh minutes<input name="live_board_radar_refresh_minutes" type="number" min={1} max={120} defaultValue={settings.live_board_radar_refresh_minutes}/></label><label>Weather amount<select name="live_board_forecast_detail" defaultValue={settings.live_board_forecast_detail}><option value="current">Current conditions</option><option value="3">3-day view</option><option value="7">7-day view</option></select></label><label className="external-lines">External displays · one per line<textarea name="live_board_external_links" rows={4} placeholder="Traffic camera | https://example.com" defaultValue={settings.live_board_external_links.map((entry) => `${entry.title} | ${entry.url}`).join("\n")}/></label></div><small>Outside links open in a separate tab. Do not paste credentials or secret tokens.</small></section>
    </div>
  </form>;
}
