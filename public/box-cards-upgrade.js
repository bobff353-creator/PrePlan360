/* PrePlan 360 grouped Box Card library and owner editor. */
/* global safeText, BOXCARDS, render, resFocusBox:writable, resBody:writable, resTab:writable, current:writable */
(function () {
  const params = new URLSearchParams(location.search);
  const insideVerifiedOwnerDemo = function () {
    try {
      const parentUrl = new URL(window.parent.location.href);
      return window.parent !== window && parentUrl.pathname === "/demo" && parentUrl.searchParams.get("owner") === "1";
    } catch {
      return false;
    }
  };
  const admin = params.get("view") !== "readonly" && insideVerifiedOwnerDemo();
  const STORE_KEY = "preplan360.boxCards.v1";
  const DB_NAME = "preplan360-box-card-sources";
  const COLUMNS = ["Engines", "Trucks", "Squads", "EMS", "Chiefs", "Special", "Notifications"];
  const esc = typeof safeText === "function" ? safeText : function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  };

  function emptyRow(alarm) {
    return { alarm: alarm || "1st Alarm", cells: COLUMNS.map(function () { return ""; }) };
  }

  function seedState() {
    const cards = (typeof BOXCARDS !== "undefined" ? BOXCARDS : []).map(function (card, index) {
      return {
        id: "seed-" + card.box,
        group: "Redstone Valley",
        box: String(card.box || index + 1),
        division: "Fictional mutual-aid group",
        title: String(card.area || "Area not entered"),
        status: "Reviewed",
        sourceId: "",
        sourceName: "Demo foundation",
        sourceType: "fictional",
        rows: [
          { alarm: "1st Alarm", cells: ["", "", "", "", "", String(card.a1 || ""), ""] },
          { alarm: "2nd Alarm", cells: ["", "", "", "", "", String(card.a2 || ""), ""] },
          { alarm: "3rd Alarm", cells: ["", "", "", "", "", String(card.a3 || ""), ""] },
        ],
        interdivisional: "",
        updatedAt: "Demo foundation",
      };
    });
    return { groups: ["Redstone Valley", "Westhaven", "Lakecrest"], activeGroup: "Redstone Valley", activeCardId: "", cards: cards, notice: "" };
  }

  function normalizeRow(row) {
    const cells = Array.isArray(row && row.cells) ? row.cells.slice(0, COLUMNS.length).map(String) : [];
    while (cells.length < COLUMNS.length) cells.push("");
    return { alarm: String(row && row.alarm || "Alarm"), cells: cells };
  }

  function normalizeCard(card, index) {
    const rows = Array.isArray(card && card.rows) ? card.rows.map(normalizeRow) : [];
    return {
      id: String(card && card.id || "card-" + Date.now() + "-" + index),
      group: String(card && (card.group || card.town) || "Unassigned"),
      box: String(card && (card.box || card.signature) || "New"),
      division: String(card && card.division || ""),
      title: String(card && (card.title || card.area || card.district) || "Area not entered"),
      status: String(card && card.status || "Draft - review required"),
      sourceId: String(card && card.sourceId || ""),
      sourceName: String(card && card.sourceName || ""),
      sourceType: String(card && card.sourceType || ""),
      rows: rows.length ? rows : [emptyRow("1st Alarm"), emptyRow("2nd Alarm"), emptyRow("3rd Alarm")],
      interdivisional: String(card && card.interdivisional || ""),
      updatedAt: String(card && card.updatedAt || "today"),
    };
  }

  function loadState() {
    if (!admin) return seedState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!saved || !Array.isArray(saved.cards)) return seedState();
      const cards = saved.cards.map(normalizeCard);
      const groups = Array.from(new Set([].concat(saved.groups || [], cards.map(function (card) { return card.group; })))).filter(Boolean);
      return {
        groups: groups.length ? groups : ["Unassigned"],
        activeGroup: groups.includes(saved.activeGroup) ? saved.activeGroup : groups[0],
        activeCardId: cards.some(function (card) { return card.id === saved.activeCardId; }) ? saved.activeCardId : "",
        cards: cards,
        notice: "",
      };
    } catch {
      return seedState();
    }
  }

  let state = loadState();
  let importOpen = false;

  function save(notice) {
    if (admin) localStorage.setItem(STORE_KEY, JSON.stringify({ groups: state.groups, activeGroup: state.activeGroup, activeCardId: state.activeCardId, cards: state.cards }));
    state.notice = notice || "";
    syncLegacyCards();
  }

  function rowSummary(row) {
    return row.cells.map(function (cell) { return String(cell || "").trim(); }).filter(Boolean).join(", ") || "—";
  }

  function syncLegacyCards() {
    if (!admin || typeof BOXCARDS === "undefined") return;
    const legacy = state.cards.map(function (card) {
      return {
        box: card.box,
        area: card.title,
        a1: rowSummary(card.rows[0] || emptyRow("1st Alarm")),
        a2: rowSummary(card.rows[1] || emptyRow("2nd Alarm")),
        a3: rowSummary(card.rows[2] || emptyRow("3rd Alarm")),
      };
    });
    BOXCARDS.splice.apply(BOXCARDS, [0, BOXCARDS.length].concat(legacy));
  }

  function openSourceDb() {
    return new Promise(function (resolve, reject) {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains("sources")) request.result.createObjectStore("sources", { keyPath: "id" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  async function storeSource(sourceId, file) {
    if (!sourceId || !file) return;
    const database = await openSourceDb();
    await new Promise(function (resolve, reject) {
      const transaction = database.transaction("sources", "readwrite");
      transaction.objectStore("sources").put({ id: sourceId, name: file.name, type: file.type, blob: file });
      transaction.oncomplete = resolve;
      transaction.onerror = function () { reject(transaction.error); };
    });
    database.close();
  }

  async function getSource(sourceId) {
    const database = await openSourceDb();
    const source = await new Promise(function (resolve, reject) {
      const request = database.transaction("sources", "readonly").objectStore("sources").get(sourceId);
      request.onsuccess = function () { resolve(request.result || null); };
      request.onerror = function () { reject(request.error); };
    });
    database.close();
    return source;
  }

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || "text/plain" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = name;
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(anchor.href); }, 1000);
  }

  function slug(value) {
    return String(value || "box-card").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "box-card";
  }

  function eventValue(value) {
    return encodeURIComponent(String(value || "")).replaceAll("'", "%27");
  }

  function parseCsvLine(line) {
    const cells = [];
    let value = "", quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === "," && !quoted) { cells.push(value.trim()); value = ""; }
      else value += character;
    }
    cells.push(value.trim());
    return cells;
  }

  function parseCsv(text, fallbackGroup, source) {
    const lines = String(text || "").split(/\r?\n/).filter(function (line) { return line.trim(); });
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map(function (header) { return header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); });
    const byKey = new Map();
    lines.slice(1).forEach(function (line, rowIndex) {
      const values = parseCsvLine(line), row = Object.fromEntries(headers.map(function (header, index) { return [header, values[index] || ""]; }));
      const group = row.group || row.town || fallbackGroup || "Unassigned";
      const box = row.box || row.signature || row.box_number || "Imported " + (rowIndex + 1);
      const key = group + "\u0000" + box;
      if (!byKey.has(key)) {
        const importedCard = normalizeCard({ id: "card-" + Date.now() + "-" + rowIndex, group: group, box: box, division: row.division, title: row.area || row.title || row.district, status: "Draft - imported review required", sourceId: source.id, sourceName: source.name, sourceType: source.type, rows: [], updatedAt: "today" }, rowIndex);
        importedCard.rows = [];
        byKey.set(key, importedCard);
      }
      const card = byKey.get(key);
      const alarm = row.alarm || row.level || row.alarm_level || "Alarm";
      card.rows.push(normalizeRow({ alarm: alarm, cells: COLUMNS.map(function (column) { return row[column.toLowerCase()] || row[column.toLowerCase().replaceAll(" ", "_")] || ""; }) }));
    });
    return Array.from(byKey.values());
  }

  function parseText(text, defaults, source) {
    const lines = String(text || "").split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    const pick = function (name) {
      const match = lines.find(function (line) { return new RegExp("^(?:" + name + ")\\s*[:#-]", "i").test(line); });
      return match ? match.replace(new RegExp("^(?:" + name + ")\\s*[:#-]\\s*", "i"), "") : "";
    };
    const assignmentCells = function (value) {
      const cells = COLUMNS.map(function () { return []; });
      String(value || "").split(/[,;]+/).map(function (item) { return item.trim(); }).filter(Boolean).forEach(function (item) {
        const code = item.toUpperCase().replace(/[^A-Z0-9]/g, "");
        let column = 5;
        if (/^(E|ENG|ENGINE)\d/.test(code)) column = 0;
        else if (/^(T|TRK|TRUCK|L|LADDER)\d/.test(code)) column = 1;
        else if (/^(SQ|SQUAD)\d/.test(code)) column = 2;
        else if (/^(M|MED|MEDIC|A|AMB|AMBULANCE)\d/.test(code)) column = 3;
        else if (/^(C|CHIEF|BC|DC|AC)\d/.test(code)) column = 4;
        else if (/NOTIF|DISPATCH|ALERT|PAGE/.test(code)) column = 6;
        cells[column].push(item);
      });
      return cells.map(function (items) { return items.join(", "); });
    };
    const rows = lines.flatMap(function (line) {
      const match = /^(\d+(?:st|nd|rd|th)?\s*(?:alarm)?|general|special)\s*[:|-]\s*(.+)$/i.exec(line);
      return match ? [{ alarm: match[1], cells: assignmentCells(match[2]) }] : [];
    });
    return normalizeCard({
      id: "card-" + Date.now(),
      group: pick("town|group") || defaults.group || "Unassigned",
      box: pick("box|signature") || defaults.box || "Imported",
      division: pick("division") || defaults.division || "",
      title: pick("area|district|title") || defaults.title || "Imported source - identify area",
      status: "Draft - imported review required",
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      rows: rows,
      updatedAt: "today",
    }, 0);
  }

  function mapJson(data, fallbackGroup, source) {
    const list = Array.isArray(data) ? data : Array.isArray(data && data.cards) ? data.cards : [data];
    return list.filter(Boolean).map(function (card, index) {
      return normalizeCard(Object.assign({}, card, {
        id: "card-" + Date.now() + "-" + index,
        group: fallbackGroup || card.group || card.town || "Unassigned",
        status: "Draft - imported review required",
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type,
        updatedAt: "today",
      }), index);
    });
  }

  function groupTabs() {
    return '<div class="bc-groups" role="tablist" aria-label="Box Card groups by town">' + state.groups.map(function (group) {
      const count = state.cards.filter(function (card) { return card.group === group; }).length;
      return '<button role="tab" aria-selected="' + String(state.activeGroup === group) + '" class="' + (state.activeGroup === group ? "active" : "") + '" onclick="bcGroup(decodeURIComponent(\'' + eventValue(group) + '\'))"><span>' + esc(group) + '</span><b>' + count + '</b></button>';
    }).join("") + '</div>';
  }

  function importPanel() {
    if (!admin || !importOpen) return "";
    return '<form class="bc-import" onsubmit="return bcImport(event)"><header><div><span>ADMIN IMPORT</span><h3>Transform a source into an editable Box Card draft</h3><p>JSON, CSV, and pasted text are mapped automatically. PDF and image sources are preserved and opened as an editable review draft.</p></div><button class="btn" type="button" onclick="bcToggleImport()">Close</button></header><div class="bc-import-grid"><label><span>Source file</span><input name="source" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.json,.csv,.txt,text/plain,application/pdf,image/*"></label><label><span>Town / group</span><input name="group" value="' + esc(state.activeGroup) + '" required></label><label><span>Box / signature</span><input name="box" placeholder="1204"></label><label><span>Division</span><input name="division" placeholder="Division or mutual-aid group"></label><label class="wide"><span>Area / district</span><input name="title" placeholder="District, streets, occupancy, or response area"></label><label class="wide"><span>Paste extracted text (optional)</span><textarea name="sourceText" placeholder="Box: 1204&#10;Town: Example&#10;1st Alarm: E-1, T-1&#10;2nd Alarm: E-2"></textarea></label></div><div class="bc-import-note"><b>Source preservation</b><span>The uploaded original is stored only in this browser on this device. Verify every assignment before publishing it to a department.</span></div><button class="btn pri" type="submit">Create editable draft</button></form>';
  }

  function cardGrid(cards) {
    if (!cards.length) return '<div class="bc-empty"><b>No Box Cards in ' + esc(state.activeGroup) + '.</b><span>An administrator can import a source or add a blank card for this town.</span></div>';
    return '<div class="bc-card-grid">' + cards.map(function (card) {
      return '<article class="bc-card ' + (card.box === resFocusBox ? "focused" : "") + '"><header><div><span>' + esc(card.status) + '</span><h3>Box ' + esc(card.box) + '</h3><p>' + esc(card.title) + '</p></div><b>' + card.rows.length + ' alarms</b></header><dl><div><dt>Town / group</dt><dd>' + esc(card.group) + '</dd></div><div><dt>Division</dt><dd>' + esc(card.division || "Not entered") + '</dd></div><div><dt>Source</dt><dd>' + esc(card.sourceName || "No source attached") + '</dd></div></dl><div class="bc-card-actions"><button class="btn pri" onclick="bcOpen(\'' + esc(card.id) + '\')">Open card</button><button class="btn" onclick="bcDownloadJson(\'' + esc(card.id) + '\')">Download editable</button><button class="btn" onclick="bcPrint(\'' + esc(card.id) + '\')">Print / Save PDF</button></div></article>';
    }).join("") + '</div>';
  }

  function cellInput(card, rowIndex, cellIndex, value) {
    if (!admin) return '<span>' + esc(value || "—") + '</span>';
    return '<input aria-label="' + esc(COLUMNS[cellIndex]) + ' for ' + esc(card.rows[rowIndex].alarm) + '" value="' + esc(value) + '" oninput="bcSetCell(\'' + esc(card.id) + '\',' + rowIndex + ',' + cellIndex + ',this.value)">';
  }

  function editor(card) {
    if (!card) return "";
    const groupOptions = state.groups.map(function (group) { return '<option ' + (group === card.group ? "selected" : "") + '>' + esc(group) + '</option>'; }).join("");
    return '<section class="bc-editor"><header><div><span>' + (admin ? "ADMIN EDITOR" : "VIEW ONLY") + '</span><h2>Box ' + esc(card.box) + '</h2><p>' + esc(card.group) + ' · ' + esc(card.title) + '</p></div><div class="bc-editor-actions"><button class="btn" onclick="bcClose()">Close</button><button class="btn" onclick="bcDownloadJson(\'' + esc(card.id) + '\')">Download JSON</button><button class="btn" onclick="bcDownloadCsv(\'' + esc(card.id) + '\')">Download CSV</button><button class="btn pri" onclick="bcPrint(\'' + esc(card.id) + '\')">Print / Save PDF</button></div></header>' +
      (admin ? '<div class="bc-meta"><label><span>Town / group</span><select onchange="bcSetCard(\'' + esc(card.id) + '\',\'group\',this.value)">' + groupOptions + '</select></label><label><span>Box / signature</span><input value="' + esc(card.box) + '" oninput="bcSetCard(\'' + esc(card.id) + '\',\'box\',this.value)"></label><label><span>Division</span><input value="' + esc(card.division) + '" oninput="bcSetCard(\'' + esc(card.id) + '\',\'division\',this.value)"></label><label><span>Status</span><select onchange="bcSetCard(\'' + esc(card.id) + '\',\'status\',this.value)"><option ' + (card.status.startsWith("Draft") ? "selected" : "") + '>Draft - review required</option><option ' + (card.status === "Reviewed" ? "selected" : "") + '>Reviewed</option><option ' + (card.status === "Published" ? "selected" : "") + '>Published</option></select></label><label class="wide"><span>Area / district</span><input value="' + esc(card.title) + '" oninput="bcSetCard(\'' + esc(card.id) + '\',\'title\',this.value)"></label></div>' : "") +
      '<div class="bc-table-wrap"><table class="bc-table"><thead><tr><th>Alarm</th>' + COLUMNS.map(function (column) { return '<th>' + esc(column) + '</th>'; }).join("") + (admin ? "<th></th>" : "") + '</tr></thead><tbody>' + card.rows.map(function (row, rowIndex) { return '<tr><th>' + (admin ? '<input aria-label="Alarm level" value="' + esc(row.alarm) + '" oninput="bcSetAlarm(\'' + esc(card.id) + '\',' + rowIndex + ',this.value)">' : esc(row.alarm)) + '</th>' + row.cells.map(function (cell, cellIndex) { return '<td>' + cellInput(card, rowIndex, cellIndex, cell) + '</td>'; }).join("") + (admin ? '<td><button class="bc-remove" aria-label="Remove ' + esc(row.alarm) + ' row" onclick="bcRemoveRow(\'' + esc(card.id) + '\',' + rowIndex + ')">×</button></td>' : "") + '</tr>'; }).join("") + '</tbody></table></div>' +
      (admin ? '<div class="bc-editor-footer"><button class="btn" onclick="bcAddRow(\'' + esc(card.id) + '\')">+ Add alarm row</button><label><span>Interdivisional / information</span><textarea oninput="bcSetCard(\'' + esc(card.id) + '\',\'interdivisional\',this.value)">' + esc(card.interdivisional) + '</textarea></label><div class="bc-source"><div><b>Original source</b><span>' + esc(card.sourceName || "No source file attached") + '</span></div>' + (card.sourceId ? '<button class="btn" onclick="bcDownloadSource(\'' + esc(card.sourceId) + '\')">Download original</button>' : "") + '<button class="btn" onclick="bcDelete(\'' + esc(card.id) + '\')">Delete draft</button></div></div>' : '<div class="bc-info"><b>Interdivisional / information</b><span>' + esc(card.interdivisional || "No additional information") + '</span></div>') + '</section>';
  }

  function renderLibrary() {
    if (resFocusBox) {
      const focused = state.cards.find(function (card) { return card.box === String(resFocusBox); });
      if (focused) { state.activeGroup = focused.group; state.activeCardId = focused.id; }
    }
    const cards = state.cards.filter(function (card) { return card.group === state.activeGroup; });
    const active = state.cards.find(function (card) { return card.id === state.activeCardId; });
    return '<section class="bc-library"><div class="bc-toolbar"><div><span>GROUPED BOX CARD LIBRARY</span><h2>' + esc(state.activeGroup) + '</h2><p>Choose a town tab to see every associated Box Card.</p></div><div class="bc-toolbar-actions">' + (admin ? '<span class="bc-admin"><i></i> Admin editing enabled</span><button class="btn" onclick="bcAddBlank()">+ Blank card</button><button class="btn pri" onclick="bcToggleImport()">Import source</button>' : '<span class="bc-view"><i></i> View only</span>') + '</div></div>' +
      (state.notice ? '<div class="bc-notice" role="status">' + esc(state.notice) + '</div>' : "") + groupTabs() + importPanel() + cardGrid(cards) + editor(active) +
      '<div class="bc-boundary"><b>Publishing boundary</b><span>Owner/admin edits are device-local in this foundation demo. A department-safe release still requires verified identity, tenant storage, audit history, and an explicit publish action.</span></div></section>';
  }

  window.bcGroup = function (group) { state.activeGroup = group; state.activeCardId = ""; resFocusBox = ""; save(); render(); };
  window.bcOpen = function (id) { state.activeCardId = id; save(); render(); requestAnimationFrame(function () { const editor = document.querySelector(".bc-editor"); if (editor) editor.scrollIntoView({ behavior: "smooth", block: "start" }); }); };
  window.bcClose = function () { state.activeCardId = ""; resFocusBox = ""; save(); render(); };
  window.bcToggleImport = function () { if (!admin) return; importOpen = !importOpen; render(); };
  window.bcAddBlank = function () {
    if (!admin) return;
    const card = normalizeCard({ id: "card-" + Date.now(), group: state.activeGroup, box: "New", title: "Area not entered", status: "Draft - review required", rows: [emptyRow("1st Alarm"), emptyRow("2nd Alarm"), emptyRow("3rd Alarm")] }, 0);
    state.cards.unshift(card); state.activeCardId = card.id; save("Blank editable Box Card created"); render();
  };
  window.bcImport = async function (event) {
    event.preventDefault();
    if (!admin) return false;
    const form = new FormData(event.currentTarget), file = form.get("source"), group = String(form.get("group") || "").trim();
    const defaults = { group: group, box: String(form.get("box") || "").trim(), division: String(form.get("division") || "").trim(), title: String(form.get("title") || "").trim() };
    const sourceId = file && file.size ? "source-" + Date.now() : "";
    const source = { id: sourceId, name: file && file.name ? file.name : "Pasted text", type: file && file.type ? file.type : "text/plain" };
    let imported = [], text = String(form.get("sourceText") || "").trim();
    try {
      if (file && file.size && /\.(json|csv|txt)$/i.test(file.name)) text = await file.text();
      if (file && /\.json$/i.test(file.name)) imported = mapJson(JSON.parse(text), group, source);
      else if (file && /\.csv$/i.test(file.name)) imported = parseCsv(text, group, source);
      else if (text) imported = [parseText(text, defaults, source)];
      else imported = [normalizeCard({ id: "card-" + Date.now(), group: group || "Unassigned", box: defaults.box || "Imported", division: defaults.division, title: defaults.title || "Imported source - identify area", status: "Draft - source review required", sourceId: source.id, sourceName: source.name, sourceType: source.type, rows: [emptyRow("1st Alarm"), emptyRow("2nd Alarm"), emptyRow("3rd Alarm")] }, 0)];
      if (!imported.length) throw new Error("No structured rows were found");
      if (file && file.size) await storeSource(sourceId, file);
      imported.forEach(function (card) { if (!state.groups.includes(card.group)) state.groups.push(card.group); });
      state.cards = imported.concat(state.cards); state.activeGroup = imported[0].group; state.activeCardId = imported[0].id; importOpen = false;
      save(imported.length + " editable draft" + (imported.length === 1 ? "" : "s") + " created - administrator review required"); render();
    } catch (error) {
      state.notice = "Import could not be mapped: " + String(error && error.message || "review the source format"); render();
    }
    return false;
  };
  window.bcSetCard = function (id, key, value) {
    if (!admin) return;
    const card = state.cards.find(function (item) { return item.id === id; }); if (!card || !["group", "box", "division", "title", "status", "interdivisional"].includes(key)) return;
    const oldGroup = card.group; card[key] = String(value || "").trim(); card.updatedAt = "today";
    if (key === "group" && card.group) { if (!state.groups.includes(card.group)) state.groups.push(card.group); state.activeGroup = card.group; }
    save("Box Card changes saved on this device");
    if (key === "group" && oldGroup !== card.group) render();
  };
  window.bcSetAlarm = function (id, rowIndex, value) { if (!admin) return; const card = state.cards.find(function (item) { return item.id === id; }); if (!card || !card.rows[rowIndex]) return; card.rows[rowIndex].alarm = String(value || "Alarm"); save("Alarm row saved"); };
  window.bcSetCell = function (id, rowIndex, cellIndex, value) { if (!admin) return; const card = state.cards.find(function (item) { return item.id === id; }); if (!card || !card.rows[rowIndex] || cellIndex < 0 || cellIndex >= COLUMNS.length) return; card.rows[rowIndex].cells[cellIndex] = String(value || ""); save("Alarm assignment saved"); };
  window.bcAddRow = function (id) { if (!admin) return; const card = state.cards.find(function (item) { return item.id === id; }); if (!card) return; card.rows.push(emptyRow((card.rows.length + 1) + "th Alarm")); save("Alarm row added"); render(); };
  window.bcRemoveRow = function (id, rowIndex) { if (!admin) return; const card = state.cards.find(function (item) { return item.id === id; }); if (!card || card.rows.length <= 1) return; card.rows.splice(rowIndex, 1); save("Alarm row removed"); render(); };
  window.bcDelete = function (id) { if (!admin || !confirm("Delete this device-local Box Card draft?")) return; state.cards = state.cards.filter(function (card) { return card.id !== id; }); state.activeCardId = ""; save("Box Card draft deleted"); render(); };
  window.bcDownloadJson = function (id) { const card = state.cards.find(function (item) { return item.id === id; }); if (!card) return; const data = { signature: card.box, group: card.group, division: card.division, title: card.title, status: card.status, rows: card.rows, interdivisional: card.interdivisional, source: card.sourceName || null }; download(slug(card.group + "-box-" + card.box) + ".json", JSON.stringify(data, null, 2), "application/json"); };
  window.bcDownloadCsv = function (id) { const card = state.cards.find(function (item) { return item.id === id; }); if (!card) return; const quote = function (value) { return '"' + String(value || "").replaceAll('"', '""') + '"'; }; const lines = [["group", "box", "division", "area", "alarm"].concat(COLUMNS.map(function (column) { return column.toLowerCase(); })).map(quote).join(",")].concat(card.rows.map(function (row) { return [card.group, card.box, card.division, card.title, row.alarm].concat(row.cells).map(quote).join(","); })); download(slug(card.group + "-box-" + card.box) + ".csv", lines.join("\n"), "text/csv"); };
  window.bcDownloadSource = async function (sourceId) { try { const source = await getSource(sourceId); if (!source) throw new Error("source unavailable"); download(source.name || "box-card-source", source.blob, source.type); } catch { alert("The original source is not available in this browser."); } };
  window.bcPrint = function (id) {
    const card = state.cards.find(function (item) { return item.id === id; }); if (!card) return;
    const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) return;
    popup.document.write('<!doctype html><html><head><title>Box ' + esc(card.box) + '</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{margin:0}p{margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #222;padding:7px;vertical-align:top}th{background:#eee}footer{margin-top:16px;font-size:10px;color:#555}@media print{body{margin:10mm}}</style></head><body><h1>Box ' + esc(card.box) + '</h1><p><b>' + esc(card.group) + '</b> · ' + esc(card.division) + '<br>' + esc(card.title) + '</p><table><thead><tr><th>Alarm</th>' + COLUMNS.map(function (column) { return '<th>' + esc(column) + '</th>'; }).join("") + '</tr></thead><tbody>' + card.rows.map(function (row) { return '<tr><th>' + esc(row.alarm) + '</th>' + row.cells.map(function (cell) { return '<td>' + esc(cell) + '</td>'; }).join("") + '</tr>'; }).join("") + '</tbody></table><p>' + esc(card.interdivisional) + '</p><footer>PrePlan 360 editable Box Card · verify all alarm assignments before operational use</footer><script>window.onload=function(){window.print()}</script></body></html>');
    popup.document.close();
  };

  const baseResourcesBody = typeof resBody === "function" ? resBody : function () { return ""; };
  resBody = function () { return resTab === "box" ? renderLibrary() : baseResourcesBody(); };
  syncLegacyCards();
  if (params.get("module") === "resources") { current = "resources"; resTab = "box"; }
  if (current === "resources" && typeof render === "function") render();
})();
