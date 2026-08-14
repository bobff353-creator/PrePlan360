/* eslint-disable @typescript-eslint/no-unused-vars */
/* global APPARATUS, CLOSECALLS, EQUIP, TRAINING, buildNav, current: writable, cycleRot: writable, nextBoardRotateAt: writable, paintRot: writable, render: writable, rotIdx: writable, setRot: writable, toneOn, toggleTone: writable, viewBoard: writable */

(function loadLiveOpsPriorityStyles() {
  if (document.querySelector('link[data-live-ops-priority]')) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/live-ops-priority.css?v=20260813-weather-priority";
  stylesheet.dataset.liveOpsPriority = "true";
  document.head.appendChild(stylesheet);
})();

const BOARD_STORAGE_KEY = "fireflow360.liveBoard.v4";
const BOARD_PANEL_LABELS = { equipment: "Equipment Issues", duty: "Current Daily Duty", closecalls: "Firefighter Close Calls", lodd: "U.S. Firefighter LODD", training: "Upcoming Training", weather: "Weather", alerts: "Weather Alerts", radar: "Weather Radar" };
const BOARD_DEFAULTS = {
  schemaVersion: 4,
  department: "Redstone Valley Fire & Rescue",
  title: "Live Operations",
  order: ["summary", "station", "apparatus"],
  visible: { summary: true, station: true, apparatus: true },
  widths: { summary: "full", station: "half", apparatus: "half" },
  panels: ["equipment", "duty", "closecalls", "training"],
  rotationSec: 12,
  responseSec: 45,
  showNextShift: true,
  forecastDetail: "3",
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
  config.responseSec = bounded(config.responseSec, 5, 600, 45);
  config.radarRefreshMin = bounded(legacy ? BOARD_DEFAULTS.radarRefreshMin : config.radarRefreshMin, 1, 120, 5);
  config.radarDisplaySec = bounded(config.radarDisplaySec, 10, 180, 30);
  config.severeRadarSec = bounded(config.severeRadarSec, 30, 300, 90);
  config.showNextShift = config.showNextShift !== false;
  config.forecastDetail = ["current", "3", "7"].includes(String(config.forecastDetail)) ? String(config.forecastDetail) : "3";
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
    const legacyValue = localStorage.getItem("fireflow360.liveBoard.v3");
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
function widgetShell(id, body) { const width = boardCfg.widths[id] || "half"; return '<section class="board-widget w-' + safeText(width) + '" draggable="true" data-widget="' + safeText(id) + '" ondragstart="boardDragStart(event,\'' + safeText(id) + '\')" ondragover="boardDragOver(event)" ondragleave="boardDragLeave(event)" ondrop="boardDrop(event,\'' + safeText(id) + '\')" ondragend="boardDragEnd(event)"><div class="widget-grip" title="Drag to move"><span>Move</span><b>::</b></div>' + body + '</section>'; }

function renderBoardSummary() {
  const tiles = [
    '<div class="btile"><span>Staffing</span><strong>7 / 7</strong><small>Complete · minimum met</small></div>',
    '<div class="btile"><span>Officer in Charge</span><strong>Chief A. Morgan</strong><small>Current shift command · B</small></div>',
    '<div class="btile"><span>Active Call</span><strong>None</strong><small>Respond takes over automatically</small></div>',
  ];
  if (boardCfg.showNextShift) tiles.push('<div class="btile warn"><span>Next Shift Change</span><strong>Shift A · 0700</strong><small>In 14h 12m</small></div>');
  return '<div class="bsummary compact cols-' + tiles.length + '">' + tiles.join("") + '</div>';
}
function renderStationWidget() { return '<div class="card rotpanel"><h3 id="rotTitle">Station Information</h3><div id="rotBody"></div><div class="rotdots" id="rotDots"></div></div>'; }
function apparatusStatusMarkup() { return '<div class="appstrip">' + APPARATUS.map(function (apparatus) { const statusClass = apparatus.status === "Out of Service" ? "oos" : ""; return '<div class="appchip ' + statusClass + '"><b>' + safeText(apparatus.u) + '</b><span>' + safeText(apparatus.status) + '</span></div>'; }).join("") + '</div><p class="muted apparatus-note">Demo fleet status is simulated and is not connected to live CAD.</p>'; }
function ridingAssignmentMarkup() { return '<div class="riding-grid">' + DEMO_RIDING.map(function (assignment) { return '<article><b>' + safeText(assignment.unit) + '</b><span>' + safeText(assignment.crew) + '</span></article>'; }).join("") + '</div><p class="muted apparatus-note">Fictional riding assignments · departments use saved schedule records.</p>'; }
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
  if (key === "equipment") body.innerHTML = EQUIP.map(function (equipment) { return '<div class="newsitem"><strong>' + safeText(equipment.item) + ' · <span style="color:var(--warn)">' + safeText(equipment.status) + '</span></strong><span class="muted" style="font-size:12px">' + safeText(equipment.detail) + '</span></div>'; }).join("");
  else if (key === "duty") body.innerHTML = '<div class="result" style="text-align:left"><span class="pill p-fire">NOW · Afternoon</span><div style="font-size:18px;font-weight:800;margin-top:8px">Hydrant flow testing · Zone 4 East</div><div class="muted">5 hydrants due this cycle · record static/residual in Hydrants</div></div>';
  else if (key === "closecalls") body.innerHTML = CLOSECALLS.map(function (call) { return '<div class="newsitem"><time>' + safeText(call.date) + '</time><strong>' + safeText(call.title) + '</strong></div>'; }).join("");
  else if (key === "lodd") body.innerHTML = '<div class="board-empty"><b>Connect an official LODD source</b><div style="margin-top:6px">This board does not display an unverified live total.</div></div>';
  else if (key === "training") body.innerHTML = TRAINING.map(function (training) { return '<div class="newsitem"><strong>' + safeText(training.course) + '</strong><span class="muted" style="font-size:12px">' + safeText(training.prov) + ' · ' + safeText(training.dates) + '</span></div>'; }).join("");
  else if (key === "weather") body.innerHTML = '<div class="muted" style="font-size:11px;margin-bottom:8px">Configured weather view: ' + safeText(boardCfg.forecastDetail === "current" ? "current conditions" : boardCfg.forecastDetail + " day") + '</div>' + sourceFrame(boardCfg.weatherUrl, "Weather", forecastHeight(), !!forceRefresh);
  else if (key === "alerts") body.innerHTML = '<div class="weather-alert"><b>Weather alert source</b><div class="muted" style="font-size:11px;margin-top:3px">Only the configured source is displayed. This fictional demo does not issue live warnings.</div></div>' + sourceFrame(boardCfg.alertsUrl, "Weather alerts", 320, !!forceRefresh);
  else if (key === "radar") { body.innerHTML = sourceFrame(boardCfg.radarUrl, "Weather radar", 470, true); lastRadarRefresh = Date.now(); }
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
  if (!boardCfg.radarUrl) return simulatedRadarMarkup();
  let source = boardCfg.radarUrl;
  try { const refreshed = new URL(source); refreshed.searchParams.set("preplan_radar_refresh", String(Date.now())); source = refreshed.toString(); } catch { /* Keep the validated source unchanged. */ }
  return '<iframe class="radar-takeover-frame" src="' + safeText(source) + '" title="Configured weather radar" referrerpolicy="no-referrer" sandbox="allow-forms allow-popups allow-scripts allow-same-origin"></iframe>';
}
function radarTakeoverMarkup() {
  if (!radarTakeover) return "";
  const seconds = Math.max(0, Math.ceil((radarTakeover.endsAt - Date.now()) / 1000));
  return '<section class="radar-takeover ' + (radarTakeover.kind === "severe" ? "severe" : "scheduled") + '" role="alert" aria-label="' + safeText(radarTakeover.title) + '"><header><div><span>' + (radarTakeover.kind === "severe" ? "WEATHER WARNING · DEMO ONLY" : "SCHEDULED RADAR · DEMO") + '</span><h2>' + safeText(radarTakeover.title) + '</h2><p>' + (boardCfg.radarUrl ? "Configured radar source · verify source status" : "Simulated radar because no live source or real location is connected") + '</p></div><b id="radarTakeoverCountdown">' + seconds + 's</b></header><div class="radar-takeover-map">' + radarSourceMarkup() + '</div><footer><span>Any incident immediately closes this weather display and opens Respond.</span><div class="radar-takeover-actions"><button class="btn pri" type="button" onclick="toggleTone()">Simulate incident override</button><button class="btn" type="button" onclick="closeRadarTakeover()">Return to board</button></div></footer></section>';
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
  boardCfg.radarRefreshMin = document.getElementById("bc_radar_refresh").value;
  boardCfg.radarDisplaySec = document.getElementById("bc_radar_duration").value;
  boardCfg.severeRadarSec = document.getElementById("bc_severe_duration").value;
  boardCfg.showNextShift = document.getElementById("bc_show_next_shift").checked;
  boardCfg.forecastDetail = document.getElementById("bc_forecast").value;
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
  render();
}
function addExternalSource() { const title = document.getElementById("bc_ext_title").value.trim() || "External display", url = validHttpUrl(document.getElementById("bc_ext_url").value); if (!url) { alert("Enter a complete http or https link."); return; } const id = "ext-" + Date.now().toString(36); boardCfg.external.push({ id, title: title.slice(0, 80), url }); boardCfg.order.push(id); boardCfg.visible[id] = true; boardCfg.widths[id] = "half"; saveBoardCfg(); render(); }
function removeExternalSource(id) { boardCfg.external = boardCfg.external.filter(function (source) { return source.id !== id; }); boardCfg.order = boardCfg.order.filter(function (entry) { return entry !== id; }); delete boardCfg.visible[id]; delete boardCfg.widths[id]; saveBoardCfg(); render(); }
function resetBoardSettings() { if (!confirm("Reset this display to the default Live Ops layout?")) return; localStorage.removeItem(BOARD_STORAGE_KEY); boardCfg = cloneBoardDefaults(); saveBoardCfg(); boardSettingsOpen = false; rotIdx = 0; nextScheduledRadarAt = Date.now() + boardCfg.radarRefreshMin * 60000; render(); }

