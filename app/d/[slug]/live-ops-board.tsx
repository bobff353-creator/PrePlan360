"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { DepartmentModuleData, DepartmentModuleItem } from "@/db/access";
import { liveBoardPanels, liveBoardWidgets, type FoundationSettings, type LiveBoardWidth } from "@/db/foundation";
import ModuleBuilder from "./module-builder";

type WeatherPeriod = {
  name: string;
  startTime: string;
  temperature: number | null;
  temperatureUnit: string;
  shortForecast: string;
  windSpeed: string;
  windDirection: string;
};

type WeatherAlert = {
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  expires: string;
  description: string;
  instruction: string;
  senderName: string;
  priority: boolean;
};

type WeatherPayload = {
  configured: boolean;
  source?: string;
  location: string;
  updatedAt?: string;
  today?: WeatherPeriod | null;
  tomorrow?: WeatherPeriod | null;
  hourly?: WeatherPeriod[];
  alerts?: WeatherAlert[];
  reason?: string;
  error?: string;
};

type RadarTakeover = {
  kind: "scheduled" | "severe";
  title: string;
  detail: string;
  endsAt: number;
};

type Props = {
  departmentId: string;
  departmentSlug: string;
  departmentName: string;
  weatherLocation: string;
  vehicleCount: number;
  settings: FoundationSettings;
  data: DepartmentModuleData;
  editable: boolean;
  supportSessionId: string;
};

const panelLabels = new Map(liveBoardPanels.map((panel) => [panel.key, panel.label]));

