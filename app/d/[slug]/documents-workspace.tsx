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
  const visibleCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return boxCards.filter((card) => (card.department || "Unassigned") === activeGroup && (!query || `${card.box_number} ${card.title} ${card.address} ${card.access_notes} ${card.details}`.toLowerCase().includes(query)));
  }, [activeGroup, boxCards, search]);

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
        <div className="department-policy-grid" role="tabpanel">
          {policies.map((policy) => (
            <details key={policy.id}>
              <summary><span>{[policy.policy_number, policy.category].filter(Boolean).join(" · ")}</span><b>{policy.title}</b></summary>
              <p>{policy.body || "No policy body was imported."}</p>
              <small>{policy.effective_date ? `Effective ${policy.effective_date.slice(0, 10)}` : "Effective date not entered"}</small>
              <EditableRecord departmentId={departmentId} recordType="policy" recordId={policy.id} editable={editable} supportSessionId={supportSessionId} fields={[
                { name: "title", label: "Title", value: policy.title },
                { name: "policy_number", label: "Policy number", value: policy.policy_number },
                { name: "category", label: "Category", value: policy.category },
                { name: "effective_date", label: "Effective date", value: policy.effective_date },
                { name: "body", label: "Policy body", value: policy.body, multiline: true },
              ]} />
            </details>
          ))}
        </div>
      )}
      <div className="document-publish-boundary"><b>{editable ? "Authorized admin editing enabled" : "View-only department access"}</b><span>Every Box Card must be checked against its original document before operational use.</span></div>
    </section>
  );
}
