"use client";

import { useMemo, useState, type ReactNode } from "react";

export type PreplanDetailRecord = {
  name: string;
  address: string;
  status: string;
  sourceLabel: string;
  construction: string;
  floors: string;
  fireFlowGpm: number | null;
  access: string;
  alarm: string;
  sprinkler: string;
  fdc: string;
  knox: string;
  riser: string;
  summary: string;
  contact: string;
  internalNotes: string;
  latitude: number | null;
  longitude: number | null;
  footprintCount: number;
  lastReviewed: string;
  visibility: string;
  updatedAt: string;
};

export type PreplanDetailHydrant = {
  name: string;
  location: string;
  status: string;
  flowGpm: number | null;
};

const tabs = ["Command Summary", "Tactical Map", "Detailed Systems", "Fire Flow", "Water Supply", "Photos + Documents", "Review + Publish", "Responder Brief"] as const;
type Tab = typeof tabs[number];

function Fact({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><b>{value || "Not entered"}</b></div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="preplan-detail-empty">{children}</div>;
}

function formatDate(value: string) {
  if (!value) return "Not recorded";
  const calendarDate = /^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(0, 10)}T12:00:00Z` : value;
  const date = new Date(calendarDate);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

function readiness(record: PreplanDetailRecord, hydrants: PreplanDetailHydrant[]) {
  const checks = [
    { label: "Location and footprint", ready: Boolean(record.latitude != null && record.longitude != null), detail: record.footprintCount >= 3 ? `${record.footprintCount} verified corners` : record.latitude != null && record.longitude != null ? "Location saved; footprint not mapped" : "Coordinates not entered" },
    { label: "Building profile", ready: Boolean(record.construction || record.floors), detail: [record.construction, record.floors ? `${record.floors} floor${record.floors === "1" ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Not entered" },
    { label: "Tactical summary", ready: Boolean(record.summary || record.access || record.internalNotes), detail: record.summary || record.access || record.internalNotes || "Not entered" },
    { label: "Fire protection systems", ready: Boolean(record.alarm || record.sprinkler || record.fdc || record.riser), detail: [record.alarm, record.sprinkler, record.fdc, record.riser].filter(Boolean).join(" · ") || "Not entered" },
    { label: "Water supply", ready: Boolean(record.fireFlowGpm || hydrants.length), detail: record.fireFlowGpm ? `${record.fireFlowGpm.toLocaleString()} GPM fire-flow record` : hydrants.length ? `${hydrants.length} connected hydrant record${hydrants.length === 1 ? "" : "s"}` : "Not entered" },
  ];
  return { checks, percent: Math.round((checks.filter((check) => check.ready).length / checks.length) * 100) };
}

