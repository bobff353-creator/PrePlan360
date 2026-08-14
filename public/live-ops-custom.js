/* eslint-disable @typescript-eslint/no-unused-vars */
/* global APPARATUS, CLOSECALLS, EQUIP, TRAINING, SCHX, buildNav, current: writable, cycleRot: writable, dlRidingSummary, nextBoardRotateAt: writable, paintRot: writable, render: writable, rotIdx: writable, schxTemplate, setRot: writable, toneOn, toggleTone: writable, viewBoard: writable */

(function loadLiveOpsPriorityStyles() {
  if (document.querySelector('link[data-live-ops-priority]')) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/live-ops-priority.css?v=20260813-weather-priority";
  stylesheet.dataset.liveOpsPriority = "true";
  document.head.appendChild(stylesheet);
})();

const BOARD_STORAGE_KEY = "fireflow360.liveBoard.v6";
const BOARD_PANEL_LABELS = { equipment: "Equipment Issues", duty: "Current Daily Duty", closecalls: "Firefighter Close Calls", lodd: "U.S. Firefighter LODD", training: "Upcoming Training", weather: "Weather", alerts: "Weather Alerts", radar: "Weather Radar" };
const BOARD_DEFAULTS = {
  schemaVersion: 6,
  department: "Redstone Valley Fire & Rescue",
  title: "Live Operations",
  order: ["summary", "station", "apparatus"],
  visible: { summary: true, station: true, apparatus: true },
  widths: { summary: "full", station: "half", apparatus: "half" },
  panels: ["equipment", "duty", "closecalls", "training"],
  rotationSec: 12,
  responseSec: 90,
  showNextShift: true,
  forecastDetail: "3",
  equipmentUrl: "",
  closecallsUrl: "",
  loddUrl: "https://apps.usfa.fema.gov/firefighter-fatalities",
  trainingUrl: "",
  sourceRefreshMin: 5,
  weatherUrl: "",
  alertsUrl: "",
  radarUrl: "",
  radarRefreshMin: 5,
  radarDisplaySec: 30,
  severeRadarSec: 90,
  external: [],
};
const DEMO_WEATHER = [
  { label: "TODAY · SIMULATED", title: "Partly cloudy · 82° / 67°", detail: "Light southwest wind · 20% evening rain chance" },
  { label: "TOMORROW · SIMULATED", title: "Scattered storms · 79° / 65°", detail: "Demo forecast only · verify an official source" },
  { label: "NEXT 5 HOURS · SIMULATED", title: "17:00 81° · 18:00 79° · 19:00 76°", detail: "20:00 73° · 21:00 71°" },
];
const DEMO_RIDING = [
  { unit: "E-1204", crew: "Capt. J. Mercer · FF N. Brooks" },
  { unit: "T-1211", crew: "Lt. K. Ellis · FF T. Rowan" },
  { unit: "M-1231", crew: "FF/PM S. Hale · P. Quinn" },
  { unit: "C-1201", crew: "Chief A. Morgan" },
];

let boardSettingsOpen = false;
let boardDragId = "";
let lastRadarRefresh = 0;
let boardWeatherIndex = 0;
let apparatusRotationIndex = 0;
let nextWeatherRotateAt = Date.now() + 12000;
let nextApparatusRotateAt = Date.now() + 12000;
let nextScheduledRadarAt = Date.now() + 5 * 60000;
let radarTakeover = null;
let radarTakeoverTimer = null;
let lastSourceRefresh = Date.now();
let demoLodd = null;
let nextSummaryRefreshAt = Date.now() + 60000;

function cloneBoardDefaults() { return JSON.parse(JSON.stringify(BOARD_DEFAULTS)); }
function safeText(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]; }); }
function validHttpUrl(value) { try { const url = new URL(String(value || "").trim()); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : ""; } catch { return ""; } }
function bounded(value, minimum, maximum, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed))) : fallback; }
function militaryTime(date) { return [date.getHours(), date.getMinutes(), date.getSeconds()].map(function (value) { return String(value).padStart(2, "0"); }).join(":"); }

