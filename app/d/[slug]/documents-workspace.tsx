"use client";

import { useMemo, useState } from "react";
import type { StickneyBoxCard, StickneyPolicy } from "@/db/stickney";

type Props = {
  departmentId: string;
  boxCards: StickneyBoxCard[];
  policies: StickneyPolicy[];
  editable: boolean;
  supportSessionId: string;
};

type EditableField = {
  name: string;
  label: string;
  value: string | number | null | undefined;
  multiline?: boolean;
};

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

function downloadEditable(card: StickneyBoxCard) {
  const content = JSON.stringify(
    {
      group: card.department || "Unassigned",
      box: card.box_number,
      title: card.title,
      address: card.address,
      access_notes: card.access_notes,
      response_assignments_and_details: card.details,
      source_document: card.document_url || null,
      source_page: card.document_page || null,
      status: card.status,
    },
    null,
    2,
  );
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename(`${card.department}-box-${card.box_number || card.title}`)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printCard(card: StickneyBoxCard) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return;
  const source = safeDocumentHref(card.document_url);
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(card.title)}</title><style>body{font:14px Arial,sans-serif;margin:24px;color:#111}header{border-bottom:3px solid #111;margin-bottom:20px}h1{margin:4px 0}dl{display:grid;grid-template-columns:160px 1fr;border:1px solid #999}dt,dd{margin:0;padding:10px;border-bottom:1px solid #ccc}dt{font-weight:700;background:#eee}pre{white-space:pre-wrap;font:13px Arial,sans-serif}footer{margin-top:24px;font-size:11px;color:#555}@media print{body{margin:10mm}}</style></head><body><header><b>${escapeHtml(card.department || "Unassigned")}</b><h1>Box ${escapeHtml(card.box_number || "Not entered")}</h1><p>${escapeHtml(card.title)}</p></header><dl><dt>Address / area</dt><dd>${escapeHtml(card.address || "Not entered")}</dd><dt>Access notes</dt><dd>${escapeHtml(card.access_notes || "None entered")}</dd><dt>Assignments / details</dt><dd><pre>${escapeHtml(card.details || "Not entered")}</pre></dd><dt>Original source</dt><dd>${source ? escapeHtml(source) : "Not linked"}${card.document_page ? ` · page ${card.document_page}` : ""}</dd></dl><footer>PrePlan 360 editable Box Card export · verify every assignment against the original source before operational use.</footer><script>window.onload=function(){window.print()}</script></body></html>`);
  popup.document.close();
}

function printPolicy(policy: StickneyPolicy) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(policy.title)}</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 24px;color:#111}header{border-bottom:3px solid #111}h1{margin:5px 0}article{white-space:pre-wrap;line-height:1.65;margin-top:24px}footer{border-top:1px solid #aaa;margin-top:28px;padding-top:10px;font-size:11px;color:#555}</style></head><body><header><b>${escapeHtml(policy.category || "General")}</b><h1>${escapeHtml(policy.title)}</h1><p>${escapeHtml(policy.policy_number || "Policy number not entered")} · ${policy.effective_date ? `Effective ${escapeHtml(policy.effective_date.slice(0, 10))}` : "Effective date not entered"}</p></header><article>${escapeHtml(policy.body || "No policy body was imported.")}</article><footer>PrePlan 360 policy copy · verify against the department-adopted source.</footer><script>window.onload=function(){window.print()}</script></body></html>`);
  popup.document.close();
}

function EditableRecord({ departmentId, recordType, recordId, fields, editable, supportSessionId }: { departmentId: string; recordType: "box_card" | "policy"; recordId: string; fields: EditableField[]; editable: boolean; supportSessionId: string }) {
  if (!editable) return null;
  return (
    <details className="stickney-record-editor document-admin-editor">
      <summary>Admin edit</summary>
      <form method="post" action={`/api/departments/${departmentId}/stickney-records`}>
        <input type="hidden" name="record_type" value={recordType} />
        <input type="hidden" name="record_id" value={recordId} />
        <input type="hidden" name="support_session_id" value={supportSessionId} />
        {fields.map((field) => (
          <label key={field.name}>
            {field.label}
            {field.multiline ? <textarea name={field.name} defaultValue={String(field.value ?? "")} rows={5} /> : <input name={field.name} defaultValue={String(field.value ?? "")} />}
          </label>
        ))}
        <button type="submit">Save verified change</button>
      </form>
    </details>
  );
}

