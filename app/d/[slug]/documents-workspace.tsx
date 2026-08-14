"use client";

import { useMemo, useState } from "react";
import type { StickneyBoxCard, StickneyBoxCardAlarmRow, StickneyPolicy } from "@/db/stickney";

type Props = {
  departmentId: string;
  boxCards: StickneyBoxCard[];
  policies: StickneyPolicy[];
  sourceName: string;
  sourceSystem: string;
  editable: boolean;
  supportSessionId: string;
};

type EditableField = {
  name: string;
  label: string;
  value: string | number | null | undefined;
  multiline?: boolean;
};

type BoxCardDraft = {
  group: string;
  box: string;
  division: string;
  status: string;
  title: string;
  area: string;
  rows: StickneyBoxCardAlarmRow[];
  interdivisional: string;
  accessNotes: string;
};

const BOX_CARD_COLUMNS = ["Engines", "Trucks", "Squads", "EMS", "Chiefs", "Special", "Change of Quarters", "Notifications"];

function safeDocumentHref(value: string) {
  if (value.startsWith("/box-cards/")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function filename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "box-card";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function normalizeRows(rows: StickneyBoxCardAlarmRow[] | undefined, isStickney: boolean) {
  const sourceRows = Array.isArray(rows) && rows.length
    ? rows
    : (isStickney ? ["Still", "Full Still", "Box", "2nd", "3rd", "4th"] : ["1st Alarm", "2nd Alarm", "3rd Alarm"]).map((alarm) => ({ alarm, cells: [] }));
  return sourceRows.map((row) => {
    const cells = Array.isArray(row.cells) ? row.cells.slice(0, BOX_CARD_COLUMNS.length).map(String) : [];
    while (cells.length < BOX_CARD_COLUMNS.length) cells.push("");
    return { alarm: String(row.alarm || "Alarm"), cells };
  });
}

function draftFor(card: StickneyBoxCard): BoxCardDraft {
  return {
    group: card.department || "Unassigned",
    box: card.box_number || "",
    division: card.division || "",
    status: card.status === "Active" ? "Published" : card.status || "Draft - review required",
    title: card.title || "",
    area: card.address || "",
    rows: normalizeRows(card.alarm_rows, card.department?.trim().toLowerCase() === "stickney"),
    interdivisional: card.interdivisional || "",
    accessNotes: card.access_notes || "",
  };
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadJson(card: StickneyBoxCard, draft = draftFor(card)) {
  download(`${filename(`${draft.group}-box-${draft.box || card.id}`)}.json`, JSON.stringify({
    group: draft.group,
    signature: draft.box,
    division: draft.division,
    status: draft.status,
    title: draft.title,
    area: draft.area,
    columns: BOX_CARD_COLUMNS,
    rows: draft.rows,
    interdivisional: draft.interdivisional,
    information: draft.accessNotes,
    original_source: safeDocumentHref(card.document_url) || null,
    source_page: card.document_page || null,
  }, null, 2), "application/json");
}

function downloadCsv(card: StickneyBoxCard, draft = draftFor(card)) {
  const quote = (value: string) => `"${String(value || "").replaceAll('"', '""')}"`;
  const header = ["group", "box", "division", "title", "area", "alarm", ...BOX_CARD_COLUMNS].map(quote).join(",");
  const rows = draft.rows.map((row) => [draft.group, draft.box, draft.division, draft.title, draft.area, row.alarm, ...row.cells].map(quote).join(","));
  download(`${filename(`${draft.group}-box-${draft.box || card.id}`)}.csv`, [header, ...rows].join("\n"), "text/csv");
}

function printCard(card: StickneyBoxCard, draft = draftFor(card)) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return;
  const source = safeDocumentHref(card.document_url);
  popup.document.write(`<!doctype html><html><head><title>Box ${escapeHtml(draft.box)}</title><style>body{font:12px Arial,sans-serif;margin:20px;color:#111}header{border:2px solid #111;display:grid;grid-template-columns:1fr 2fr;gap:12px;padding:10px;margin-bottom:12px}h1{margin:2px 0;font-size:26px}p{margin:4px 0;white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #222;padding:6px;vertical-align:top;white-space:pre-wrap}th{background:#eee}.info{border:1px solid #555;padding:10px;margin-top:12px;white-space:pre-wrap}footer{margin-top:14px;font-size:9px;color:#555}@media print{body{margin:8mm}}</style></head><body><header><div><b>${escapeHtml(draft.group)}</b><h1>Box ${escapeHtml(draft.box || "Not entered")}</h1><p>Division ${escapeHtml(draft.division || "Not entered")}</p></div><div><b>${escapeHtml(draft.title)}</b><p>${escapeHtml(draft.area || "Area not entered")}</p><p>${escapeHtml(draft.status)}</p></div></header><table><thead><tr><th>Alarm</th>${BOX_CARD_COLUMNS.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${draft.rows.map((row) => `<tr><th>${escapeHtml(row.alarm)}</th>${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table><div class="info"><b>Interdivisional request</b><p>${escapeHtml(draft.interdivisional || "None entered")}</p><b>Information / access notes</b><p>${escapeHtml(draft.accessNotes || "None entered")}</p></div><footer>PrePlan 360 editable Box Card. Verify every assignment against the original source before operational use.${source ? ` Original: ${escapeHtml(source)}` : ""}</footer><script>window.onload=function(){window.print()}</script></body></html>`);
  popup.document.close();
}

function printPolicy(policy: StickneyPolicy) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(policy.title)}</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 24px;color:#111}header{border-bottom:3px solid #111}h1{margin:5px 0}article{white-space:pre-wrap;line-height:1.65;margin-top:24px}footer{border-top:1px solid #aaa;margin-top:28px;padding-top:10px;font-size:11px;color:#555}</style></head><body><header><b>${escapeHtml(policy.category || "General")}</b><h1>${escapeHtml(policy.title)}</h1><p>${escapeHtml(policy.policy_number || "Policy number not entered")} - ${policy.effective_date ? `Effective ${escapeHtml(policy.effective_date.slice(0, 10))}` : "Effective date not entered"}</p></header><article>${escapeHtml(policy.body || "No policy body was imported.")}</article><footer>PrePlan 360 policy copy - verify against the department-adopted source.</footer><script>window.onload=function(){window.print()}</script></body></html>`);
  popup.document.close();
}

function EditableRecord({ departmentId, recordType, recordId, fields, editable, supportSessionId }: { departmentId: string; recordType: "policy"; recordId: string; fields: EditableField[]; editable: boolean; supportSessionId: string }) {
  if (!editable) return null;
  return (
    <details className="stickney-record-editor document-admin-editor">
      <summary>Admin edit</summary>
      <form method="post" action={`/api/departments/${departmentId}/stickney-records`}>
        <input type="hidden" name="record_type" value={recordType} />
        <input type="hidden" name="record_id" value={recordId} />
        <input type="hidden" name="support_session_id" value={supportSessionId} />
        {fields.map((field) => (
          <label key={field.name}>{field.label}{field.multiline ? <textarea name={field.name} defaultValue={String(field.value ?? "")} rows={5} /> : <input name={field.name} defaultValue={String(field.value ?? "")} />}</label>
        ))}
        <button type="submit">Save verified change</button>
      </form>
    </details>
  );
}

function BoxCardEditor({ departmentId, card, editable, supportSessionId, groups, onClose }: { departmentId: string; card: StickneyBoxCard; editable: boolean; supportSessionId: string; groups: string[]; onClose: () => void }) {
  const [draft, setDraft] = useState<BoxCardDraft>(() => draftFor(card));
  const source = safeDocumentHref(card.document_url);
  const setValue = (key: Exclude<keyof BoxCardDraft, "rows">, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const setAlarm = (rowIndex: number, value: string) => setDraft((current) => ({ ...current, rows: current.rows.map((row, index) => index === rowIndex ? { ...row, alarm: value } : row) }));
  const setCell = (rowIndex: number, cellIndex: number, value: string) => setDraft((current) => ({ ...current, rows: current.rows.map((row, index) => index === rowIndex ? { ...row, cells: row.cells.map((cell, position) => position === cellIndex ? value : cell) } : row) }));
  const addRow = () => setDraft((current) => ({ ...current, rows: [...current.rows, { alarm: `Alarm ${current.rows.length + 1}`, cells: BOX_CARD_COLUMNS.map(() => "") }] }));
  const removeRow = (rowIndex: number) => setDraft((current) => ({ ...current, rows: current.rows.length <= 1 ? current.rows : current.rows.filter((_, index) => index !== rowIndex) }));

  return (
    <section className="department-box-editor" role="dialog" aria-modal="true" aria-labelledby="department-box-editor-title">
      <header>
        <div><span>{editable ? "ADMIN EDITOR" : "VIEW ONLY"}</span><h2 id="department-box-editor-title">Box {draft.box || "Not entered"}</h2><p>{draft.group} - {draft.title} - {draft.area}</p></div>
        <div className="department-box-editor-actions"><button type="button" onClick={onClose}>Close</button><button type="button" onClick={() => downloadJson(card, draft)}>Download JSON</button><button type="button" onClick={() => downloadCsv(card, draft)}>Download CSV</button><button type="button" className="primary" onClick={() => printCard(card, draft)}>Print / Save PDF</button></div>
      </header>
      <form method={editable ? "post" : undefined} action={editable ? `/api/departments/${departmentId}/stickney-records` : undefined}>
        {editable ? <><input type="hidden" name="record_type" value="box_card"/><input type="hidden" name="record_id" value={card.id}/><input type="hidden" name="support_session_id" value={supportSessionId}/><input type="hidden" name="details" value={card.details || ""}/><input type="hidden" name="alarm_rows" value={JSON.stringify(draft.rows)}/></> : null}
        <div className="department-box-meta">
          <label><span>Town / group</span>{editable ? <select name="department" value={draft.group} onChange={(event) => setValue("group", event.target.value)}>{groups.map((group) => <option key={group}>{group}</option>)}</select> : <strong>{draft.group}</strong>}</label>
          <label><span>Box / signature</span>{editable ? <input name="box_number" value={draft.box} onChange={(event) => setValue("box", event.target.value)} required/> : <strong>{draft.box}</strong>}</label>
          <label><span>Division</span>{editable ? <input name="division" value={draft.division} onChange={(event) => setValue("division", event.target.value)}/> : <strong>{draft.division || "Not entered"}</strong>}</label>
          <label><span>Status</span>{editable ? <select name="status" value={draft.status} onChange={(event) => setValue("status", event.target.value)}><option>Draft - review required</option><option>Reviewed</option><option>Published</option></select> : <strong>{draft.status}</strong>}</label>
          <label><span>Card title / alarm type</span>{editable ? <input name="title" value={draft.title} onChange={(event) => setValue("title", event.target.value)} required/> : <strong>{draft.title}</strong>}</label>
          <label className="wide"><span>Area / district</span>{editable ? <input name="address" value={draft.area} onChange={(event) => setValue("area", event.target.value)}/> : <strong>{draft.area || "Not entered"}</strong>}</label>
        </div>
        <div className="department-box-table-wrap">
          <table data-assignment-columns={BOX_CARD_COLUMNS.length}><thead><tr><th>Alarm</th>{BOX_CARD_COLUMNS.map((column) => <th key={column}>{column}</th>)}{editable ? <th aria-label="Row actions"/> : null}</tr></thead><tbody>{draft.rows.map((row, rowIndex) => <tr key={`${rowIndex}-${row.alarm}`}><th>{editable ? <input aria-label={`Alarm level ${rowIndex + 1}`} value={row.alarm} onChange={(event) => setAlarm(rowIndex, event.target.value)}/> : <span>{row.alarm}</span>}</th>{row.cells.map((cell, cellIndex) => <td key={BOX_CARD_COLUMNS[cellIndex]}>{editable ? <textarea aria-label={`${BOX_CARD_COLUMNS[cellIndex]} for ${row.alarm}`} value={cell} onChange={(event) => setCell(rowIndex, cellIndex, event.target.value)} rows={3}/> : <span>{cell || "-"}</span>}</td>)}{editable ? <td><button type="button" className="remove" onClick={() => removeRow(rowIndex)} disabled={draft.rows.length <= 1} aria-label={`Remove ${row.alarm} row`}>x</button></td> : null}</tr>)}</tbody></table>
        </div>
        <div className="department-box-editor-footer">
          {editable ? <button type="button" onClick={addRow}>+ Add alarm row</button> : null}
          <label><span>Interdivisional request</span>{editable ? <textarea name="interdivisional" value={draft.interdivisional} onChange={(event) => setValue("interdivisional", event.target.value)} rows={3}/> : <strong>{draft.interdivisional || "None entered"}</strong>}</label>
          <label><span>Information / access notes</span>{editable ? <textarea name="access_notes" value={draft.accessNotes} onChange={(event) => setValue("accessNotes", event.target.value)} rows={5}/> : <strong>{draft.accessNotes || "None entered"}</strong>}</label>
          <div className="department-box-source"><div><b>Original source preserved</b><span>{source ? `${source}${card.document_page ? ` - page ${card.document_page}` : ""}` : "No original file is linked to this imported record."}</span></div>{source ? <><a href={source} target="_blank" rel="noreferrer">Open original</a><a href={source} download>Download original</a></> : null}</div>
          {editable ? <div className="department-box-save"><span>Saves a department overlay. The imported source record and original file stay unchanged.</span><button type="submit">Save Box Card</button></div> : null}
        </div>
      </form>
    </section>
  );
}

export default function DocumentsWorkspace({ departmentId, boxCards, policies, sourceName, sourceSystem, editable, supportSessionId }: Props) {
  const groups = useMemo(() => Array.from(new Set(boxCards.map((card) => card.department || "Unassigned"))).sort((a, b) => a.localeCompare(b)), [boxCards]);
  const [view, setView] = useState<"box-cards" | "policies">("box-cards");
  const [activeGroup, setActiveGroup] = useState(groups[0] || "Unassigned");
  const [search, setSearch] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [policySearch, setPolicySearch] = useState("");
  const [policyCategory, setPolicyCategory] = useState("All");
  const [policyPage, setPolicyPage] = useState(0);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const visibleCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return boxCards.filter((card) => (card.department || "Unassigned") === activeGroup && (!query || `${card.box_number} ${card.title} ${card.address} ${card.access_notes} ${card.details} ${JSON.stringify(card.alarm_rows || [])}`.toLowerCase().includes(query)));
  }, [activeGroup, boxCards, search]);
  const selectedCard = boxCards.find((card) => card.id === selectedCardId) ?? null;
  const policyCategories = useMemo(() => ["All", ...Array.from(new Set(policies.map((policy) => policy.category || "General"))).sort((a, b) => a.localeCompare(b))], [policies]);
  const filteredPolicies = useMemo(() => {
    const query = policySearch.trim().toLowerCase();
    return policies.filter((policy) => (policyCategory === "All" || (policy.category || "General") === policyCategory) && (!query || `${policy.policy_number} ${policy.title} ${policy.category} ${policy.body}`.toLowerCase().includes(query)));
  }, [policies, policyCategory, policySearch]);
  const policyPageSize = 8;
  const policyPageCount = Math.max(1, Math.ceil(filteredPolicies.length / policyPageSize));
  const visiblePolicyPage = Math.min(policyPage, policyPageCount - 1);
  const visiblePolicies = filteredPolicies.slice(visiblePolicyPage * policyPageSize, visiblePolicyPage * policyPageSize + policyPageSize);
  const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId) ?? null;

  return (
    <section className="stickney-panel department-documents" data-grouped-box-cards="active">
      <div className="stickney-source-notice"><b>{sourceName} source - protected overlays</b><span>The original records and source documents in {sourceSystem} remain in place. Authorized edits save as department overlays and never delete or rewrite the source.</span></div>
      <div className="stickney-section-head"><div><span>DOCUMENTS</span><h2>Policies and grouped Box Cards</h2></div><b>{boxCards.length + policies.length}</b></div>
      <div className="document-view-tabs" role="tablist" aria-label="Document libraries"><button type="button" role="tab" aria-selected={view === "box-cards"} className={view === "box-cards" ? "active" : ""} onClick={() => setView("box-cards")}>Box Cards <b>{boxCards.length}</b></button><button type="button" role="tab" aria-selected={view === "policies"} className={view === "policies" ? "active" : ""} onClick={() => setView("policies")}>Policies <b>{policies.length}</b></button></div>

      {view === "box-cards" ? <div className="department-box-library" role="tabpanel">
        <div className="box-group-toolbar"><div><span>TOWN / RESPONSE GROUP</span><h3>{activeGroup}</h3></div><label><span>Find a Box Card</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Box, area, address, or assignment"/></label></div>
        <div className="box-group-tabs" role="tablist" aria-label="Box Card groups by town">{groups.map((group) => <button type="button" role="tab" aria-selected={group === activeGroup} className={group === activeGroup ? "active" : ""} key={group} onClick={() => { setActiveGroup(group); setSearch(""); setSelectedCardId(""); }}><span>{group}</span><b>{boxCards.filter((card) => (card.department || "Unassigned") === group).length}</b></button>)}</div>
        {visibleCards.length ? <div className="department-box-grid">{visibleCards.map((card) => { const source = safeDocumentHref(card.document_url); const rowCount = normalizeRows(card.alarm_rows, card.department?.toLowerCase() === "stickney").length; return <article key={card.id}><header><div><span>{card.department || "Unassigned"}</span><h4>Box {card.box_number || "Not entered"}</h4><p>{card.title}</p></div><b>{card.status}</b></header><dl><div><dt>Address / area</dt><dd>{card.address || "Not entered"}</dd></div><div><dt>Alarm rows</dt><dd>{rowCount} editable level{rowCount === 1 ? "" : "s"}</dd></div></dl><div className="department-box-actions"><button type="button" className="primary" onClick={() => setSelectedCardId(card.id)}>{editable ? "Open admin editor" : "Open Box Card"}</button>{source ? <a href={source} target="_blank" rel="noreferrer">Open original{card.document_page ? ` - page ${card.document_page}` : ""}</a> : <em>Original file not linked</em>}<button type="button" onClick={() => downloadJson(card)}>Download editable</button><button type="button" onClick={() => printCard(card)}>Print / Save PDF</button></div></article>; })}</div> : <div className="stickney-empty"><b>No matching Box Cards</b><span>Choose another town or clear the search.</span></div>}
        {selectedCard ? <div className="department-box-overlay" role="presentation" onClick={(event) => { if (event.currentTarget === event.target) setSelectedCardId(""); }}><BoxCardEditor key={selectedCard.id} departmentId={departmentId} card={selectedCard} editable={editable} supportSessionId={supportSessionId} groups={groups} onClose={() => setSelectedCardId("")}/></div> : null}
      </div> : <div className="department-policy-library" role="tabpanel">
        <div className="department-policy-toolbar"><div><span>POLICY LIBRARY</span><h3>Open one document at a time</h3><p>Search by title, policy number, category, or document text.</p></div><label><span>Find a policy, SOG, or SOP</span><input aria-label="Search policy documents" value={policySearch} onChange={(event) => { setPolicySearch(event.target.value); setPolicyPage(0); }} placeholder="Search documents"/></label></div>
        <div className="department-policy-categories" role="tablist" aria-label="Policy categories">{policyCategories.map((category) => { const count = category === "All" ? policies.length : policies.filter((policy) => (policy.category || "General") === category).length; return <button type="button" role="tab" aria-selected={category === policyCategory} className={category === policyCategory ? "active" : ""} key={category} onClick={() => { setPolicyCategory(category); setPolicyPage(0); }}><span>{category}</span><b>{count}</b></button>; })}</div>
        <div className="department-policy-results"><b>{filteredPolicies.length} document{filteredPolicies.length === 1 ? "" : "s"}</b><span>Page {visiblePolicyPage + 1} of {policyPageCount} - up to {policyPageSize} shown</span></div>
        <div className="department-policy-list">{visiblePolicies.length ? visiblePolicies.map((policy) => <button type="button" className="department-policy-row" key={policy.id} onClick={() => setSelectedPolicyId(policy.id)}><span className="department-policy-icon">DOC</span><span><b>{policy.title}</b><small>{[policy.policy_number, policy.category].filter(Boolean).join(" - ") || "General"}</small></span><span>{policy.effective_date ? `Effective ${policy.effective_date.slice(0, 10)}` : "Date not entered"}</span><strong>Open</strong></button>) : <div className="stickney-empty"><b>No matching policies</b><span>Choose another category or clear the search.</span></div>}</div>
        <div className="department-policy-pagination"><button type="button" disabled={visiblePolicyPage === 0} onClick={() => setPolicyPage((current) => Math.max(0, current - 1))}>Previous</button><span>{visiblePolicyPage * policyPageSize + (visiblePolicies.length ? 1 : 0)}-{Math.min((visiblePolicyPage + 1) * policyPageSize, filteredPolicies.length)} of {filteredPolicies.length}</span><button type="button" disabled={visiblePolicyPage >= policyPageCount - 1} onClick={() => setPolicyPage((current) => Math.min(policyPageCount - 1, current + 1))}>Next</button></div>
        <div className="document-publish-boundary"><b>No scroll-of-death</b><span>The library shows a controlled result page. Full policy text opens in a focused reader.</span></div>
        {selectedPolicy ? <div className="department-policy-overlay" role="presentation" onClick={(event) => { if (event.currentTarget === event.target) setSelectedPolicyId(""); }}><section className="department-policy-reader" role="dialog" aria-modal="true" aria-labelledby="department-policy-title"><header><div><span>{[selectedPolicy.policy_number, selectedPolicy.category].filter(Boolean).join(" - ") || "Policy document"}</span><h2 id="department-policy-title">{selectedPolicy.title}</h2><p>{selectedPolicy.effective_date ? `Effective ${selectedPolicy.effective_date.slice(0, 10)}` : "Effective date not entered"}</p></div><button type="button" onClick={() => setSelectedPolicyId("")}>Close</button></header><div className="department-policy-body"><article>{selectedPolicy.body || "No policy body was imported."}</article>{editable ? <EditableRecord departmentId={departmentId} recordType="policy" recordId={selectedPolicy.id} editable={editable} supportSessionId={supportSessionId} fields={[{ name: "title", label: "Title", value: selectedPolicy.title }, { name: "policy_number", label: "Policy number", value: selectedPolicy.policy_number }, { name: "category", label: "Category", value: selectedPolicy.category }, { name: "effective_date", label: "Effective date", value: selectedPolicy.effective_date }, { name: "body", label: "Policy body", value: selectedPolicy.body, multiline: true }]}/> : null}</div><footer><span>{editable ? "Authorized admin editor available below the document." : "View-only policy document."}</span><button type="button" onClick={() => printPolicy(selectedPolicy)}>Print / Save PDF</button></footer></section></div> : null}
      </div>}
      <div className="document-publish-boundary"><b>{editable ? "Authorized admin editing enabled" : "View-only department access"}</b><span>Every Box Card must be checked against its original document before operational use.</span></div>
    </section>
  );
}