function normalizeBoardCfg(raw) {
  const saved = raw && typeof raw === "object" ? raw : {};
  const config = Object.assign(cloneBoardDefaults(), saved);
  config.visible = Object.assign({}, BOARD_DEFAULTS.visible, saved.visible || {});
  config.widths = Object.assign({}, BOARD_DEFAULTS.widths, saved.widths || {});
  config.external = Array.isArray(config.external) ? config.external.map(function (source) {
    return { id: String(source.id || ("ext-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7))), title: String(source.title || "External display").slice(0, 80), url: validHttpUrl(source.url) };
  }).filter(function (source) { return source.url; }) : [];
  const known = ["summary", "station", "apparatus"].concat(config.external.map(function (source) { return source.id; }));
  config.order = Array.isArray(config.order) ? config.order.filter(function (id, index, array) { return known.includes(id) && array.indexOf(id) === index; }) : [];
  known.forEach(function (id) { if (!config.order.includes(id)) config.order.push(id); if (config.visible[id] === undefined) config.visible[id] = true; if (!config.widths[id]) config.widths[id] = id === "summary" ? "full" : "half"; });
  config.panels = Array.isArray(config.panels) ? config.panels.filter(function (key, index, array) { return BOARD_PANEL_LABELS[key] && array.indexOf(key) === index; }) : BOARD_DEFAULTS.panels.slice();
  if (!config.panels.length) config.panels = ["equipment"];
  const legacy = Number(saved.schemaVersion || 0) < BOARD_DEFAULTS.schemaVersion;
  config.schemaVersion = BOARD_DEFAULTS.schemaVersion;
  config.rotationSec = bounded(legacy ? BOARD_DEFAULTS.rotationSec : config.rotationSec, 5, 300, 12);
  config.responseSec = bounded(legacy ? BOARD_DEFAULTS.responseSec : config.responseSec, 5, 600, 90);
  config.sourceRefreshMin = bounded(legacy ? BOARD_DEFAULTS.sourceRefreshMin : config.sourceRefreshMin, 1, 120, 5);
  config.radarRefreshMin = bounded(legacy ? BOARD_DEFAULTS.radarRefreshMin : config.radarRefreshMin, 1, 120, 5);
  config.radarDisplaySec = bounded(config.radarDisplaySec, 10, 180, 30);
  config.severeRadarSec = bounded(config.severeRadarSec, 30, 300, 90);
  config.showNextShift = config.showNextShift !== false;
  config.forecastDetail = ["current", "3", "7"].includes(String(config.forecastDetail)) ? String(config.forecastDetail) : "3";
  config.equipmentUrl = validHttpUrl(config.equipmentUrl);
  config.closecallsUrl = validHttpUrl(config.closecallsUrl);
  config.loddUrl = validHttpUrl(config.loddUrl) || BOARD_DEFAULTS.loddUrl;
  config.trainingUrl = validHttpUrl(config.trainingUrl);
  config.weatherUrl = validHttpUrl(config.weatherUrl);
  config.alertsUrl = validHttpUrl(config.alertsUrl);
  config.radarUrl = validHttpUrl(config.radarUrl);
  config.department = String(config.department || BOARD_DEFAULTS.department).slice(0, 80);
  config.title = String(config.title || BOARD_DEFAULTS.title).slice(0, 80);
  return config;
}

function loadBoardCfg() {
  try {
    const currentValue = localStorage.getItem(BOARD_STORAGE_KEY);
    const legacyValue = localStorage.getItem("fireflow360.liveBoard.v5") || localStorage.getItem("fireflow360.liveBoard.v4") || localStorage.getItem("fireflow360.liveBoard.v3");
    return normalizeBoardCfg(JSON.parse(currentValue || legacyValue || "null"));
  } catch { return cloneBoardDefaults(); }
}

let boardCfg = loadBoardCfg();
function saveBoardCfg() { localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boardCfg)); }
function boardDefs() { return [{ id: "summary", label: "Staffing and incident summary" }, { id: "station", label: "Rotating station information" }, { id: "apparatus", label: "Apparatus and riding assignments" }].concat(boardCfg.external.map(function (source) { return { id: source.id, label: source.title }; })); }
function openBoardSettings() { boardSettingsOpen = true; render(); }
function closeBoardSettings() { boardSettingsOpen = false; render(); }
function moveBoardWidget(id, direction) { const order = boardCfg.order.slice(), index = order.indexOf(id), target = index + direction; if (index < 0 || target < 0 || target >= order.length) return; [order[index], order[target]] = [order[target], order[index]]; boardCfg.order = order; saveBoardCfg(); render(); }
function boardDragStart(event, id) { boardDragId = id; event.currentTarget.classList.add("dragging"); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); }
function boardDragOver(event) { event.preventDefault(); event.currentTarget.classList.add("dragover"); event.dataTransfer.dropEffect = "move"; }
function boardDragLeave(event) { event.currentTarget.classList.remove("dragover"); }
function boardDrop(event, target) { event.preventDefault(); event.currentTarget.classList.remove("dragover"); const source = boardDragId || event.dataTransfer.getData("text/plain"); if (!source || source === target) return; const order = boardCfg.order.filter(function (id) { return id !== source; }), targetIndex = order.indexOf(target); order.splice(targetIndex < 0 ? order.length : targetIndex, 0, source); boardCfg.order = order; saveBoardCfg(); render(); }
function boardDragEnd(event) { event.currentTarget.classList.remove("dragging"); document.querySelectorAll(".board-widget").forEach(function (widget) { widget.classList.remove("dragover"); }); boardDragId = ""; }