function boardConfigMarkup() {
  const panelChecks = Object.keys(BOARD_PANEL_LABELS).map(function (key) { return '<label class="checkrow"><input type="checkbox" data-board-panel value="' + key + '" ' + (boardCfg.panels.includes(key) ? "checked" : "") + '><span>' + safeText(BOARD_PANEL_LABELS[key]) + '</span></label>'; }).join("");
  const layoutRows = boardCfg.order.map(function (id) { const definition = boardDefs().find(function (entry) { return entry.id === id; }); if (!definition) return ""; const width = boardCfg.widths[id] || "half"; return '<div class="layout-row"><label class="checkrow" style="padding:7px 9px"><input type="checkbox" data-widget-visible="' + safeText(id) + '" ' + (boardCfg.visible[id] !== false ? "checked" : "") + '><span>' + safeText(definition.label) + '</span></label><select data-widget-width="' + safeText(id) + '"><option value="third" ' + (width === "third" ? "selected" : "") + '>One third</option><option value="half" ' + (width === "half" ? "selected" : "") + '>Half</option><option value="full" ' + (width === "full" ? "selected" : "") + '>Full</option></select><button class="btn" onclick="moveBoardWidget(\'' + safeText(id) + '\',-1)">Up</button><button class="btn" onclick="moveBoardWidget(\'' + safeText(id) + '\',1)">Down</button></div>'; }).join("");
  const sources = boardCfg.external.length ? boardCfg.external.map(function (source) { return '<div class="source-item"><span><b>' + safeText(source.title) + '</b><small>' + safeText(source.url) + '</small></span><button class="btn" onclick="removeExternalSource(\'' + safeText(source.id) + '\')">Remove</button></div>'; }).join("") : '<div class="muted" style="font-size:12px">No external display links added yet.</div>';
  return '<div class="config-backdrop" role="dialog" aria-modal="true" aria-label="Live Ops Board settings" onclick="if(event.target===this)closeBoardSettings()"><div class="config-panel"><div class="config-head"><div><div class="eyebrow">This display</div><h2>Live Ops Board settings</h2></div><button class="btn" onclick="closeBoardSettings()">Close</button></div><div class="config-body"><div class="config-grid">' +
    '<section class="config-section"><h3>Display timing</h3><div class="field"><label for="bc_department">Department or station</label><input id="bc_department" value="' + safeText(boardCfg.department) + '"></div><div class="field"><label for="bc_title">Display label</label><input id="bc_title" value="' + safeText(boardCfg.title) + '"></div><div class="field"><label for="bc_rotation">Weather, station, and riding rotation (seconds)</label><input id="bc_rotation" type="number" min="5" max="300" value="' + boardCfg.rotationSec + '"></div><div class="field"><label for="bc_response">Respond display time after incident clears (seconds)</label><input id="bc_response" type="number" min="5" max="600" value="' + boardCfg.responseSec + '"></div><label class="checkrow"><input id="bc_show_next_shift" type="checkbox" ' + (boardCfg.showNextShift ? "checked" : "") + '><span>Show Next Shift Change tile</span></label></section>' +
    '<section class="config-section"><h3>Station information rotation</h3><div class="checkgrid">' + panelChecks + '</div><div class="muted" style="font-size:11px;margin-top:10px">Choose exactly what this screen cycles through. At least one panel remains enabled.</div></section>' +
    '<section class="config-section full"><h3>Weather priority and radar</h3><div class="config-grid"><div><div class="field"><label for="bc_forecast">Weather amount</label><select id="bc_forecast"><option value="current" ' + (boardCfg.forecastDetail === "current" ? "selected" : "") + '>Current conditions</option><option value="3" ' + (boardCfg.forecastDetail === "3" ? "selected" : "") + '>3-day view</option><option value="7" ' + (boardCfg.forecastDetail === "7" ? "selected" : "") + '>7-day view</option></select></div><div class="field"><label for="bc_radar_refresh">Full-screen radar every (minutes)</label><input id="bc_radar_refresh" type="number" min="1" max="120" value="' + boardCfg.radarRefreshMin + '"></div><div class="field"><label for="bc_radar_duration">Scheduled radar duration (seconds)</label><input id="bc_radar_duration" type="number" min="10" max="180" value="' + boardCfg.radarDisplaySec + '"></div><div class="field"><label for="bc_severe_duration">Severe warning radar duration (seconds)</label><input id="bc_severe_duration" type="number" min="30" max="300" value="' + boardCfg.severeRadarSec + '"></div></div><div><div class="field"><label for="bc_weather_url">Weather display link</label><input id="bc_weather_url" type="url" placeholder="https://..." value="' + safeText(boardCfg.weatherUrl) + '"></div><div class="field"><label for="bc_alerts_url">Weather alert link</label><input id="bc_alerts_url" type="url" placeholder="https://..." value="' + safeText(boardCfg.alertsUrl) + '"></div><div class="field"><label for="bc_radar_url">Selected-area radar link</label><input id="bc_radar_url" type="url" placeholder="https://radar.weather.gov/..." value="' + safeText(boardCfg.radarUrl) + '"></div><div class="priority-preview-actions"><button class="btn" type="button" onclick="previewRadarTakeover()">Preview 30s radar</button><button class="btn severe" type="button" onclick="previewSevereRadarTakeover()">Preview severe warning</button></div></div></div><p class="muted" style="font-size:11px">Demo weather and alerts are simulated. A department must save a verified location and radar source before operational weather is shown.</p></section>' +
    '<section class="config-section full"><h3>Board layout</h3><div class="muted" style="font-size:11px;margin-bottom:6px">Drag cards directly on the board, or use these controls for touch and keyboard displays.</div>' + layoutRows + '</section>' +
    '<section class="config-section full"><h3>External display links</h3>' + sources + '<div class="source-row"><div class="field"><label for="bc_ext_title">Display name</label><input id="bc_ext_title" placeholder="Traffic camera"></div><div class="field"><label for="bc_ext_url">HTTPS display link</label><input id="bc_ext_url" type="url" placeholder="https://..."></div><button class="btn pri" onclick="addExternalSource()">Add display</button></div><div class="muted" style="font-size:11px;margin-top:10px">Some providers block embedded views. Their Open source button still works.</div></section>' +
    '</div><div class="config-actions"><button class="btn" onclick="resetBoardSettings()">Reset this display</button><button class="btn pri" onclick="saveBoardSettings()">Save board</button></div><div class="footer-note" style="margin-top:14px">Settings are saved on this browser display only. No links or credentials are sent to PrePlan 360.</div></div></div></div>';
}