export default function DocumentsWorkspace({ departmentId, boxCards, policies, editable, supportSessionId }: Props) {
  const groups = useMemo(() => Array.from(new Set(boxCards.map((card) => card.department || "Unassigned"))).sort((a, b) => a.localeCompare(b)), [boxCards]);
  const [view, setView] = useState<"box-cards" | "policies">("box-cards");
  const [activeGroup, setActiveGroup] = useState(groups[0] || "Unassigned");
  const [search, setSearch] = useState("");
  const [policySearch, setPolicySearch] = useState("");
  const [policyCategory, setPolicyCategory] = useState("All");
  const [policyPage, setPolicyPage] = useState(0);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const visibleCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return boxCards.filter((card) => (card.department || "Unassigned") === activeGroup && (!query || `${card.box_number} ${card.title} ${card.address} ${card.access_notes} ${card.details}`.toLowerCase().includes(query)));
  }, [activeGroup, boxCards, search]);
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
      <div className="stickney-source-notice">
        <b>Live Stickney source · protected overlays</b>
        <span>The original Firehouse Manager records and source documents remain in place. Authorized edits save as department overlays and never delete or rewrite the source.</span>
      </div>
      <div className="stickney-section-head">
        <div><span>DOCUMENTS</span><h2>Policies and grouped Box Cards</h2></div>
        <b>{boxCards.length + policies.length}</b>
      </div>

      <div className="document-view-tabs" role="tablist" aria-label="Document libraries">
        <button type="button" role="tab" aria-selected={view === "box-cards"} className={view === "box-cards" ? "active" : ""} onClick={() => setView("box-cards")}>Box Cards <b>{boxCards.length}</b></button>
        <button type="button" role="tab" aria-selected={view === "policies"} className={view === "policies" ? "active" : ""} onClick={() => setView("policies")}>Policies <b>{policies.length}</b></button>
      </div>

      {view === "box-cards" ? (
        <div className="department-box-library" role="tabpanel">
          <div className="box-group-toolbar">
            <div><span>TOWN / RESPONSE GROUP</span><h3>{activeGroup}</h3></div>
            <label><span>Find a Box Card</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Box, area, address, or assignment" /></label>
          </div>
          <div className="box-group-tabs" role="tablist" aria-label="Box Card groups by town">
            {groups.map((group) => (
              <button type="button" role="tab" aria-selected={group === activeGroup} className={group === activeGroup ? "active" : ""} key={group} onClick={() => { setActiveGroup(group); setSearch(""); }}>
                <span>{group}</span><b>{boxCards.filter((card) => (card.department || "Unassigned") === group).length}</b>
              </button>
            ))}
          </div>
          {visibleCards.length ? <div className="department-box-grid">{visibleCards.map((card) => {
            const source = safeDocumentHref(card.document_url);
            return (
              <article key={card.id}>
                <header><div><span>{card.department || "Unassigned"}</span><h4>Box {card.box_number || "Not entered"}</h4><p>{card.title}</p></div><b>{card.status}</b></header>
                <dl><div><dt>Address / area</dt><dd>{card.address || "Not entered"}</dd></div><div><dt>Access notes</dt><dd>{card.access_notes || "None entered"}</dd></div></dl>
                {card.details ? <details className="box-details"><summary>Response assignments and imported details</summary><pre>{card.details}</pre></details> : null}
                <div className="department-box-actions">
                  {source ? <a href={source} target="_blank" rel="noreferrer">Open original{card.document_page ? ` · page ${card.document_page}` : ""}</a> : <em>Original file not linked</em>}
                  {source ? <a href={source} download>Download original</a> : null}
                  <button type="button" onClick={() => downloadEditable(card)}>Download editable</button>
                  <button type="button" onClick={() => printCard(card)}>Print / Save PDF</button>
                </div>
                <EditableRecord departmentId={departmentId} recordType="box_card" recordId={card.id} editable={editable} supportSessionId={supportSessionId} fields={[
                  { name: "title", label: "Title", value: card.title },
                  { name: "address", label: "Address / area", value: card.address },
                  { name: "box_number", label: "Box number", value: card.box_number },
                  { name: "access_notes", label: "Access notes", value: card.access_notes, multiline: true },
                  { name: "details", label: "Response assignments / details", value: card.details, multiline: true },
                ]} />
              </article>
            );
          })}</div> : <div className="stickney-empty"><b>No matching Box Cards</b><span>Choose another town or clear the search.</span></div>}
        </div>
      ) : (
        <div className="department-policy-library" role="tabpanel">
          <div className="department-policy-toolbar">
            <div><span>POLICY LIBRARY</span><h3>Open one document at a time</h3><p>Search by title, policy number, category, or document text.</p></div>
            <label><span>Find a policy, SOG, or SOP</span><input aria-label="Search policy documents" value={policySearch} onChange={(event) => { setPolicySearch(event.target.value); setPolicyPage(0); }} placeholder="Search documents" /></label>
          </div>
          <div className="department-policy-categories" role="tablist" aria-label="Policy categories">
            {policyCategories.map((category) => {
              const count = category === "All" ? policies.length : policies.filter((policy) => (policy.category || "General") === category).length;
              return <button type="button" role="tab" aria-selected={category === policyCategory} className={category === policyCategory ? "active" : ""} key={category} onClick={() => { setPolicyCategory(category); setPolicyPage(0); }}><span>{category}</span><b>{count}</b></button>;
            })}
          </div>
          <div className="department-policy-results"><b>{filteredPolicies.length} document{filteredPolicies.length === 1 ? "" : "s"}</b><span>Page {visiblePolicyPage + 1} of {policyPageCount} · up to {policyPageSize} shown</span></div>
          <div className="department-policy-list">
            {visiblePolicies.length ? visiblePolicies.map((policy) => (
              <button type="button" className="department-policy-row" key={policy.id} onClick={() => setSelectedPolicyId(policy.id)}>
                <span className="department-policy-icon">DOC</span>
                <span><b>{policy.title}</b><small>{[policy.policy_number, policy.category].filter(Boolean).join(" · ") || "General"}</small></span>
                <span>{policy.effective_date ? `Effective ${policy.effective_date.slice(0, 10)}` : "Date not entered"}</span>
                <strong>Open →</strong>
              </button>
            )) : <div className="stickney-empty"><b>No matching policies</b><span>Choose another category or clear the search.</span></div>}
          </div>
          <div className="department-policy-pagination"><button type="button" disabled={visiblePolicyPage === 0} onClick={() => setPolicyPage((current) => Math.max(0, current - 1))}>← Previous</button><span>{visiblePolicyPage * policyPageSize + (visiblePolicies.length ? 1 : 0)}–{Math.min((visiblePolicyPage + 1) * policyPageSize, filteredPolicies.length)} of {filteredPolicies.length}</span><button type="button" disabled={visiblePolicyPage >= policyPageCount - 1} onClick={() => setPolicyPage((current) => Math.min(policyPageCount - 1, current + 1))}>Next →</button></div>
          <div className="document-publish-boundary"><b>No scroll-of-death</b><span>The library shows a controlled result page. Full policy text opens in a focused reader.</span></div>
          {selectedPolicy ? <div className="department-policy-overlay" role="presentation" onClick={(event) => { if (event.currentTarget === event.target) setSelectedPolicyId(""); }}><section className="department-policy-reader" role="dialog" aria-modal="true" aria-labelledby="department-policy-title"><header><div><span>{[selectedPolicy.policy_number, selectedPolicy.category].filter(Boolean).join(" · ") || "Policy document"}</span><h2 id="department-policy-title">{selectedPolicy.title}</h2><p>{selectedPolicy.effective_date ? `Effective ${selectedPolicy.effective_date.slice(0, 10)}` : "Effective date not entered"}</p></div><button type="button" onClick={() => setSelectedPolicyId("")}>Close</button></header><div className="department-policy-body"><article>{selectedPolicy.body || "No policy body was imported."}</article>{editable ? <EditableRecord departmentId={departmentId} recordType="policy" recordId={selectedPolicy.id} editable={editable} supportSessionId={supportSessionId} fields={[
            { name: "title", label: "Title", value: selectedPolicy.title },
            { name: "policy_number", label: "Policy number", value: selectedPolicy.policy_number },
            { name: "category", label: "Category", value: selectedPolicy.category },
            { name: "effective_date", label: "Effective date", value: selectedPolicy.effective_date },
            { name: "body", label: "Policy body", value: selectedPolicy.body, multiline: true },
          ]} /> : null}</div><footer><span>{editable ? "Authorized admin editor available below the document." : "View-only policy document."}</span><button type="button" onClick={() => printPolicy(selectedPolicy)}>Print / Save PDF</button></footer></section></div> : null}
        </div>
      )}
      <div className="document-publish-boundary"><b>{editable ? "Authorized admin editing enabled" : "View-only department access"}</b><span>Every Box Card must be checked against its original document before operational use.</span></div>
    </section>
  );
}