function sourceFrame(url, label, height, refresh) {
  if (!url) return '<div class="board-empty"><b>' + safeText(label) + ' source not configured</b><div style="margin-top:6px">Open Board settings and paste a complete HTTPS display link.</div></div>';
  let source = url;
  if (refresh) { try { const refreshed = new URL(url); refreshed.searchParams.set("fireflow_refresh", String(Date.now())); source = refreshed.toString(); } catch { /* Keep the validated source unchanged. */ } }
  return '<div class="embed-shell"><iframe src="' + safeText(source) + '" title="' + safeText(label) + '" style="min-height:' + height + 'px" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-forms allow-popups allow-scripts allow-same-origin"></iframe><div class="embed-tools"><span class="muted" style="font-size:11px;flex:1">If the source blocks embedding, use Open source.</span><a class="btn" target="_blank" rel="noopener noreferrer" href="' + safeText(url) + '">Open source</a></div></div>';
}
function sourceButton(url, label) {
  return url ? '<a class="btn source-link" target="_blank" rel="noopener noreferrer" href="' + safeText(url) + '">' + safeText(label) + '</a>' : '<button class="btn source-link" type="button" onclick="openBoardSettings()">Set source link</button>';
}
function internalPanelAction(view, label, detail) {
  return '<div class="panel-action"><span>' + safeText(detail) + '</span><button class="btn pri" type="button" onclick="go(\'' + safeText(view) + '\')">' + safeText(label) + '</button></div>';
}
function externalPanelAction(url, label, detail) {
  return '<div class="panel-action"><span>' + safeText(detail) + '</span>' + sourceButton(url, label) + '</div>';
}
function loddMarkup() {
  if (!demoLodd) return '<div class="board-empty"><b>Loading official U.S. Fire Administration records</b><div style="margin-top:6px">This source rechecks every ' + boardCfg.sourceRefreshMin + ' minutes while the board is open.</div></div>';
  if (demoLodd.error) return '<div class="board-empty"><b>' + safeText(demoLodd.error) + '</b><div style="margin-top:6px">No total is shown while the official source is unavailable.</div>' + sourceButton(boardCfg.loddUrl || demoLodd.sourceUrl, "Open official USFA source") + '</div>';
  const recent = (demoLodd.recent || []).slice(0, 5).map(function (entry) { return '<a class="lodd-entry" target="_blank" rel="noopener noreferrer" href="' + safeText(entry.url || demoLodd.sourceUrl) + '"><b>' + safeText(entry.name) + '</b><span>' + safeText([entry.department, entry.location, entry.deathDate].filter(Boolean).join(" · ")) + '</span></a>'; }).join("");
  return '<div class="lodd-live"><div class="lodd-total"><strong>' + safeText(demoLodd.total) + '</strong><span>U.S. firefighter fatalities reported for ' + safeText(demoLodd.year) + '</span></div><div class="lodd-recent">' + recent + '</div><div class="lodd-source"><span>Official USFA feed · rechecks every ' + boardCfg.sourceRefreshMin + ' minutes</span>' + sourceButton(boardCfg.loddUrl || demoLodd.sourceUrl, "Open official source") + '</div></div>';
}
async function loadDemoLodd() {
  try {
    const response = await fetch("/api/live-sources/lodd", { cache: "no-store" });
    demoLodd = await response.json();
  } catch {
    demoLodd = { sourceUrl: boardCfg.loddUrl, error: "Official LODD source temporarily unavailable", recent: [] };
  }
  const panels = activeBoardPanels();
  if (current === "board" && panels[rotIdx] === "lodd") paintRot(false);
}
function widgetShell(id, body) { const width = boardCfg.widths[id] || "half"; return '<section class="board-widget w-' + safeText(width) + '" draggable="true" data-widget="' + safeText(id) + '" ondragstart="boardDragStart(event,\'' + safeText(id) + '\')" ondragover="boardDragOver(event)" ondragleave="boardDragLeave(event)" ondrop="boardDrop(event,\'' + safeText(id) + '\')" ondragend="boardDragEnd(event)"><div class="widget-grip" title="Drag to move"><span>Move</span><b>::</b></div>' + body + '</section>'; }