viewBoard = function () {
  const canvas = boardCfg.order.filter(function (id) { return boardCfg.visible[id] !== false; }).map(renderBoardWidget).join("");
  return '<div class="board-weather-strip"><div id="boardWeatherCopy">' + weatherStripMarkup() + '</div><div class="board-weather-actions"><button class="btn" onclick="openBoardSettings()">Customize board</button><div class="bclock"><strong id="boardClock24">--:--:--</strong><span id="bdate"></span><small><i></i> rotates every ' + boardCfg.rotationSec + 's</small></div></div></div><div class="boardcanvas">' + (canvas || '<div class="board-empty" style="grid-column:1/-1"><b>No board cards are visible.</b><div style="margin-top:8px"><button class="btn pri" onclick="openBoardSettings()">Open settings</button></div></div>') + '</div><div class="footer-note compact-board-note">Radar displays every ' + boardCfg.radarRefreshMin + ' minutes for ' + boardCfg.radarDisplaySec + ' seconds. Severe weather uses ' + boardCfg.severeRadarSec + ' seconds. Respond always takes priority. Demo records and weather are fictional.</div>' + (boardSettingsOpen ? boardConfigMarkup() : "") + radarTakeoverMarkup();
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

setInterval(function () {
  const now = Date.now();
  const clock = document.getElementById("boardClock24");
  if (clock) clock.textContent = militaryTime(new Date());
  const countdown = document.getElementById("radarTakeoverCountdown");
  if (countdown && radarTakeover) countdown.textContent = Math.max(0, Math.ceil((radarTakeover.endsAt - now) / 1000)) + "s";
  if (toneOn) { if (radarTakeover) closeRadarTakeover(false); return; }
  if (current !== "board" || radarTakeover) return;
  if (now >= nextWeatherRotateAt) { boardWeatherIndex = (boardWeatherIndex + 1) % DEMO_WEATHER.length; nextWeatherRotateAt = now + boardCfg.rotationSec * 1000; paintBoardWeather(); }
  if (now >= nextApparatusRotateAt) { apparatusRotationIndex = (apparatusRotationIndex + 1) % 2; nextApparatusRotateAt = now + boardCfg.rotationSec * 1000; paintApparatusRotation(); }
  if (now >= nextScheduledRadarAt) startRadarTakeover("scheduled", "Selected-area radar");
  const panels = activeBoardPanels(), key = panels[rotIdx];
  if (key === "radar" && boardCfg.radarUrl && now - lastRadarRefresh >= boardCfg.radarRefreshMin * 60000) paintRot(true);
}, 1000);

nextBoardRotateAt = Date.now() + boardCfg.rotationSec * 1000;
nextWeatherRotateAt = nextBoardRotateAt;
nextApparatusRotateAt = nextBoardRotateAt;
nextScheduledRadarAt = Date.now() + boardCfg.radarRefreshMin * 60000;
if (current === "board") render();