function militaryTime(date: Date | null) {
  if (!date) return "--:--:--";
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function LiveOpsBoard({ departmentId, departmentSlug, departmentName, weatherLocation, vehicleCount, settings, data, editable, supportSessionId }: Props) {
  const router = useRouter();
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
  const [weatherIndex, setWeatherIndex] = useState(0);
  const [apparatusIndex, setApparatusIndex] = useState(0);
  const [clock, setClock] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [takeover, setTakeover] = useState<RadarTakeover | null>(null);
  const nextRadarAt = useRef(0);
  const lastPriorityAlert = useRef("");
  const activePanels = settings.live_board_panels.length ? settings.live_board_panels : ["equipment" as const];
  const activeIncident = data.items.find((item) => item.item_type === "incident" && item.operational_status === "active");
  const apparatus = data.items.filter((item) => item.item_type === "apparatus");
  const ridingAssignments = data.items.filter((item) => ["riding_assignment", "riding", "assignment"].includes(item.item_type));

  useEffect(() => {
    const update = () => setClock(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeIncident) {
      const support = supportSessionId ? `&support=${encodeURIComponent(supportSessionId)}` : "";
      router.replace(`/d/${departmentSlug}?module=respond${support}`);
    }
  }, [activeIncident, departmentSlug, router, supportSessionId]);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    async function loadWeather() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/departments/${departmentId}/weather`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as WeatherPayload;
        if (!cancelled) setWeather(response.ok ? payload : { ...payload, configured: Boolean(payload.configured), error: payload.error || "Weather source temporarily unavailable" });
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) setWeather({ configured: true, location: weatherLocation, error: "Weather source temporarily unavailable" });
      }
    }
    void loadWeather();
    const timer = window.setInterval(loadWeather, 60_000);
    return () => { cancelled = true; controller?.abort(); window.clearInterval(timer); };
  }, [departmentId, weatherLocation]);

  useEffect(() => {
    const interval = Math.max(5, settings.board_rotation_seconds) * 1000;
    const timer = window.setInterval(() => {
      setWeatherIndex((current) => (current + 1) % 3);
      setApparatusIndex((current) => (current + 1) % 2);
      if (activePanels.length > 1) setPanelIndex((current) => (current + 1) % activePanels.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [activePanels.length, settings.board_rotation_seconds]);

  useEffect(() => {
    const priority = weather?.alerts?.find((alert) => alert.priority);
    if (!priority || activeIncident || priority.id === lastPriorityAlert.current) return;
    lastPriorityAlert.current = priority.id;
    setTakeover({
      kind: "severe",
      title: priority.event || "Severe weather alert",
      detail: priority.headline || priority.description || "Open the official alert source for details.",
      endsAt: Date.now() + settings.live_board_severe_radar_seconds * 1000,
    });
  }, [activeIncident, settings.live_board_severe_radar_seconds, weather]);

  useEffect(() => {
    if (!settings.live_board_radar_url) return;
    const every = Math.max(1, settings.live_board_radar_refresh_minutes) * 60_000;
    nextRadarAt.current = Date.now() + every;
    const timer = window.setInterval(() => {
      if (activeIncident || Date.now() < nextRadarAt.current) return;
      nextRadarAt.current = Date.now() + every;
      setTakeover((current) => current || {
        kind: "scheduled",
        title: "Scheduled weather radar",
        detail: `Selected-area radar for ${departmentName}.`,
        endsAt: Date.now() + settings.live_board_radar_display_seconds * 1000,
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeIncident, departmentName, settings.live_board_radar_display_seconds, settings.live_board_radar_refresh_minutes, settings.live_board_radar_url]);

  useEffect(() => {
    if (!takeover) return;
    const timer = window.setTimeout(() => setTakeover(null), Math.max(0, takeover.endsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [takeover]);

  const currentPanel = activePanels[panelIndex % activePanels.length];
  const visibleOrder = order.filter((id) => !hidden.includes(id));

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

  function previewRadar(kind: RadarTakeover["kind"]) {
    setTakeover({
      kind,
      title: kind === "severe" ? "Severe weather preview" : "Scheduled weather radar preview",
      detail: kind === "severe" ? "Preview only — no live warning is active." : `Selected-area radar for ${departmentName}.`,
      endsAt: Date.now() + (kind === "severe" ? settings.live_board_severe_radar_seconds : settings.live_board_radar_display_seconds) * 1000,
    });
  }

  return <section className="live-ops-foundation">
    <WeatherHeader departmentName={departmentName} weather={weather} index={weatherIndex} clock={clock} rotationSeconds={settings.board_rotation_seconds} editable={editable} settingsOpen={settingsOpen} onSettings={() => setSettingsOpen((open) => !open)}/>

    {settingsOpen && editable ? <BoardSettings action={`/api/departments/${departmentId}/live-ops-board`} settings={settings} definitions={definitions} order={order} hidden={hidden} widths={widths} weatherLocation={weatherLocation} supportSessionId={supportSessionId} onMove={move} onHidden={setHidden} onWidth={(id, width) => setWidths((current) => ({ ...current, [id]: width }))} onPreview={previewRadar}/> : null}

    <div className="live-ops-canvas">
      {visibleOrder.map((id) => <section key={id} className={`live-ops-widget width-${widths[id] || "half"}`} draggable={editable} onDragStart={() => setDragged(id)} onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()} onDrop={() => drop(id)} onDragEnd={() => setDragged("")}>
        {editable ? <div className="live-widget-grip"><span>Move</span><b>≡</b></div> : null}
        {id === "summary" ? <SummaryWidget settings={settings} activeIncident={activeIncident} items={data.items}/> : id === "station" ? <StationWidget panel={currentPanel} items={data.items} settings={settings} weather={weather} index={panelIndex} onSelect={setPanelIndex}/> : id === "apparatus" ? <ApparatusWidget apparatus={apparatus} ridingAssignments={ridingAssignments} configuredCount={vehicleCount} view={apparatusIndex}/> : <ExternalWidget link={settings.live_board_external_links.find((entry) => entry.id === id)}/>}
      </section>)}
      {!visibleOrder.length ? <div className="live-board-empty"><b>No board cards are visible.</b><span>{editable ? "Open Customize board to restore a card." : "An authorized department editor can restore this display."}</span></div> : null}
    </div>

    <footer className="live-ops-note">Saved department records and verified weather sources only. Respond always overrides this display.</footer>
    {editable ? <details className="live-ops-records"><summary>Manage live board records</summary><ModuleBuilder moduleKey="live-ops" moduleName="Live Operations" departmentId={departmentId} data={data} editable={editable} supportSessionId={supportSessionId} recordManagerOnly/></details> : null}
    {takeover && !activeIncident ? <RadarOverlay takeover={takeover} radarUrl={settings.live_board_radar_url} clock={clock} onClose={() => setTakeover(null)}/> : null}
  </section>;
}

function WeatherHeader({ departmentName, weather, index, clock, rotationSeconds, editable, settingsOpen, onSettings }: { departmentName: string; weather: WeatherPayload | null; index: number; clock: Date | null; rotationSeconds: number; editable: boolean; settingsOpen: boolean; onSettings: () => void }) {
  let eyebrow = `${departmentName.toUpperCase()} · WEATHER`;
  let title = "Weather location not connected";
  let detail = weather?.reason || "Save verified latitude, longitude coordinates in Department settings.";
  if (weather?.error) { title = "Weather source unavailable"; detail = weather.error; }
  else if (weather?.configured && index % 3 === 0 && weather.today) { eyebrow = `${weather.source || "WEATHER"} · TODAY`; title = `${weather.today.temperature ?? "--"}°${weather.today.temperatureUnit} · ${weather.today.shortForecast || "Forecast available"}`; detail = `${weather.today.windDirection} ${weather.today.windSpeed}`.trim() || weather.location; }
  else if (weather?.configured && index % 3 === 1 && weather.tomorrow) { eyebrow = `${weather.source || "WEATHER"} · TOMORROW`; title = `${weather.tomorrow.temperature ?? "--"}°${weather.tomorrow.temperatureUnit} · ${weather.tomorrow.shortForecast || "Forecast available"}`; detail = `${weather.tomorrow.windDirection} ${weather.tomorrow.windSpeed}`.trim() || weather.location; }
  else if (weather?.configured && weather.hourly?.length) { eyebrow = `${weather.source || "WEATHER"} · NEXT 5 HOURS`; title = weather.hourly.map((entry) => `${new Date(entry.startTime).getHours().toString().padStart(2, "0")}:00 ${entry.temperature ?? "--"}°`).join("  ·  "); detail = weather.hourly.map((entry) => entry.shortForecast).filter((value, entryIndex, values) => value && values.indexOf(value) === entryIndex).join(" · "); }
  return <header className="live-weather-head"><div className="live-weather-copy"><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div><div className="live-ops-head-actions">{editable ? <button type="button" onClick={onSettings}>{settingsOpen ? "Close settings" : "Customize board"}</button> : null}<div className="live-ops-clock"><b>{militaryTime(clock)}</b><span>{clock ? clock.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : ""}</span><small><i/> Rotates every {rotationSeconds}s</small></div></div></header>;
}

function SummaryWidget({ settings, activeIncident, items }: { settings: FoundationSettings; activeIncident?: DepartmentModuleItem; items: DepartmentModuleItem[] }) {
  const staffing = items.find((item) => item.item_type === "staffing");
  const officer = items.find((item) => ["officer", "oic", "officer_in_charge"].includes(item.item_type));
  return <div className={`live-summary ${settings.live_board_show_next_shift ? "" : "without-next-shift"}`}>
    <article className={staffing ? "" : "unconnected"}><span>Staffing</span><strong>{staffing?.title || "Not connected"}</strong><small>{staffing?.summary || "Connect scheduling to show coverage"}</small></article>
    <article><span>Officer in charge</span><strong>{officer?.title || "Not assigned"}</strong><small>{officer?.summary || "No current command assignment"}</small></article>
    <article className={activeIncident ? "active" : ""}><span>Active call</span><strong>{activeIncident?.title || "None"}</strong><small>{activeIncident ? activeIncident.location || activeIncident.summary || "Department entry is active" : "No active department incident entry"}</small></article>
    {settings.live_board_show_next_shift ? <article className="next-shift"><span>Next shift change</span><strong>{settings.shift_start_time}</strong><small>{settings.shift_hours_on} on / {settings.shift_hours_off} off rule</small></article> : null}
  </div>;
}

function StationWidget({ panel, items, settings, weather, index, onSelect }: { panel: FoundationSettings["live_board_panels"][number]; items: DepartmentModuleItem[]; settings: FoundationSettings; weather: WeatherPayload | null; index: number; onSelect: (index: number) => void }) {
  return <div className="live-card"><h3>{panelLabels.get(panel) || "Station information"}</h3><div className="live-rotation-body"><PanelContent panel={panel} items={items} settings={settings} weather={weather}/></div><div className="live-rotation-dots">{settings.live_board_panels.map((key, panelIndex) => <button type="button" className={panelIndex === index % settings.live_board_panels.length ? "active" : ""} key={key} onClick={() => onSelect(panelIndex)} aria-label={`Show ${panelLabels.get(key)}`}/>)}<span>Rotates every {settings.board_rotation_seconds} seconds</span></div></div>;
}

function PanelContent({ panel, items, settings, weather }: { panel: FoundationSettings["live_board_panels"][number]; items: DepartmentModuleItem[]; settings: FoundationSettings; weather: WeatherPayload | null }) {
  const equipment = items.filter((item) => item.item_type === "apparatus" && ["attention", "offline"].includes(item.operational_status));
  const duty = items.filter((item) => ["station", "notice"].includes(item.item_type) && item.operational_status === "active");
  const training = items.filter((item) => item.item_type === "resource" && ["active", "ready"].includes(item.operational_status));
  if (panel === "equipment") return <ItemList items={equipment} empty="No equipment issues are recorded on this board."/>;
  if (panel === "duty") return <ItemList items={duty} empty="No current daily duty is connected to this board."/>;
  if (panel === "training") return <ItemList items={training} empty="No upcoming training entries are recorded on this board."/>;
  if (panel === "closecalls") return <EmptySource title="Close-call source not connected" text="Configure an authorized source before outside reports are shown."/>;
  if (panel === "lodd") return <EmptySource title="Official LODD source not connected" text="This board does not display an unverified live total."/>;
  if (panel === "weather") return weather?.today ? <WeatherPanel period={weather.today}/> : <EmptySource title={weather?.error || weather?.reason || "Weather source not configured"}/>;
  if (panel === "alerts") return weather?.alerts?.length ? <div className="live-news-list">{weather.alerts.slice(0, 5).map((alert) => <article key={alert.id}><b>{alert.event}</b><span>{alert.headline || alert.description}</span></article>)}</div> : <EmptySource title={weather?.configured ? "No active NWS alerts" : "Weather alerts not configured"}/>;
  return <LinkedSource title="Weather radar source" url={settings.live_board_radar_url} detail={`Scheduled every ${settings.live_board_radar_refresh_minutes} minutes for ${settings.live_board_radar_display_seconds} seconds`}/>;
}

function WeatherPanel({ period }: { period: WeatherPeriod }) {
  return <div className="live-weather-panel"><strong>{period.temperature ?? "--"}°{period.temperatureUnit}</strong><div><b>{period.shortForecast}</b><span>{period.windDirection} {period.windSpeed}</span></div></div>;
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

function ApparatusWidget({ apparatus, ridingAssignments, configuredCount, view }: { apparatus: DepartmentModuleItem[]; ridingAssignments: DepartmentModuleItem[]; configuredCount: number; view: number }) {
  const ridingView = view % 2 === 1;
  let content;
  if (ridingView) {
    content = ridingAssignments.length
      ? <div className="live-riding-grid">{ridingAssignments.slice(0, 8).map((item) => <article key={item.id}><b>{item.title}</b><span>{item.summary || item.location || item.operational_status}</span></article>)}</div>
      : <EmptySource title="No riding assignments are connected" text="Add saved riding-assignment records or connect the department schedule."/>;
  } else {
    content = apparatus.length
      ? <div className="live-apparatus-strip">{apparatus.map((item) => <article className={item.operational_status} key={item.id}><b>{item.title}</b><span>{item.operational_status}</span></article>)}</div>
      : <EmptySource title="No apparatus status records" text={configuredCount ? `${configuredCount} vehicles are configured in the department profile, but their live status is not connected.` : "Add real apparatus entries or connect an authorized fleet source."}/>;
  }
  return <div className="live-card"><h3>{ridingView ? "Riding assignments" : "Apparatus status · Fleet + CAD"}</h3>{content}<p>{ridingView ? "Assignments use saved department records only." : "Units are never shown in a status without a saved department record."}</p></div>;
}

function ExternalWidget({ link }: { link?: FoundationSettings["live_board_external_links"][number] }) {
  return <div className="live-card"><h3>{link?.title || "External display"}</h3>{link ? <div className="live-linked-source"><b>Outside display link</b><span>Open the configured source in a separate tab.</span><a href={link.url} target="_blank" rel="noreferrer">Open source</a></div> : <EmptySource title="External display not found"/>}</div>;
}

function RadarOverlay({ takeover, radarUrl, clock, onClose }: { takeover: RadarTakeover; radarUrl: string; clock: Date | null; onClose: () => void }) {
  const remaining = Math.max(0, Math.ceil((takeover.endsAt - (clock?.getTime() ?? takeover.endsAt)) / 1000));
  return <div className={`live-radar-takeover ${takeover.kind === "severe" ? "severe" : ""}`} data-incident-priority="respond" role="alert" aria-live="assertive"><header><div><span>{takeover.kind === "severe" ? "WEATHER WARNING · PRIORITY DISPLAY" : "WEATHER RADAR"}</span><h2>{takeover.title}</h2><p>{takeover.detail}</p></div><div><b>{remaining}s</b><button type="button" onClick={onClose}>Return to board</button></div></header><div className="live-radar-frame">{radarUrl ? <iframe title={`${takeover.title} radar`} src={radarUrl} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups"/> : <div className="live-radar-missing"><b>Radar source not configured</b><span>The warning remains visible, but the department must save a selected-area HTTPS radar link. Respond always overrides this display.</span></div>}</div></div>;
}

function BoardSettings({ action, settings, definitions, order, hidden, widths, weatherLocation, supportSessionId, onMove, onHidden, onWidth, onPreview }: {
  action: string;
  settings: FoundationSettings;
  definitions: { key: string; label: string }[];
  order: string[];
  hidden: string[];
  widths: Record<string, LiveBoardWidth>;
  weatherLocation: string;
  supportSessionId: string;
  onMove: (id: string, direction: -1 | 1) => void;
  onHidden: (hidden: string[]) => void;
  onWidth: (id: string, width: LiveBoardWidth) => void;
  onPreview: (kind: RadarTakeover["kind"]) => void;
}) {
  const definitionMap = new Map(definitions.map((definition) => [definition.key, definition.label]));
  return <form method="post" action={action} className="live-board-settings">
    <input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="live_board_order" value={order.join(",")}/><input type="hidden" name="live_board_visibility_marker" value="yes"/>
    <header><div><span>THIS DEPARTMENT</span><h3>Live Ops display settings</h3><p>Saved here as a department override. New departments start from the owner foundation.</p></div><button type="submit">Save board</button></header>
    <div className="live-settings-grid">
      <section><h4>Display timing</h4><div className="live-settings-row"><label>Weather, station, and riding rotation<input name="board_rotation_seconds" type="number" min={5} max={300} defaultValue={settings.board_rotation_seconds}/></label><label>Response display after an incident clears<input name="response_duration_seconds" type="number" min={5} max={600} defaultValue={settings.response_duration_seconds}/></label></div><label className="live-setting-toggle"><input name="live_board_show_next_shift" type="checkbox" defaultChecked={settings.live_board_show_next_shift}/>Show next shift change tile</label><input type="hidden" name="live_board_title" value={settings.live_board_title}/></section>
      <section><h4>Station information rotation</h4><div className="live-panel-checks">{liveBoardPanels.map((panel) => <label key={panel.key}><input type="checkbox" name="live_board_panels" value={panel.key} defaultChecked={settings.live_board_panels.includes(panel.key)}/>{panel.label}</label>)}</div></section>
      <section className="full"><h4>Board layout</h4><div className="live-layout-list">{order.map((id, index) => <article key={id}><label><input type="checkbox" name="live_board_visible" value={id} checked={!hidden.includes(id)} onChange={(event) => onHidden(event.target.checked ? hidden.filter((value) => value !== id) : [...hidden, id])}/><span>{definitionMap.get(id) || id}</span></label><select name={`live_board_width_${id}`} value={widths[id] || "half"} onChange={(event) => onWidth(id, event.target.value as LiveBoardWidth)}><option value="third">One third</option><option value="half">Half</option><option value="full">Full</option></select><button type="button" onClick={() => onMove(id, -1)} disabled={index === 0}>Up</button><button type="button" onClick={() => onMove(id, 1)} disabled={index === order.length - 1}>Down</button></article>)}</div><small>Checked cards are visible. Drag cards on the board or use Up and Down.</small></section>
      <section className="full"><h4>Weather priority, radar, and outside links</h4><p className="live-weather-location"><b>Weather coordinates:</b> {weatherLocation || "Not configured"}. Change them in Department settings.</p><div className="live-source-fields"><label>Weather display link<input name="live_board_weather_url" type="url" placeholder="https://" defaultValue={settings.live_board_weather_url}/></label><label>Weather alerts link<input name="live_board_alerts_url" type="url" placeholder="https://" defaultValue={settings.live_board_alerts_url}/></label><label>Selected-area radar link<input name="live_board_radar_url" type="url" placeholder="https://radar.weather.gov/" defaultValue={settings.live_board_radar_url}/></label><label>Full-screen radar every (minutes)<input name="live_board_radar_refresh_minutes" type="number" min={1} max={120} defaultValue={settings.live_board_radar_refresh_minutes}/></label><label>Scheduled radar duration (seconds)<input name="live_board_radar_display_seconds" type="number" min={10} max={180} defaultValue={settings.live_board_radar_display_seconds}/></label><label>Severe warning radar duration (seconds)<input name="live_board_severe_radar_seconds" type="number" min={30} max={300} defaultValue={settings.live_board_severe_radar_seconds}/></label><label>Weather amount<select name="live_board_forecast_detail" defaultValue={settings.live_board_forecast_detail}><option value="current">Current conditions</option><option value="3">3-day view</option><option value="7">7-day view</option></select></label><label className="external-lines">External displays · one per line<textarea name="live_board_external_links" rows={4} placeholder="Traffic camera | https://example.com" defaultValue={settings.live_board_external_links.map((entry) => `${entry.title} | ${entry.url}`).join("\n")}/></label></div><div className="live-radar-previews"><button type="button" onClick={() => onPreview("scheduled")}>Preview scheduled radar</button><button className="severe" type="button" onClick={() => onPreview("severe")}>Preview severe warning</button></div><small>Forecasts and active alerts use the National Weather Service only when verified coordinates are saved. Outside links open separately; never paste credentials or secret tokens.</small></section>
    </div>
  </form>;
}