export default function PreplanDetail({ record, hydrants, editable, shared = false }: { record: PreplanDetailRecord; hydrants: PreplanDetailHydrant[]; editable: boolean; shared?: boolean }) {
  const [active, setActive] = useState<Tab>("Command Summary");
  const ready = useMemo(() => readiness(record, hydrants), [record, hydrants]);
  const brief = [
    record.construction && `Construction: ${record.construction}${record.floors ? ` / ${record.floors} floor${record.floors === "1" ? "" : "s"}` : ""}`,
    record.access && `Access: ${record.access}`,
    record.knox && `Knox: ${record.knox}`,
    record.fdc && `FDC: ${record.fdc}`,
    record.sprinkler && `Sprinkler: ${record.sprinkler}`,
    record.riser && `Riser: ${record.riser}`,
    record.contact && `Contact: ${record.contact}`,
    record.fireFlowGpm && `Suggested fire flow: ${record.fireFlowGpm.toLocaleString()} GPM`,
  ].filter(Boolean) as string[];

  return <div className="department-preplan-workspace">
    <header className="department-preplan-hero">
      <div><div className="department-preplan-labels"><span>{record.status || "Preplan"}</span><span>{shared ? "Mutual-aid view only" : record.sourceLabel}</span></div><h3>{record.name}</h3><p>{record.address || "Address not entered"}{record.updatedAt ? ` · updated ${formatDate(record.updatedAt)}` : ""}</p></div>
      <div className="department-preplan-score"><b>{ready.percent}%</b><span>ready</span></div>
    </header>
    <div className="department-preplan-readiness">{ready.checks.map((check) => <article className={check.ready ? "ready" : "missing"} key={check.label}><b>{check.ready ? "Ready" : "Needs work"}</b><span>{check.label}</span><small>{check.detail}</small></article>)}</div>
    <div className="department-preplan-tabs" aria-label={`${record.name} preplan sections`} role="tablist">{tabs.map((tab) => <button type="button" role="tab" aria-selected={active === tab} className={active === tab ? "active" : ""} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}</div>
    <section className="department-preplan-tabbody" role="tabpanel">
      {active === "Command Summary" ? <div className="department-preplan-split"><article><span>COMMAND SUMMARY</span><h4>Operational record</h4>{record.summary ? <p>{record.summary}</p> : <Empty>No command summary has been entered for this property.</Empty>}{record.internalNotes && !shared ? <div className="department-preplan-private"><b>Department internal notes</b><p>{record.internalNotes}</p></div> : null}</article><article><span>RESPONSE SNAPSHOT</span><h4>Known facts</h4><dl className="department-preplan-facts"><Fact label="Construction" value={record.construction}/><Fact label="Floors" value={record.floors}/><Fact label="Access" value={record.access}/><Fact label="Knox" value={record.knox}/><Fact label="Contact" value={record.contact}/></dl></article></div> : null}
      {active === "Tactical Map" ? <div className="department-preplan-split"><article><span>PROPERTY LOCATION</span><h4>Verified map record</h4><dl className="department-preplan-facts"><Fact label="Latitude" value={record.latitude == null ? "Not entered" : String(record.latitude)}/><Fact label="Longitude" value={record.longitude == null ? "Not entered" : String(record.longitude)}/><Fact label="Building footprint" value={record.footprintCount >= 3 ? `${record.footprintCount} verified corners` : "Not mapped"}/></dl>{record.latitude != null && record.longitude != null ? <a className="department-preplan-maplink" href="#preplan-map">Open on buildings and hydrants map</a> : null}</article><article><span>TACTICAL MAP</span><h4>Department record status</h4><Empty>{record.footprintCount >= 3 ? "The saved footprint is highlighted on the department map above." : "Add at least three verified footprint corners to outline this building on the department map."}</Empty></article></div> : null}
      {active === "Detailed Systems" ? <div className="department-preplan-system-grid"><Fact label="Alarm system" value={record.alarm}/><Fact label="Sprinkler system" value={record.sprinkler}/><Fact label="FDC" value={record.fdc}/><Fact label="Riser / standpipe" value={record.riser}/><Fact label="Knox / access" value={record.knox || record.access}/><Fact label="Construction" value={record.construction}/></div> : null}
      {active === "Fire Flow" ? <article className="department-preplan-focus"><span>FIRE FLOW</span><h4>{record.fireFlowGpm ? `${record.fireFlowGpm.toLocaleString()} GPM` : "Not calculated"}</h4><p>{record.fireFlowGpm ? "This value comes from the saved department/source preplan record. Confirm current field conditions before operational use." : "No fire-flow result is stored on this preplan. The interface does not invent one."}</p></article> : null}
      {active === "Water Supply" ? <article className="department-preplan-focus"><span>ASSOCIATED HYDRANTS</span><h4>{hydrants.length ? `${hydrants.length} nearby record${hydrants.length === 1 ? "" : "s"}` : "None connected"}</h4>{hydrants.length ? <div className="department-preplan-hydrants">{hydrants.map((hydrant) => <div key={`${hydrant.name}-${hydrant.location}`}><b>{hydrant.name}</b><span>{hydrant.location || "Location not entered"}</span><small>{hydrant.flowGpm == null ? hydrant.status || "Flow not recorded" : `${hydrant.flowGpm.toLocaleString()} GPM · ${hydrant.status || "status not entered"}`}</small></div>)}</div> : <Empty>No mapped hydrant records could be associated with this building.</Empty>}</article> : null}
      {active === "Photos + Documents" ? <article className="department-preplan-focus"><span>PROPERTY FILES</span><h4>No attached files in this record</h4><p>Photos and documents appear here only after this department connects or uploads them. Nothing fictional is substituted.</p></article> : null}
      {active === "Review + Publish" ? <div className="department-preplan-system-grid"><Fact label="Record status" value={record.status}/><Fact label="Last reviewed" value={formatDate(record.lastReviewed)}/><Fact label="Visibility" value={shared ? "Mutual-aid view only" : record.visibility || "Department only"}/><Fact label="Editing" value={shared ? "Locked to source department" : editable ? "Authorized admin controls below" : "Read only for this account"}/></div> : null}
      {active === "Responder Brief" ? <article className="department-preplan-focus"><span>RESPONDER BRIEF</span><h4>{record.name}</h4>{record.summary ? <p>{record.summary}</p> : null}{brief.length ? <ul>{brief.map((item) => <li key={item}>{item}</li>)}</ul> : <Empty>No responder-brief facts have been entered.</Empty>}</article> : null}
    </section>
  </div>;
}
