/* PrePlan 360 compact policy library and document reader. */
/* global safeText, POLICIES, render, resBody:writable, resTab:writable, current:writable */
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
  const STORE_KEY = "preplan360.policies.v1";
  const PAGE_SIZE = 6;
  const esc = typeof safeText === "function" ? safeText : function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  };
  const demoBodies = {
    "Structure Fire SOG": "Purpose\nProvide a consistent command, accountability, water-supply, and incident-communications framework for the fictional demo department.\n\nInitial actions\nEstablish command, confirm the reported location and occupancy, complete a 360 assessment when conditions permit, identify the operational mode, and announce the initial incident action plan.\n\nAccountability\nTrack every assigned crew, maintain crew integrity, and use PAR benchmarks established by department policy.\n\nReview note\nThis is fictional demonstration content. A department must replace it with its adopted, legally reviewed SOG before operational use.",
    "Mayday / RIT Procedure": "Purpose\nDemonstrate a concise member-emergency policy reader.\n\nCore workflow\nTransmit the emergency declaration, identify the member or crew, report the best known location and problem, maintain command discipline, and deploy the department's adopted rapid-intervention process.\n\nReview note\nThis fictional summary is not a substitute for department training, policy, or incident command direction.",
    "Overtime & Callback Policy": "Purpose\nDescribe the fictional department's callback and overtime approval workflow.\n\nProcess\nOpen opportunities are offered under the saved scheduling rules, qualifications are checked before assignment, and approval remains limited to authorized administrators. Payroll review uses the approved assignment record.",
    "Holiday Policy": "Purpose\nProvide a fictional example of holiday eligibility, scheduling, and payroll documentation.\n\nAdministration\nHoliday treatment follows the selected bargaining agreement, employment status, scheduled assignment, and approved payroll rules configured by the department.",
    "Bloodborne Pathogens Exposure Control": "Purpose\nDemonstrate access to an exposure-control document.\n\nImmediate actions\nFollow the department exposure-control plan, obtain appropriate medical evaluation, document the event through the protected reporting workflow, and preserve employee privacy."
  };

  function slug(value) {
    return String(value || "policy").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "policy";
  }

  function normalizePolicy(policy, index) {
    const title = String(policy && policy.title || "Untitled policy");
    return {
      id: String(policy && policy.id || "demo-policy-" + slug(title) + "-" + index),
      title: title,
      category: String(policy && (policy.category || policy.cat) || "General"),
      effective: String(policy && (policy.effective || policy.effectiveDate) || "Not entered"),
      updated: String(policy && policy.updated || "Not entered"),
      body: String(policy && policy.body || demoBodies[title] || "No policy body has been entered. An administrator can add the adopted document text here."),
    };
  }

  function seedPolicies() {
    return POLICIES.map(normalizePolicy);
  }

  function loadPolicies() {
    if (!admin) return seedPolicies();
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      return Array.isArray(saved) && saved.length ? saved.map(normalizePolicy) : seedPolicies();
    } catch {
      return seedPolicies();
    }
  }

  let policies = loadPolicies();
  let search = "";
  let category = "All";
  let page = 0;
  let openId = "";
  let addOpen = false;
  let notice = "";

  function syncLegacyPolicies() {
    if (!admin) return;
    const legacy = policies.map(function (policy) { return { title: policy.title, cat: policy.category, updated: policy.updated, body: policy.body, effective: policy.effective }; });
    POLICIES.splice.apply(POLICIES, [0, POLICIES.length].concat(legacy));
  }

  function save(message) {
    if (admin) localStorage.setItem(STORE_KEY, JSON.stringify(policies));
    notice = message || "";
    syncLegacyPolicies();
  }

  function categories() {
    return ["All"].concat(Array.from(new Set(policies.map(function (policy) { return policy.category; }))).sort());
  }

  function filteredPolicies() {
    const query = search.trim().toLowerCase();
    return policies.filter(function (policy) {
      return (category === "All" || policy.category === category) && (!query || (policy.title + " " + policy.category + " " + policy.body).toLowerCase().includes(query));
    });
  }

  function policyReader(policy) {
    if (!policy) return "";
    return '<div class="pl-overlay" role="presentation" onclick="plBackdrop(event)"><section class="pl-reader" role="dialog" aria-modal="true" aria-labelledby="pl-reader-title"><header><div><span>' + esc(policy.category) + '</span><h2 id="pl-reader-title">' + esc(policy.title) + '</h2><p>Effective ' + esc(policy.effective) + ' · Updated ' + esc(policy.updated) + '</p></div><button class="btn" type="button" onclick="plClose()">Close</button></header><div class="pl-reader-body">' + (admin ? '<div class="pl-edit-grid"><label><span>Document title</span><input value="' + esc(policy.title) + '" oninput="plSet(\'' + esc(policy.id) + '\',\'title\',this.value)"></label><label><span>Category</span><input value="' + esc(policy.category) + '" oninput="plSet(\'' + esc(policy.id) + '\',\'category\',this.value)"></label><label><span>Effective date</span><input value="' + esc(policy.effective) + '" oninput="plSet(\'' + esc(policy.id) + '\',\'effective\',this.value)"></label><label><span>Updated</span><input value="' + esc(policy.updated) + '" oninput="plSet(\'' + esc(policy.id) + '\',\'updated\',this.value)"></label><label class="wide"><span>Policy / SOG text</span><textarea oninput="plSet(\'' + esc(policy.id) + '\',\'body\',this.value)">' + esc(policy.body) + '</textarea></label></div>' : '<div class="pl-document-text">' + esc(policy.body).replaceAll("\n", "<br>") + '</div>') + '</div><footer><span>' + (admin ? "Owner changes save on this device." : "View-only policy document.") + '</span><div><button class="btn" type="button" onclick="plPrint(\'' + esc(policy.id) + '\')">Print / Save PDF</button>' + (admin ? '<button class="btn danger" type="button" onclick="plDelete(\'' + esc(policy.id) + '\')">Delete draft</button>' : "") + '</div></footer></section></div>';
  }

  function addPanel() {
    if (!admin || !addOpen) return "";
    return '<form class="pl-add" onsubmit="return plAdd(event)"><header><div><span>ADMIN</span><h3>Add policy, SOG, or SOP</h3></div><button class="btn" type="button" onclick="plToggleAdd()">Close</button></header><div class="pl-edit-grid"><label><span>Document title</span><input name="title" required placeholder="Cold Weather Operations SOG"></label><label><span>Category</span><input name="category" required placeholder="Operations"></label><label><span>Effective date</span><input name="effective" placeholder="Aug 2026"></label><label class="wide"><span>Policy / SOG text</span><textarea name="body" required placeholder="Paste or enter the adopted document text..."></textarea></label></div><button class="btn pri" type="submit">Create policy draft</button></form>';
  }

  function renderPolicies() {
    const filtered = filteredPolicies();
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page >= pageCount) page = pageCount - 1;
    const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const openPolicy = policies.find(function (policy) { return policy.id === openId; });
    return '<section class="pl-library"><div class="pl-toolbar"><div><span>POLICY LIBRARY</span><h2>Policies, SOGs & SOPs</h2><p>Search or filter first, then open one document at a time.</p></div>' + (admin ? '<button class="btn pri" type="button" onclick="plToggleAdd()">+ Add policy</button>' : '<span class="pl-view-only">View only</span>') + '</div>' + (notice ? '<div class="pl-notice" role="status">' + esc(notice) + '</div>' : "") + addPanel() + '<div class="pl-filters"><label><span>Search documents</span><input aria-label="Search policy documents" value="' + esc(search) + '" oninput="plSearch(this.value)" placeholder="Title, category, or policy text"></label><div class="pl-categories" role="tablist" aria-label="Policy categories">' + categories().map(function (item) { const count = item === "All" ? policies.length : policies.filter(function (policy) { return policy.category === item; }).length; return '<button role="tab" type="button" aria-selected="' + String(category === item) + '" class="' + (category === item ? "active" : "") + '" onclick="plCategory(\'' + encodeURIComponent(item).replaceAll("'", "%27") + '\')"><span>' + esc(item) + '</span><b>' + count + '</b></button>'; }).join("") + '</div></div><div class="pl-results-head"><b>' + filtered.length + ' document' + (filtered.length === 1 ? "" : "s") + '</b><span>Page ' + (page + 1) + ' of ' + pageCount + ' · up to ' + PAGE_SIZE + ' shown</span></div><div class="pl-policy-list">' + (visible.length ? visible.map(function (policy) { return '<button class="pl-policy-row" type="button" onclick="plOpen(\'' + esc(policy.id) + '\')"><span class="pl-doc-icon">DOC</span><span><b>' + esc(policy.title) + '</b><small>' + esc(policy.category) + ' · Effective ' + esc(policy.effective) + '</small></span><span class="pl-updated">' + esc(policy.updated) + '</span><strong>Open →</strong></button>'; }).join("") : '<div class="pl-empty"><b>No matching documents</b><span>Choose another category or clear the search.</span></div>') + '</div><div class="pl-pagination"><button class="btn" type="button" ' + (page === 0 ? "disabled" : "") + ' onclick="plPage(-1)">← Previous</button><span>' + (page * PAGE_SIZE + (visible.length ? 1 : 0)) + '–' + Math.min((page + 1) * PAGE_SIZE, filtered.length) + ' of ' + filtered.length + '</span><button class="btn" type="button" ' + (page >= pageCount - 1 ? "disabled" : "") + ' onclick="plPage(1)">Next →</button></div><div class="pl-boundary"><b>No scroll-of-death</b><span>The library shows a controlled page of results. Opened policy text scrolls inside its own reader.</span></div>' + policyReader(openPolicy) + '</section>';
  }

  function allowReadonlySearch() {
    if (admin || typeof requestAnimationFrame !== "function") return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const input = document.querySelector(".pl-library input[aria-label='Search policy documents']");
        if (!input) return;
        input.disabled = false;
        input.removeAttribute("aria-disabled");
        input.title = "Search the view-only policy library";
      });
    });
  }

  window.plSearch = function (value) { search = String(value || ""); page = 0; render(); };
  window.plCategory = function (value) { category = decodeURIComponent(value); page = 0; render(); };
  window.plPage = function (direction) { page = Math.max(0, page + Number(direction || 0)); render(); requestAnimationFrame(function () { const library = document.querySelector(".pl-library"); if (library) library.scrollIntoView({ block: "start" }); }); };
  window.plOpen = function (id) { openId = id; render(); };
  window.plClose = function () { openId = ""; notice = ""; render(); };
  window.plBackdrop = function (event) { if (event.target && event.target.classList && event.target.classList.contains("pl-overlay")) window.plClose(); };
  window.plToggleAdd = function () { if (!admin) return; addOpen = !addOpen; render(); };
  window.plAdd = function (event) {
    event.preventDefault();
    if (!admin) return false;
    const form = new FormData(event.currentTarget);
    const policy = normalizePolicy({ id: "policy-" + Date.now(), title: form.get("title"), category: form.get("category"), effective: form.get("effective") || "Not entered", updated: "today", body: form.get("body") }, policies.length);
    policies.unshift(policy); category = policy.category; page = 0; openId = policy.id; addOpen = false; save("Policy draft created"); render(); return false;
  };
  window.plSet = function (id, field, value) {
    if (!admin || !["title", "category", "effective", "updated", "body"].includes(field)) return;
    const policy = policies.find(function (item) { return item.id === id; }); if (!policy) return;
    policy[field] = String(value || ""); save("Policy changes saved on this device");
  };
  window.plDelete = function (id) { if (!admin || !confirm("Delete this device-local policy draft?")) return; policies = policies.filter(function (policy) { return policy.id !== id; }); openId = ""; save("Policy draft deleted"); render(); };
  window.plPrint = function (id) {
    const policy = policies.find(function (item) { return item.id === id; }); if (!policy) return;
    const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) return;
    popup.document.write('<!doctype html><html><head><title>' + esc(policy.title) + '</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 24px;color:#111}header{border-bottom:3px solid #111}h1{margin:5px 0}article{white-space:pre-wrap;line-height:1.6;margin-top:24px}footer{border-top:1px solid #aaa;margin-top:28px;padding-top:10px;font-size:11px;color:#555}</style></head><body><header><b>' + esc(policy.category) + '</b><h1>' + esc(policy.title) + '</h1><p>Effective ' + esc(policy.effective) + ' · Updated ' + esc(policy.updated) + '</p></header><article>' + esc(policy.body) + '</article><footer>PrePlan 360 policy copy · verify against the department-adopted source.</footer><script>window.onload=function(){window.print()}</script></body></html>');
    popup.document.close();
  };

  const baseResourcesBody = typeof resBody === "function" ? resBody : function () { return ""; };
  resBody = function () {
    if (resTab !== "policies") return baseResourcesBody();
    allowReadonlySearch();
    return renderPolicies();
  };
  syncLegacyPolicies();
  if (params.get("submodule") === "policies") { current = "resources"; resTab = "policies"; }
  if (current === "resources" && resTab === "policies") render();
})();
