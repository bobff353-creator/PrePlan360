/* PrePlan 360 owner-only Inspection development workbench. */
(function () {
  const params = new URLSearchParams(location.search);
  const readOnly = params.get("view") === "readonly";
  if (readOnly) return;

  const STORE_KEY = "preplan360.inspectionOwner.v1";
  const VIEWS = [
    ["overview", "Overview"],
    ["queue", "Inspections"],
    ["occupancies", "Occupancies"],
    ["compliance", "Compliance"],
    ["permits", "Permits & ITM"],
    ["codes", "Code intelligence"],
    ["analytics", "Analytics"],
    ["admin", "Admin studio"],
  ];
  const BUILD_AREAS = [
    "Inspection queue", "Occupancies", "Field workflow", "Compliance", "Permits & ITM",
    "Fees & invoices", "Code intelligence", "Community risk", "Analytics", "AI review",
    "Public portal", "Integrations", "Sync center", "Release readiness", "Admin studio",
  ];
  const esc = typeof safeText === "function" ? safeText : function (value) {
    return String(value == null ? "" : value).replace(/[&<>\"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[character];
    });
  };

  function defaults() {
    return {
      view: "overview",
      selectedInspectionId: "",
      occupancies: [],
      inspections: [],
      settings: {
        inspectionTypes: "General occupancy\nAnnual fire safety\nComplaint\nReinspection",
        defaultDeadlineDays: "30",
        requireSignature: true,
        requireEvidence: false,
        publishApprovedHazards: false,
        portalEnabled: false,
        codeSource: "",
        jurisdiction: "",
      },
    };
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!saved || !Array.isArray(saved.occupancies) || !Array.isArray(saved.inspections)) return defaults();
      return Object.assign(defaults(), saved, { settings: Object.assign(defaults().settings, saved.settings || {}) });
    } catch (_) {
      return defaults();
    }
  }

  let state = load();
  let showOccupancyForm = false;
  let showInspectionForm = false;

  function save(message) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    const status = document.getElementById("inspSaveStatus");
    if (status) status.textContent = message || "Owner draft saved on this device";
  }

  function field(label, name, type, placeholder, value, required) {
    return '<label class="insp-field"><span>' + esc(label) + '</span><input name="' + esc(name) + '" type="' + esc(type || "text") + '" placeholder="' + esc(placeholder || "") + '" value="' + esc(value || "") + '" ' + (required ? "required" : "") + '></label>';
  }

  function selectField(label, name, options) {
    return '<label class="insp-field"><span>' + esc(label) + '</span><select name="' + esc(name) + '">' + options.map(function (option) {
      const value = Array.isArray(option) ? option[0] : option;
      const text = Array.isArray(option) ? option[1] : option;
      return '<option value="' + esc(value) + '">' + esc(text) + '</option>';
    }).join("") + '</select></label>';
  }

  function workspaceHeader(title, subtitle) {
    return '<div class="insp-section-head"><div><span>OWNER DEVELOPMENT WORKSPACE</span><h2>' + esc(title) + '</h2><p>' + esc(subtitle) + '</p></div><div class="insp-draft-state"><i></i><b>Owner draft</b><small id="inspSaveStatus">Saved on this device</small></div></div>';
  }

  function metrics() {
    const scheduled = state.inspections.filter(function (record) { return record.status === "Scheduled"; }).length;
    const active = state.inspections.filter(function (record) { return record.status === "In progress"; }).length;
    const review = state.inspections.filter(function (record) { return record.status === "Ready for review"; }).length;
    return '<div class="insp-metrics">' + [
      [state.inspections.length, "Draft inspections", "Device-local test records"],
      [scheduled, "Scheduled", "Owner preview schedule"],
      [active, "In progress", "Field workflow testing"],
      [review, "Pending review", "Not published"],
    ].map(function (item) {
      return '<article><b>' + item[0] + '</b><span>' + item[1] + '</span><small>' + item[2] + '</small></article>';
    }).join("") + '</div>';
  }

  function overview() {
    return workspaceHeader("Inspection command", "See and test the current Inspection 360 foundation without publishing department records.") +
      '<div class="insp-truth"><div><b>Current build is visible to the owner</b><span>This preview is device-local and fictional. Department pages remain locked until identity, tenant access, approved checklists, and publishing are connected.</span></div><strong>NOT PUBLISHED</strong></div>' +
      metrics() +
      '<div class="insp-overview-grid"><section class="insp-panel"><header><div><span>NEXT ACTIONS</span><h3>Keep building from here</h3></div></header><div class="insp-actions"><button class="btn pri" onclick="inspOpenNewOccupancy()">+ Add test occupancy</button><button class="btn" onclick="inspOpenNewInspection()">+ Start draft inspection</button><button class="btn" onclick="inspGo(\'admin\')">Configure foundation</button></div><div class="insp-empty"><b>No live department records are loaded.</b><span>Add fictional device-local drafts to test the workflow, or use Admin studio to shape the shared foundation.</span></div></section>' +
      '<section class="insp-panel"><header><div><span>RELEASE GATES</span><h3>Protected by design</h3></div></header><ul class="insp-gates"><li class="ok"><b>Owner preview</b><span>Available now</span></li><li><b>Department access</b><span>Locked</span></li><li><b>Identity and tenant membership</b><span>Not connected here</span></li><li><b>Approved code and checklist sources</b><span>Not published</span></li></ul></section></div>' +
      '<section class="insp-panel insp-build-map"><header><div><span>CURRENT INSPECTION 360 SCOPE</span><h3>Existing build areas</h3></div><small>Visible for owner planning; no claim of live integration</small></header><div>' + BUILD_AREAS.map(function (name, index) { return '<span><i>' + String(index + 1).padStart(2, "0") + '</i>' + esc(name) + '</span>'; }).join("") + '</div></section>';
  }

  function occupancyForm() {
    return '<form class="insp-inline-form" onsubmit="return inspSaveOccupancy(event)"><header><div><span>FICTIONAL TEST RECORD</span><h3>Add occupancy</h3></div><button type="button" class="btn" onclick="inspCloseForms()">Close</button></header><div class="insp-form-grid">' +
      field("Occupancy / property name", "name", "text", "Test property", "", true) +
      field("Address", "address", "text", "Fictional test address", "", true) +
      selectField("Use group", "useGroup", ["Not classified", "Assembly", "Business", "Educational", "Factory", "Mercantile", "Residential", "Storage"]) +
      field("Contact role", "contactRole", "text", "Owner, manager, tenant", "", false) +
      '</div><p>Do not enter medical, disciplinary, protected, or real department information in this owner demo.</p><button class="btn pri" type="submit">Save test occupancy</button></form>';
  }

  function inspectionForm() {
    const occupancyOptions = state.occupancies.length ? state.occupancies.map(function (record) { return [record.id, record.name + " · " + record.address]; }) : [["", "Add an occupancy first"]];
    const types = String(state.settings.inspectionTypes || "General occupancy").split(/\n+/).map(function (value) { return value.trim(); }).filter(Boolean);
    return '<form class="insp-inline-form" onsubmit="return inspSaveInspection(event)"><header><div><span>FICTIONAL TEST RECORD</span><h3>Start draft inspection</h3></div><button type="button" class="btn" onclick="inspCloseForms()">Close</button></header><div class="insp-form-grid">' +
      selectField("Occupancy", "occupancyId", occupancyOptions) +
      selectField("Inspection type", "type", types.length ? types : ["General occupancy"]) +
      field("Scheduled date", "scheduledFor", "date", "", "", false) +
      field("Inspector", "inspector", "text", "Unassigned", "", false) +
      '</div><p>This record stays in this browser and cannot reach payroll, scheduling, CAD, or a department database.</p><button class="btn pri" type="submit" ' + (state.occupancies.length ? "" : "disabled") + '>Save draft inspection</button></form>';
  }

  function queue() {
    const rows = state.inspections.map(function (record) {
      const occupancy = state.occupancies.find(function (item) { return item.id === record.occupancyId; });
      return '<article class="insp-record"><div><span>' + esc(record.type) + '</span><h3>' + esc(occupancy ? occupancy.name : "Occupancy removed") + '</h3><p>' + esc(occupancy ? occupancy.address : "Address unavailable") + '</p></div><dl><div><dt>Status</dt><dd>' + esc(record.status) + '</dd></div><div><dt>Scheduled</dt><dd>' + esc(record.scheduledFor || "Not set") + '</dd></div><div><dt>Inspector</dt><dd>' + esc(record.inspector || "Unassigned") + '</dd></div></dl><div class="insp-record-actions"><button class="btn" onclick="inspSelectInspection(\'' + esc(record.id) + '\')">Open field record</button><button class="btn" onclick="inspAdvanceInspection(\'' + esc(record.id) + '\')">Advance status</button></div></article>';
    }).join("");
    return workspaceHeader("Inspection queue", "Schedule, assign, and test the inspection lifecycle with device-local fictional drafts.") +
      '<div class="insp-actions"><button class="btn pri" onclick="inspOpenNewInspection()">+ Start draft inspection</button><button class="btn" onclick="inspGo(\'occupancies\')">Manage occupancies</button></div>' +
      (showInspectionForm ? inspectionForm() : "") +
      (rows ? '<div class="insp-record-list">' + rows + '</div>' : '<div class="insp-empty tall"><b>No draft inspections yet.</b><span>Add an occupancy, then start a draft inspection. Nothing is sent to a department.</span></div>');
  }

  function occupancies() {
    const cards = state.occupancies.map(function (record) {
      const count = state.inspections.filter(function (inspection) { return inspection.occupancyId === record.id; }).length;
      return '<article class="insp-occupancy"><span>' + esc(record.useGroup) + '</span><h3>' + esc(record.name) + '</h3><p>' + esc(record.address) + '</p><small>' + count + ' draft inspection' + (count === 1 ? "" : "s") + ' · Contact role: ' + esc(record.contactRole || "Not entered") + '</small><button class="btn" onclick="inspStartForOccupancy(\'' + esc(record.id) + '\')">Start inspection</button></article>';
    }).join("");
    return workspaceHeader("Occupancies", "Build the shared property connection before an inspection reaches a department workspace.") +
      '<div class="insp-actions"><button class="btn pri" onclick="inspOpenNewOccupancy()">+ Add test occupancy</button></div>' +
      (showOccupancyForm ? occupancyForm() : "") +
      (cards ? '<div class="insp-occupancy-grid">' + cards + '</div>' : '<div class="insp-empty tall"><b>No occupancy records loaded.</b><span>Real preplans and contacts are intentionally not copied into this owner demo.</span></div>');
  }

  function compliance() {
    const review = state.inspections.filter(function (record) { return record.status === "Ready for review"; });
    return workspaceHeader("Compliance work", "Shape corrections, deadlines, approvals, notices, and reinspection rules before department publishing.") +
      '<div class="insp-two"><section class="insp-panel"><header><div><span>OWNER PREVIEW</span><h3>Finding lifecycle</h3></div></header><ol class="insp-lifecycle"><li>Document field observation</li><li>Attach verified code source</li><li>Set correction and due date</li><li>Capture authorized review</li><li>Schedule reinspection</li><li>Close with complete history</li></ol></section><section class="insp-panel"><header><div><span>REVIEW QUEUE</span><h3>' + review.length + ' draft record' + (review.length === 1 ? "" : "s") + '</h3></div></header><div class="insp-empty"><b>No live violations or compliance figures.</b><span>Approved findings will be department-scoped and audited when persistence is connected.</span></div></section></div>';
  }

  function permits() {
    return workspaceHeader("Permits & ITM", "Plan permit applications, contractor submissions, inspection scheduling, and authorized issuance.") +
      '<div class="insp-two"><section class="insp-panel"><header><div><span>PERMIT WORKFLOW</span><h3>Development surface</h3></div></header><div class="insp-feature-list"><span>Application intake</span><span>Plan review and routing</span><span>Fee assessment</span><span>Inspection prerequisites</span><span>Authorized issuance</span></div></section><section class="insp-panel"><header><div><span>ITM WORKFLOW</span><h3>Development surface</h3></div></header><div class="insp-feature-list"><span>Contractor submissions</span><span>System inventory</span><span>Deficiency triage</span><span>Corrections and acceptance</span><span>Retention and audit</span></div></section></div><div class="insp-truth"><div><b>No permit, payment, or contractor service is connected.</b><span>These cards expose the current product scope only.</span></div><strong>OWNER ONLY</strong></div>';
  }

  function codes() {
    return workspaceHeader("Code intelligence", "Keep adopted editions, local amendments, effective dates, and official sources under AHJ control.") +
      '<div class="insp-two"><section class="insp-panel"><header><div><span>JURISDICTION</span><h3>' + esc(state.settings.jurisdiction || "Not configured") + '</h3></div></header><p class="insp-copy">No model code is enforceable here until an authorized administrator records the adopted source and amendment chain.</p><button class="btn" onclick="inspGo(\'admin\')">Configure sources</button></section><section class="insp-panel"><header><div><span>OFFICIAL SOURCE</span><h3>' + esc(state.settings.codeSource || "Not linked") + '</h3></div></header><p class="insp-copy">Licensed code text is not copied into this demo. Store citations and approved summaries only.</p></section></div>';
  }

  function analytics() {
    const total = state.inspections.length;
    const approved = state.inspections.filter(function (record) { return record.status === "Approved"; }).length;
    return workspaceHeader("Inspection analytics", "Preview the measures available after department-scoped records and review history are connected.") +
      '<div class="insp-metrics"><article><b>' + total + '</b><span>Test records</span><small>Device-local only</small></article><article><b>' + approved + '</b><span>Approved in preview</span><small>Not published</small></article><article><b>—</b><span>Compliance rate</span><small>Needs live records</small></article><article><b>—</b><span>Average close time</span><small>Needs live history</small></article></div><div class="insp-empty tall"><b>Analytics waits for authorized data.</b><span>No department totals, inspection results, fees, or compliance trends are invented.</span></div>';
  }

  function admin() {
    const settings = state.settings;
    return workspaceHeader("Administration studio", "Edit the owner foundation that future departments can inherit after review and publishing.") +
      '<form class="insp-admin" onsubmit="return inspSaveAdmin(event)"><div class="insp-form-grid"><label class="insp-field wide"><span>Inspection types · one per line</span><textarea name="inspectionTypes">' + esc(settings.inspectionTypes) + '</textarea></label>' +
      field("Default correction deadline (days)", "defaultDeadlineDays", "number", "30", settings.defaultDeadlineDays, true) +
      field("Jurisdiction / AHJ", "jurisdiction", "text", "Not configured", settings.jurisdiction, false) +
      field("Official adopted-code source URL", "codeSource", "url", "https://approved-source.example", settings.codeSource, false) +
      '<div class="insp-checks"><label><input type="checkbox" name="requireSignature" ' + (settings.requireSignature ? "checked" : "") + '><span><b>Require acknowledgment/signature</b><small>Applies to the future field workflow</small></span></label><label><input type="checkbox" name="requireEvidence" ' + (settings.requireEvidence ? "checked" : "") + '><span><b>Require evidence for findings</b><small>Storage and malware scanning must be connected</small></span></label><label><input type="checkbox" name="publishApprovedHazards" ' + (settings.publishApprovedHazards ? "checked" : "") + '><span><b>Publish approved hazards to Respond</b><small>Disabled until cross-module approval is implemented</small></span></label><label><input type="checkbox" name="portalEnabled" ' + (settings.portalEnabled ? "checked" : "") + '><span><b>Public portal</b><small>Disabled until identity, redaction, and authorization are verified</small></span></label></div></div><div class="insp-admin-footer"><div><b>Owner preview settings</b><span>Saved only in this browser. This does not publish Inspection 360.</span></div><button class="btn pri" type="submit">Save inspection foundation</button></div></form>';
  }

  function body() {
    if (state.view === "queue") return queue();
    if (state.view === "occupancies") return occupancies();
    if (state.view === "compliance") return compliance();
    if (state.view === "permits") return permits();
    if (state.view === "codes") return codes();
    if (state.view === "analytics") return analytics();
    if (state.view === "admin") return admin();
    return overview();
  }

  function ownerView() {
    return head("Prevention", "Inspections", "Owner-visible development build · department publishing remains locked") +
      '<section class="insp-dev"><nav class="insp-tabs" aria-label="Inspection development workspace">' + VIEWS.map(function (view) {
        return '<button class="' + (state.view === view[0] ? "active" : "") + '" onclick="inspGo(\'' + view[0] + '\')">' + esc(view[1]) + '</button>';
      }).join("") + '</nav><div class="insp-body">' + body() + '</div></section>' + footer();
  }

  window.inspGo = function (view) {
    if (!VIEWS.some(function (item) { return item[0] === view; })) view = "overview";
    state.view = view;
    save();
    render();
    const main = document.getElementById("main");
    if (main) main.scrollTop = 0;
  };
  window.inspOpenNewOccupancy = function () { state.view = "occupancies"; showOccupancyForm = true; showInspectionForm = false; render(); };
  window.inspOpenNewInspection = function () { state.view = "queue"; showInspectionForm = true; showOccupancyForm = false; render(); };
  window.inspCloseForms = function () { showInspectionForm = false; showOccupancyForm = false; render(); };
  window.inspSaveOccupancy = function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.occupancies.push({
      id: "occ-" + Date.now(),
      name: String(form.get("name") || "").trim(),
      address: String(form.get("address") || "").trim(),
      useGroup: String(form.get("useGroup") || "Not classified"),
      contactRole: String(form.get("contactRole") || "").trim(),
    });
    showOccupancyForm = false;
    save("Test occupancy saved on this device");
    render();
    return false;
  };
  window.inspSaveInspection = function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const occupancyId = String(form.get("occupancyId") || "");
    if (!state.occupancies.some(function (record) { return record.id === occupancyId; })) return false;
    state.inspections.unshift({
      id: "insp-" + Date.now(),
      occupancyId: occupancyId,
      type: String(form.get("type") || "General occupancy"),
      scheduledFor: String(form.get("scheduledFor") || ""),
      inspector: String(form.get("inspector") || "").trim(),
      status: "Draft",
      notes: "",
    });
    showInspectionForm = false;
    save("Draft inspection saved on this device");
    render();
    return false;
  };
  window.inspStartForOccupancy = function (id) {
    state.view = "queue";
    showInspectionForm = true;
    render();
    const select = document.querySelector('.insp-inline-form select[name="occupancyId"]');
    if (select) select.value = id;
  };
  window.inspSelectInspection = function (id) {
    state.selectedInspectionId = id;
    const record = state.inspections.find(function (item) { return item.id === id; });
    if (!record) return;
    const occupancy = state.occupancies.find(function (item) { return item.id === record.occupancyId; });
    alert((occupancy ? occupancy.name : "Inspection") + "\n\nStatus: " + record.status + "\nType: " + record.type + "\n\nThe detailed field checklist is the next owner development surface. This preview record remains device-local.");
  };
  window.inspAdvanceInspection = function (id) {
    const stages = ["Draft", "Scheduled", "In progress", "Ready for review", "Approved"];
    const record = state.inspections.find(function (item) { return item.id === id; });
    if (!record) return;
    const index = stages.indexOf(record.status);
    record.status = stages[Math.min(stages.length - 1, index + 1)];
    save("Inspection preview status updated");
    render();
  };
  window.inspSaveAdmin = function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.settings.inspectionTypes = String(form.get("inspectionTypes") || "");
    state.settings.defaultDeadlineDays = String(form.get("defaultDeadlineDays") || "30");
    state.settings.jurisdiction = String(form.get("jurisdiction") || "").trim();
    state.settings.codeSource = String(form.get("codeSource") || "").trim();
    state.settings.requireSignature = form.has("requireSignature");
    state.settings.requireEvidence = form.has("requireEvidence");
    state.settings.publishApprovedHazards = form.has("publishApprovedHazards");
    state.settings.portalEnabled = form.has("portalEnabled");
    save("Inspection foundation saved on this device");
    render();
    return false;
  };

  function ownerInspectionLabels(html) {
    return html
      .replaceAll("Coming soon", "Owner build")
      .replaceAll(">SOON<", ">BUILD<")
      .replaceAll("Owner development only", "Owner workbench available");
  }
  if (typeof viewBoard === "function") {
    const baseBoard = viewBoard;
    viewBoard = function () { return ownerInspectionLabels(baseBoard()); };
  }
  if (typeof viewDash === "function") {
    const baseDash = viewDash;
    viewDash = function () { return ownerInspectionLabels(baseDash()); };
  }
  viewInsp = ownerView;
  const module = typeof MODULES !== "undefined" ? MODULES.find(function (item) { return item.id === "insp"; }) : null;
  if (module) module.label = "Inspections · Owner Build";
  if (params.get("module") === "insp") current = "insp";
  if (typeof buildNav === "function") buildNav();
  if (current === "insp" && typeof render === "function") render();
})();