function boardRidingSummary() {
  return typeof dlRidingSummary === "function" ? dlRidingSummary() : { assignments: [], count: 0, minimum: 0, officer: null, scheduleName: "" };
}
function demoDateKey(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
function demoNextShift() {
  if (typeof SCHX === "undefined" || !Array.isArray(SCHX.shifts) || typeof schxTemplate !== "function") return null;
  const now = new Date();
  return SCHX.shifts.filter(function (shift) { return shift.status === "approved"; }).map(function (shift) {
    const template = schxTemplate(shift.templateId), start = template && /^\d{1,2}:\d{2}$/.test(template.start) ? template.start : "";
    const startsAt = start ? new Date(shift.date + "T" + start + ":00") : null;
    return startsAt && Number.isFinite(startsAt.getTime()) ? { name: shift.name || "Scheduled shift", date: shift.date, start: start, startsAt: startsAt, count: Array.isArray(shift.assignments) ? shift.assignments.length : 0 } : null;
  }).filter(function (shift) { return shift && shift.startsAt.getTime() > now.getTime(); }).sort(function (a, b) { return a.startsAt - b.startsAt; })[0] || null;
}
function demoShiftDateLabel(date) {
  const now = new Date();
  if (date === demoDateKey(now)) return "Today";
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === demoDateKey(tomorrow)) return "Tomorrow";
  return new Date(date + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function renderBoardSummary() {
  const staffing = boardRidingSummary();
  const nextShift = demoNextShift();
  const staffingValue = staffing.minimum ? staffing.count + " / " + staffing.minimum : String(staffing.count);
  const staffingDetail = staffing.count ? (staffing.minimum && staffing.count >= staffing.minimum ? "Complete · minimum met" : staffing.scheduleName || "Approved schedule") : "No approved staffing for today";
  const officerName = staffing.officer ? staffing.officer.name : "Not assigned";
  const officerDetail = staffing.officer ? staffing.officer.position + (staffing.officer.unit ? " · " + staffing.officer.unit : "") : "Set an officer on the approved schedule or Daily Log";
  const tiles = [
    '<div class="btile"><span>Staffing</span><strong>' + safeText(staffingValue) + '</strong><small>' + safeText(staffingDetail) + '</small></div>',
    '<div class="btile"><span>Officer in Charge</span><strong>' + safeText(officerName) + '</strong><small>' + safeText(officerDetail) + '</small></div>',
    '<div class="btile"><span>Active Call</span><strong>None</strong><small>Respond takes over automatically</small></div>',
  ];
  if (boardCfg.showNextShift) tiles.push('<div class="btile warn"><span>Next Shift Change</span><strong>' + safeText(nextShift ? nextShift.name + " · " + nextShift.start : "Not scheduled") + '</strong><small>' + safeText(nextShift ? demoShiftDateLabel(nextShift.date) + " · " + nextShift.count + " assigned" : "Add or approve the next calendar shift") + '</small></div>');
  return '<div class="bsummary compact cols-' + tiles.length + '">' + tiles.join("") + '</div>';
}
function renderStationWidget() { return '<div class="card rotpanel"><h3 id="rotTitle">Station Information</h3><div id="rotBody"></div><div class="rotdots" id="rotDots"></div></div>'; }
function apparatusStatusMarkup() { return '<div class="appstrip">' + APPARATUS.map(function (apparatus) { const statusClass = apparatus.status === "Out of Service" ? "oos" : ""; return '<div class="appchip ' + statusClass + '"><b>' + safeText(apparatus.u) + '</b><span>' + safeText(apparatus.status) + '</span></div>'; }).join("") + '</div><p class="muted apparatus-note">Demo fleet status is simulated and is not connected to live CAD.</p>'; }
function ridingAssignmentMarkup() {
  const assignments = boardRidingSummary().assignments;
  if (!assignments.length) return '<div class="board-empty"><b>No approved riding assignments for today</b><div style="margin-top:6px">Approve a dated schedule to prefill both Daily Log and this board.</div></div>';
  const units = new Map();
  assignments.forEach(function (assignment) {
    const unit = assignment.unit || "Unassigned";
    if (!units.has(unit)) units.set(unit, []);
    units.get(unit).push((assignment.position || assignment.rank || "Assignment") + " · " + assignment.name);
  });
  return '<div class="riding-grid">' + Array.from(units.entries()).map(function (entry) { return '<article><b>' + safeText(entry[0]) + '</b><span>' + entry[1].map(safeText).join("<br>") + '</span></article>'; }).join("") + '</div><p class="muted apparatus-note">Approved schedule roles · Daily Log name and unit adjustments appear here.</p>';
}
function apparatusRotationMarkup() { const riding = apparatusRotationIndex % 2 === 1; return '<div class="apparatus-rotation-head"><h3>' + (riding ? "Riding Assignments" : "Apparatus Status · Fleet + CAD") + '</h3><span>' + (riding ? "CREWS" : "FLEET") + ' · rotates every ' + boardCfg.rotationSec + 's</span></div>' + (riding ? ridingAssignmentMarkup() : apparatusStatusMarkup()); }
function paintApparatusRotation() { const target = document.getElementById("apparatusRotation"); if (target) target.innerHTML = apparatusRotationMarkup(); }
function renderApparatusWidget() { return '<div class="card apparatus-card"><div id="apparatusRotation">' + apparatusRotationMarkup() + '</div><div class="apparatus-actions"><button class="btn pri" onclick="toggleTone()">Simulate Dispatch</button><button class="btn" onclick="advanceApparatusRotation()">Advance</button></div></div>'; }
function advanceApparatusRotation() { apparatusRotationIndex = (apparatusRotationIndex + 1) % 2; nextApparatusRotateAt = Date.now() + boardCfg.rotationSec * 1000; paintApparatusRotation(); }
function renderExternalWidget(id) { const source = boardCfg.external.find(function (entry) { return entry.id === id; }); return source ? '<div class="card"><h3>' + safeText(source.title) + '</h3>' + sourceFrame(source.url, source.title, 340, false) + '</div>' : ""; }
function renderBoardWidget(id) { if (id === "summary") return widgetShell(id, renderBoardSummary()); if (id === "station") return widgetShell(id, renderStationWidget()); if (id === "apparatus") return widgetShell(id, renderApparatusWidget()); return widgetShell(id, renderExternalWidget(id)); }
function activeBoardPanels() { return boardCfg.panels.length ? boardCfg.panels : ["equipment"]; }
function forecastHeight() { return boardCfg.forecastDetail === "current" ? 240 : boardCfg.forecastDetail === "7" ? 560 : 390; }

paintRot = function (forceRefresh) {
  const panels = activeBoardPanels();
  if (rotIdx >= panels.length) rotIdx = 0;
  const key = panels[rotIdx], title = document.getElementById("rotTitle"), body = document.getElementById("rotBody"), dots = document.getElementById("rotDots");
  if (!title || !body || !dots) return;
  title.textContent = BOARD_PANEL_LABELS[key] || "Station Information";
  if (key === "equipment") body.innerHTML = EQUIP.map(function (equipment) { return '<div class="newsitem"><strong>' + safeText(equipment.item) + ' · <span style="color:var(--warn)">' + safeText(equipment.status) + '</span></strong><span class="muted" style="font-size:12px">' + safeText(equipment.detail) + '</span></div>'; }).join("") + (boardCfg.equipmentUrl ? externalPanelAction(boardCfg.equipmentUrl, "Open apparatus checks", "Record Pass, Fail, or Missing. Failed and missing items use a write-up note and phone photo.") : internalPanelAction("inv", "Open apparatus checks", "Record Pass, Fail, or Missing. Failed and missing items use a write-up note and phone photo."));
  else if (key === "duty") body.innerHTML = '<div class="result" style="text-align:left"><span class="pill p-fire">NOW · Afternoon</span><div style="font-size:18px;font-weight:800;margin-top:8px">Hydrant flow testing · Zone 4 East</div><div class="muted">5 hydrants due this cycle · record static/residual in Hydrants</div></div>' + internalPanelAction("duty", "Open Daily Duties", "View and complete today’s station duties.");
  else if (key === "closecalls") body.innerHTML = CLOSECALLS.map(function (call) { return '<div class="newsitem"><time>' + safeText(call.date) + '</time><strong>' + safeText(call.title) + '</strong></div>'; }).join("") + externalPanelAction(boardCfg.closecallsUrl, "Open close-call source", "Demo headlines are fictional. Open the department’s configured source for current reports.");
  else if (key === "lodd") body.innerHTML = loddMarkup();
  else if (key === "training") body.innerHTML = TRAINING.map(function (training) { return '<div class="newsitem"><strong>' + safeText(training.course) + '</strong><span class="muted" style="font-size:12px">' + safeText(training.prov) + ' · ' + safeText(training.dates) + '</span></div>'; }).join("") + externalPanelAction(boardCfg.trainingUrl, "Open training source", "Demo training is fictional. Open the configured source for current opportunities.");
  else if (key === "weather") body.innerHTML = '<div class="muted" style="font-size:11px;margin-bottom:8px">Configured weather view: ' + safeText(boardCfg.forecastDetail === "current" ? "current conditions" : boardCfg.forecastDetail + " day") + '</div>' + sourceFrame(boardCfg.weatherUrl, "Weather", forecastHeight(), !!forceRefresh);
  else if (key === "alerts") body.innerHTML = '<div class="weather-alert"><b>Weather alert source</b><div class="muted" style="font-size:11px;margin-top:3px">Only the configured source is displayed. This fictional demo does not issue live warnings.</div></div>' + sourceFrame(boardCfg.alertsUrl, "Weather alerts", 320, !!forceRefresh);
  else if (key === "radar") { body.innerHTML = '<div class="radar-takeover-map demo-radar-inline">' + radarSourceMarkup() + '</div><div class="embed-tools"><span class="muted" style="font-size:11px;flex:1">Fictional animated radar keeps the demo usable. Department boards use official NOAA radar.</span>' + sourceButton(boardCfg.radarUrl, "Open configured radar") + '</div>'; lastRadarRefresh = Date.now(); }
  dots.innerHTML = panels.map(function (panel, index) { return '<button class="' + (index === rotIdx ? "active" : "") + '" onclick="setRot(' + index + ')" aria-label="Show ' + safeText(BOARD_PANEL_LABELS[panel]) + '"></button>'; }).join("") + '<span>Rotates every ' + boardCfg.rotationSec + ' seconds</span>';
};
cycleRot = function () { const panels = activeBoardPanels(); rotIdx = (rotIdx + 1) % panels.length; nextBoardRotateAt = Date.now() + boardCfg.rotationSec * 1000; paintRot(false); };
setRot = function (index) { rotIdx = index; nextBoardRotateAt = Date.now() + boardCfg.rotationSec * 1000; paintRot(false); };

function weatherStripMarkup() {
  const weather = DEMO_WEATHER[boardWeatherIndex % DEMO_WEATHER.length];
  return '<div class="board-weather-copy"><span>' + safeText(weather.label) + '</span><strong>' + safeText(weather.title) + '</strong><small>' + safeText(weather.detail) + '</small></div>';
}
function paintBoardWeather() { const target = document.getElementById("boardWeatherCopy"); if (target) target.innerHTML = weatherStripMarkup(); }

function simulatedRadarMarkup() {
  return '<div class="demo-radar" aria-label="Simulated radar for fictional Redstone Valley"><div class="demo-radar-grid"></div><div class="demo-radar-cell cell-one"></div><div class="demo-radar-cell cell-two"></div><div class="demo-radar-cell cell-three"></div><div class="demo-radar-station">STATION 1</div><div class="demo-radar-sweep"></div></div>';
}
function radarSourceMarkup() {
  return simulatedRadarMarkup();
}
function radarTakeoverMarkup() {
  if (!radarTakeover) return "";
  const seconds = Math.max(0, Math.ceil((radarTakeover.endsAt - Date.now()) / 1000));
  return '<section class="radar-takeover ' + (radarTakeover.kind === "severe" ? "severe" : "scheduled") + '" role="alert" aria-label="' + safeText(radarTakeover.title) + '"><header><div><span>' + (radarTakeover.kind === "severe" ? "WEATHER WARNING · DEMO ONLY" : "SCHEDULED RADAR · DEMO") + '</span><h2>' + safeText(radarTakeover.title) + '</h2><p>Simulated radar for the fictional demo · department boards use official NOAA radar</p></div><b id="radarTakeoverCountdown">' + seconds + 's</b></header><div class="radar-takeover-map">' + radarSourceMarkup() + '</div><footer><span>Any incident immediately closes this weather display and opens Respond.</span><div class="radar-takeover-actions">' + (boardCfg.radarUrl ? sourceButton(boardCfg.radarUrl, "Open configured radar") : "") + '<button class="btn pri" type="button" onclick="toggleTone()">Simulate incident override</button><button class="btn" type="button" onclick="closeRadarTakeover()">Return to board</button></div></footer></section>';
}
function startRadarTakeover(kind, title) {
  if (toneOn) return;
  closeRadarTakeover(false);
  const seconds = kind === "severe" ? boardCfg.severeRadarSec : boardCfg.radarDisplaySec;
  radarTakeover = { kind, title, endsAt: Date.now() + seconds * 1000 };
  if (kind === "scheduled") nextScheduledRadarAt = Date.now() + boardCfg.radarRefreshMin * 60000;
  radarTakeoverTimer = window.setTimeout(function () { closeRadarTakeover(); }, seconds * 1000);
  render();
}
function closeRadarTakeover(refresh) {
  if (radarTakeoverTimer) window.clearTimeout(radarTakeoverTimer);
  radarTakeoverTimer = null;
  const wasOpen = !!radarTakeover;
  radarTakeover = null;
  if (wasOpen && refresh !== false && current === "board") render();
}
function previewRadarTakeover() { boardSettingsOpen = false; startRadarTakeover("scheduled", "Selected-area radar"); }
function previewSevereRadarTakeover() { boardSettingsOpen = false; startRadarTakeover("severe", "Tornado Warning · fictional demonstration"); }

function saveBoardSettings() {
  boardCfg.department = document.getElementById("bc_department").value.trim() || BOARD_DEFAULTS.department;
  boardCfg.title = document.getElementById("bc_title").value.trim() || BOARD_DEFAULTS.title;
  boardCfg.rotationSec = document.getElementById("bc_rotation").value;
  boardCfg.responseSec = document.getElementById("bc_response").value;
  boardCfg.sourceRefreshMin = document.getElementById("bc_source_refresh").value;
  boardCfg.radarRefreshMin = document.getElementById("bc_radar_refresh").value;
  boardCfg.radarDisplaySec = document.getElementById("bc_radar_duration").value;
  boardCfg.severeRadarSec = document.getElementById("bc_severe_duration").value;
  boardCfg.showNextShift = document.getElementById("bc_show_next_shift").checked;
  boardCfg.forecastDetail = document.getElementById("bc_forecast").value;
  boardCfg.equipmentUrl = document.getElementById("bc_equipment_url").value;
  boardCfg.closecallsUrl = document.getElementById("bc_closecalls_url").value;
  boardCfg.loddUrl = document.getElementById("bc_lodd_url").value;
  boardCfg.trainingUrl = document.getElementById("bc_training_url").value;
  boardCfg.weatherUrl = document.getElementById("bc_weather_url").value;
  boardCfg.alertsUrl = document.getElementById("bc_alerts_url").value;
  boardCfg.radarUrl = document.getElementById("bc_radar_url").value;
  boardCfg.panels = Array.from(document.querySelectorAll("[data-board-panel]:checked")).map(function (input) { return input.value; });
  boardDefs().forEach(function (definition) { const visible = document.querySelector('[data-widget-visible="' + definition.id + '"]'), width = document.querySelector('[data-widget-width="' + definition.id + '"]'); boardCfg.visible[definition.id] = !!(visible && visible.checked); if (width) boardCfg.widths[definition.id] = width.value; });
  boardCfg = normalizeBoardCfg(boardCfg);
  saveBoardCfg();
  boardSettingsOpen = false;
  nextBoardRotateAt = Date.now() + boardCfg.rotationSec * 1000;
  nextWeatherRotateAt = nextBoardRotateAt;
  nextApparatusRotateAt = nextBoardRotateAt;
  nextScheduledRadarAt = Date.now() + boardCfg.radarRefreshMin * 60000;
  lastRadarRefresh = 0;
  lastSourceRefresh = Date.now();
  void loadDemoLodd();
  render();
}
function addExternalSource() { const title = document.getElementById("bc_ext_title").value.trim() || "External display", url = validHttpUrl(document.getElementById("bc_ext_url").value); if (!url) { alert("Enter a complete http or https link."); return; } const id = "ext-" + Date.now().toString(36); boardCfg.external.push({ id, title: title.slice(0, 80), url }); boardCfg.order.push(id); boardCfg.visible[id] = true; boardCfg.widths[id] = "half"; saveBoardCfg(); render(); }
function removeExternalSource(id) { boardCfg.external = boardCfg.external.filter(function (source) { return source.id !== id; }); boardCfg.order = boardCfg.order.filter(function (entry) { return entry !== id; }); delete boardCfg.visible[id]; delete boardCfg.widths[id]; saveBoardCfg(); render(); }
function resetBoardSettings() { if (!confirm("Reset this display to the default Live Ops layout?")) return; localStorage.removeItem(BOARD_STORAGE_KEY); boardCfg = cloneBoardDefaults(); saveBoardCfg(); boardSettingsOpen = false; rotIdx = 0; nextScheduledRadarAt = Date.now() + boardCfg.radarRefreshMin * 60000; lastSourceRefresh = Date.now(); void loadDemoLodd(); render(); }

function boardConfigMarkup() {
  const panelChecks = Object.keys(BOARD_PANEL_LABELS).map(function (key) { return '<label class="checkrow"><input type="checkbox" data-board-panel value="' + key + '" ' + (boardCfg.panels.includes(key) ? "checked" : "") + '><span>' + safeText(BOARD_PANEL_LABELS[key]) + '</span></label>'; }).join("");
  const layoutRows = boardCfg.order.map(function (id) { const definition = boardDefs().find(function (entry) { return entry.id === id; }); if (!definition) return ""; const width = boardCfg.widths[id] || "half"; return '<div class="layout-row"><label class="checkrow" style="padding:7px 9px"><input type="checkbox" data-widget-visible="' + safeText(id) + '" ' + (boardCfg.visible[id] !== false ? "checked" : "") + '><span>' + safeText(definition.label) + '</span></label><select data-widget-width="' + safeText(id) + '"><option value="third" ' + (width === "third" ? "selected" : "") + '>One third</option><option value="half" ' + (width === "half" ? "selected" : "") + '>Half</option><option value="full" ' + (width === "full" ? "selected" : "") + '>Full</option></select><button class="btn" onclick="moveBoardWidget(\'' + safeText(id) + '\',-1)">Up</button><button class="btn" onclick="moveBoardWidget(\'' + safeText(id) + '\',1)">Down</button></div>'; }).join("");
  const sources = boardCfg.external.length ? boardCfg.external.map(function (source) { return '<div class="source-item"><span><b>' + safeText(source.title) + '</b><small>' + safeText(source.url) + '</small></span><button class="btn" onclick="removeExternalSource(\'' + safeText(source.id) + '\')">Remove</button></div>'; }).join("") : '<div class="muted" style="font-size:12px">No external display links added yet.</div>';
  return '<div class="config-backdrop" role="dialog" aria-modal="true" aria-label="Live Ops Board settings" onclick="if(event.target===this)closeBoardSettings()"><div class="config-panel"><div class="config-head"><div><div class="eyebrow">This display</div><h2>Live Ops Board settings</h2></div><button class="btn" onclick="closeBoardSettings()">Close</button></div><div class="config-body"><div class="config-grid">' +
    '<section class="config-section"><h3>Display timing</h3><div class="field"><label for="bc_department">Department or station</label><input id="bc_department" value="' + safeText(boardCfg.department) + '"></div><div class="field"><label for="bc_title">Display label</label><input id="bc_title" value="' + safeText(boardCfg.title) + '"></div><div class="field"><label for="bc_rotation">Weather, station, and riding rotation (seconds)</label><input id="bc_rotation" type="number" min="5" max="300" value="' + boardCfg.rotationSec + '"></div><div class="field"><label for="bc_response">Respond display time after incident clears (seconds)</label><input id="bc_response" type="number" min="5" max="600" value="' + boardCfg.responseSec + '"></div><label class="checkrow"><input id="bc_show_next_shift" type="checkbox" ' + (boardCfg.showNextShift ? "checked" : "") + '><span>Show Next Shift Change tile</span></label></section>' +
    '<section class="config-section"><h3>Station information rotation</h3><div class="checkgrid">' + panelChecks + '</div><div class="muted" style="font-size:11px;margin-top:10px">Choose exactly what this screen cycles through. At least one panel remains enabled.</div></section>' +
    '<section class="config-section full"><h3>Connected panel links and source timing</h3><div class="config-grid"><div><div class="field"><label for="bc_equipment_url">Apparatus check link</label><input id="bc_equipment_url" type="url" placeholder="https://..." value="' + safeText(boardCfg.equipmentUrl) + '"></div><div class="field"><label for="bc_closecalls_url">Firefighter close calls link</label><input id="bc_closecalls_url" type="url" placeholder="https://..." value="' + safeText(boardCfg.closecallsUrl) + '"></div><div class="field"><label for="bc_lodd_url">Official LODD link</label><input id="bc_lodd_url" type="url" placeholder="https://apps.usfa.fema.gov/firefighter-fatalities" value="' + safeText(boardCfg.loddUrl) + '"></div></div><div><div class="field"><label for="bc_training_url">Upcoming training link</label><input id="bc_training_url" type="url" placeholder="https://..." value="' + safeText(boardCfg.trainingUrl) + '"></div><div class="field"><label for="bc_source_refresh">Outside source recheck (minutes)</label><input id="bc_source_refresh" type="number" min="1" max="120" value="' + boardCfg.sourceRefreshMin + '"></div><div class="muted" style="font-size:11px">Default: 5 minutes. Official feeds and active embeds recheck only while this board is open; link-only panels open the source’s current page.</div></div></div></section>' +
    '<section class="config-section full"><h3>Weather priority and radar</h3><div class="config-grid"><div><div class="field"><label for="bc_forecast">Weather amount</label><select id="bc_forecast"><option value="current" ' + (boardCfg.forecastDetail === "current" ? "selected" : "") + '>Current conditions</option><option value="3" ' + (boardCfg.forecastDetail === "3" ? "selected" : "") + '>3-day view</option><option value="7" ' + (boardCfg.forecastDetail === "7" ? "selected" : "") + '>7-day view</option></select></div><div class="field"><label for="bc_radar_refresh">Full-screen radar every (minutes)</label><input id="bc_radar_refresh" type="number" min="1" max="120" value="' + boardCfg.radarRefreshMin + '"></div><div class="field"><label for="bc_radar_duration">Scheduled radar duration (seconds)</label><input id="bc_radar_duration" type="number" min="10" max="180" value="' + boardCfg.radarDisplaySec + '"></div><div class="field"><label for="bc_severe_duration">Severe warning radar duration (seconds)</label><input id="bc_severe_duration" type="number" min="30" max="300" value="' + boardCfg.severeRadarSec + '"></div></div><div><div class="field"><label for="bc_weather_url">Weather display link</label><input id="bc_weather_url" type="url" placeholder="https://..." value="' + safeText(boardCfg.weatherUrl) + '"></div><div class="field"><label for="bc_alerts_url">Weather alert link</label><input id="bc_alerts_url" type="url" placeholder="https://..." value="' + safeText(boardCfg.alertsUrl) + '"></div><div class="field"><label for="bc_radar_url">Optional radar webpage link</label><input id="bc_radar_url" type="url" placeholder="https://radar.weather.gov/..." value="' + safeText(boardCfg.radarUrl) + '"></div><div class="priority-preview-actions"><button class="btn" type="button" onclick="previewRadarTakeover()">Preview 30s radar</button><button class="btn severe" type="button" onclick="previewSevereRadarTakeover()">Preview severe warning</button></div></div></div><p class="muted" style="font-size:11px">Demo weather and radar are simulated. Department boards use official NOAA/NWS data from verified coordinates; saved radar webpages open separately.</p></section>' +
    '<section class="config-section full"><h3>Board layout</h3><div class="muted" style="font-size:11px;margin-bottom:6px">Drag cards directly on the board, or use these controls for touch and keyboard displays.</div>' + layoutRows + '</section>' +
    '<section class="config-section full"><h3>External display links</h3>' + sources + '<div class="source-row"><div class="field"><label for="bc_ext_title">Display name</label><input id="bc_ext_title" placeholder="Traffic camera"></div><div class="field"><label for="bc_ext_url">HTTPS display link</label><input id="bc_ext_url" type="url" placeholder="https://..."></div><button class="btn pri" onclick="addExternalSource()">Add display</button></div><div class="muted" style="font-size:11px;margin-top:10px">Some providers block embedded views. Their Open source button still works.</div></section>' +
    '</div><div class="config-actions"><button class="btn" onclick="resetBoardSettings()">Reset this display</button><button class="btn pri" onclick="saveBoardSettings()">Save board</button></div><div class="footer-note" style="margin-top:14px">Settings are saved on this browser display only. No links or credentials are sent to PrePlan 360.</div></div></div></div>';
}

viewBoard = function () {
  const canvas = boardCfg.order.filter(function (id) { return boardCfg.visible[id] !== false; }).map(renderBoardWidget).join("");
  return '<div class="board-weather-strip"><div id="boardWeatherCopy">' + weatherStripMarkup() + '</div><div class="board-weather-actions"><button class="btn board-customize-control" onclick="openBoardSettings()">Customize board</button><div class="bclock"><strong id="boardClock24">--:--:--</strong><span id="bdate"></span><small><i></i> rotates every ' + boardCfg.rotationSec + 's</small></div></div></div><div class="boardcanvas">' + (canvas || '<div class="board-empty" style="grid-column:1/-1"><b>No board cards are visible.</b><div style="margin-top:8px"><button class="btn pri board-customize-control" onclick="openBoardSettings()">Open settings</button></div></div>') + '</div><div class="footer-note compact-board-note">Official feeds and active source embeds recheck every ' + boardCfg.sourceRefreshMin + ' minutes while open. Radar loads only while shown and displays full-screen every ' + boardCfg.radarRefreshMin + ' minutes for ' + boardCfg.radarDisplaySec + ' seconds. Respond always takes priority. Demo department records and weather are fictional; the USFA LODD feed is official.</div>' + (boardSettingsOpen ? boardConfigMarkup() : "") + radarTakeoverMarkup();
};

const originalRender = render;
render = function () {
  document.body.classList.toggle("live-ops-display", current === "board");
  const result = originalRender();
  if (current === "board") {
    paintBoardWeather();
    paintApparatusRotation();
  }
  return result;
};

const originalToggleTone = toggleTone;
toggleTone = function () {
  const turningOn = !toneOn;
  if (turningOn) closeRadarTakeover(false);
  originalToggleTone();
  current = turningOn ? "respond" : "board";
  buildNav();
  render();
};

window.addEventListener("storage", function (event) {
  if (current === "board" && ["fireflow360.dailyLog.demo.v1", "fireflow360.scheduleBuilder.v2"].includes(event.key)) render();
});

setInterval(function () {
  const now = Date.now();
  const clock = document.getElementById("boardClock24");
  if (clock) clock.textContent = militaryTime(new Date());
  if (now >= nextSummaryRefreshAt) { nextSummaryRefreshAt = now + 60000; const summary = document.querySelector('[data-widget="summary"] .bsummary'); if (summary) summary.outerHTML = renderBoardSummary(); }
  const countdown = document.getElementById("radarTakeoverCountdown");
  if (countdown && radarTakeover) countdown.textContent = Math.max(0, Math.ceil((radarTakeover.endsAt - now) / 1000)) + "s";
  if (toneOn) { if (radarTakeover) closeRadarTakeover(false); return; }
  if (current !== "board" || radarTakeover) return;
  if (now >= nextWeatherRotateAt) { boardWeatherIndex = (boardWeatherIndex + 1) % DEMO_WEATHER.length; nextWeatherRotateAt = now + boardCfg.rotationSec * 1000; paintBoardWeather(); }
  if (now >= nextApparatusRotateAt) { apparatusRotationIndex = (apparatusRotationIndex + 1) % 2; nextApparatusRotateAt = now + boardCfg.rotationSec * 1000; paintApparatusRotation(); }
  if (now >= nextScheduledRadarAt) startRadarTakeover("scheduled", "Selected-area radar");
  const panels = activeBoardPanels(), key = panels[rotIdx];
  if (now - lastSourceRefresh >= boardCfg.sourceRefreshMin * 60000) {
    lastSourceRefresh = now;
    void loadDemoLodd();
    if (["weather", "alerts"].includes(key)) paintRot(true);
  }
  if (key === "radar" && now - lastRadarRefresh >= boardCfg.radarRefreshMin * 60000) paintRot(true);
}, 1000);

nextBoardRotateAt = Date.now() + boardCfg.rotationSec * 1000;
nextWeatherRotateAt = nextBoardRotateAt;
nextApparatusRotateAt = nextBoardRotateAt;
nextScheduledRadarAt = Date.now() + boardCfg.radarRefreshMin * 60000;
void loadDemoLodd();
if (current === "board") render();
