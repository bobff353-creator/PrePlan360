"use client";

import { useState } from "react";
import type { DepartmentModuleItem } from "@/db/access";

type CallNote = { id: string; at: string; text: string; author: string };
type DailyLogCall = {
  id: string;
  workDate: string;
  reportNumber: string;
  timeOut: string;
  timeIn: string;
  unitIds: string[];
  address: string;
  preplanId: string;
  type: string;
  notes: CallNote[];
  createdAt: string;
  updatedAt: string;
};

type PreplanOption = { id: string; name: string; address: string };
type UnitOption = { id: string; label: string };

const callTypes = ["Fire", "EMS", "MVA", "HazMat", "Mutual Aid", "Structure Fire", "Special"];

function normalizeAddress(value: string) {
  return value.toLowerCase().replace(/\b(street)\b/g, "st").replace(/\b(avenue)\b/g, "ave").replace(/\b(road)\b/g, "rd").replace(/\b(drive)\b/g, "dr").replace(/\b(boulevard)\b/g, "blvd").replace(/[^a-z0-9]+/g, " ").trim();
}

function parseItems(items: DepartmentModuleItem[]): DailyLogCall[] {
  return items.flatMap((item) => {
    try {
      const value = JSON.parse(item.summary) as Partial<DailyLogCall>;
      if (!value || typeof value !== "object") return [];
      return [{
        id: item.id,
        workDate: String(value.workDate || ""),
        reportNumber: String(value.reportNumber || ""),
        timeOut: String(value.timeOut || ""),
        timeIn: String(value.timeIn || ""),
        unitIds: Array.isArray(value.unitIds) ? value.unitIds.map(String) : [],
        address: String(value.address || item.location || ""),
        preplanId: String(value.preplanId || ""),
        type: callTypes.includes(String(value.type)) ? String(value.type) : "EMS",
        notes: Array.isArray(value.notes) ? value.notes as CallNote[] : [],
        createdAt: String(value.createdAt || item.updated_at),
        updatedAt: String(value.updatedAt || item.updated_at),
      } satisfies DailyLogCall];
    } catch {
      return [];
    }
  });
}

function noteTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "----";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replaceAll(":", "");
}

export default function DailyLogWorkspace({ departmentId, departmentName, initialDate, initialItems, preplans, units, editable, supportSessionId }: { departmentId: string; departmentName: string; initialDate: string; initialItems: DepartmentModuleItem[]; preplans: PreplanOption[]; units: UnitOption[]; editable: boolean; supportSessionId: string }) {
  const [calls, setCalls] = useState<DailyLogCall[]>(() => parseItems(initialItems));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [openNotesId, setOpenNotesId] = useState("");
  const [openAddressId, setOpenAddressId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const visibleCalls = calls.filter((call) => call.workDate === selectedDate);

  async function send(body: Record<string, unknown>) {
    const response = await fetch(`/api/departments/${departmentId}/daily-log`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, supportSessionId }),
    });
    if (!response.ok) throw new Error((await response.text()) || "Daily Log update failed");
    return response.json() as Promise<{ call?: DailyLogCall; archived?: boolean }>;
  }

  async function addCall() {
    if (!editable) return;
    setSavingId("new");
    setMessage("");
    try {
      const result = await send({ action: "save", call: { workDate: selectedDate, reportNumber: "", timeOut: "", timeIn: "", unitIds: [], address: "", preplanId: "", type: "EMS" } });
      if (result.call) setCalls((current) => [result.call!, ...current]);
      setMessage("Call record added");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Daily Log update failed");
    } finally {
      setSavingId("");
    }
  }

  function patchLocal(callId: string, patch: Partial<DailyLogCall>) {
    setCalls((current) => current.map((call) => call.id === callId ? { ...call, ...patch } : call));
  }

  async function persist(call: DailyLogCall, patch: Partial<DailyLogCall>) {
    if (!editable) return;
    const next = { ...call, ...patch };
    patchLocal(call.id, patch);
    setSavingId(call.id);
    setMessage("");
    try {
      const result = await send({ action: "save", callId: call.id, call: next });
      if (result.call) patchLocal(call.id, result.call);
      setMessage("Daily Log saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Daily Log update failed");
    } finally {
      setSavingId("");
    }
  }

  async function addNote(call: DailyLogCall) {
    const text = String(noteDrafts[call.id] || "").trim();
    if (!editable || !text) return;
    setSavingId(call.id);
    setMessage("");
    try {
      const result = await send({ action: "note", callId: call.id, text });
      if (result.call) patchLocal(call.id, result.call);
      setNoteDrafts((current) => ({ ...current, [call.id]: "" }));
      setOpenNotesId(call.id);
      setMessage("Timestamped note shared with Respond");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Call note failed");
    } finally {
      setSavingId("");
    }
  }

  async function archiveCall(call: DailyLogCall) {
    if (!editable || !window.confirm("Archive this call record? It will be retained in history and removed from the active Daily Log.")) return;
    setSavingId(call.id);
    setMessage("");
    try {
      await send({ action: "archive", callId: call.id });
      setCalls((current) => current.filter((item) => item.id !== call.id));
      setMessage("Call archived and retained in history");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Call archive failed");
    } finally {
      setSavingId("");
    }
  }

  return <section className="department-daily-log">
    <header className="department-daily-log-head"><div><span>OPERATIONAL RECORD</span><h2>Calls &amp; Responses</h2><p>Saved department calls, preplan-aware addresses, apparatus assignments, and timestamped incident notes.</p></div><div className="department-daily-log-actions"><label>Log date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}/></label>{editable ? <button type="button" onClick={addCall} disabled={savingId === "new"}>+ Add call</button> : null}</div></header>
    <div className="department-daily-log-truth"><span><i/><b>{departmentName} saved Daily Log</b><small>Notes are stored with this department and appear in Respond for the same incident address.</small></span><em>{message || `${visibleCalls.length} response record${visibleCalls.length === 1 ? "" : "s"}`}</em></div>
    {visibleCalls.length ? <div className="department-daily-call-list">{visibleCalls.map((call, index) => {
      const query = normalizeAddress(call.address);
      const addressOptions = [
        ...preplans.map((preplan) => ({ ...preplan, kind: "Preplan" })),
        ...calls.filter((item) => item.address).map((item) => ({ id: `saved-${item.id}`, name: item.reportNumber ? `Prior call ${item.reportNumber}` : "Prior Daily Log address", address: item.address, kind: "Saved address" })),
      ].filter((option, optionIndex, all) => all.findIndex((candidate) => normalizeAddress(candidate.address) === normalizeAddress(option.address)) === optionIndex);
      const addressMatches = addressOptions.filter((option) => !query || normalizeAddress(option.address).includes(query) || normalizeAddress(option.name).includes(query)).slice(0, 6);
      const exactPreplan = preplans.find((preplan) => preplan.id === call.preplanId || (query && normalizeAddress(preplan.address) === query));
      return <article className="department-daily-call" key={call.id}>
        <header><div><span>#{index + 1}</span><b>{call.reportNumber || `${call.type} response`}</b>{savingId === call.id ? <small>Saving…</small> : null}</div>{editable ? <button type="button" onClick={() => archiveCall(call)}>Archive</button> : null}</header>
        <div className="department-daily-call-fields">
          <label><span>Report</span><input disabled={!editable} value={call.reportNumber} onChange={(event) => patchLocal(call.id, { reportNumber: event.target.value })} onBlur={() => persist(call, { reportNumber: call.reportNumber })}/></label>
          <label><span>Out</span><input disabled={!editable} inputMode="numeric" maxLength={4} value={call.timeOut} onChange={(event) => patchLocal(call.id, { timeOut: event.target.value.replace(/\D/g, "").slice(0, 4) })} onBlur={() => persist(call, { timeOut: call.timeOut })}/></label>
          <label><span>In</span><input disabled={!editable} inputMode="numeric" maxLength={4} value={call.timeIn} onChange={(event) => patchLocal(call.id, { timeIn: event.target.value.replace(/\D/g, "").slice(0, 4) })} onBlur={() => persist(call, { timeIn: call.timeIn })}/></label>
          <label><span>Type</span><select disabled={!editable} value={call.type} onChange={(event) => persist(call, { type: event.target.value })}>{callTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="department-call-address"><span>Address</span><div><input autoComplete="off" disabled={!editable} value={call.address} onFocus={() => setOpenAddressId(call.id)} onChange={(event) => { patchLocal(call.id, { address: event.target.value, preplanId: "" }); setOpenAddressId(call.id); }} onBlur={() => { window.setTimeout(() => setOpenAddressId((current) => current === call.id ? "" : current), 120); persist(call, { address: call.address, preplanId: call.preplanId }); }}/>{openAddressId === call.id ? <div className="department-address-suggestions">{addressMatches.length ? addressMatches.map((option) => <button type="button" key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpenAddressId(""); persist(call, { address: option.address, preplanId: option.kind === "Preplan" ? option.id : "" }); }}><span><b>{option.address}</b><small>{option.name}</small></span><em>{option.kind}</em></button>) : <small>Keep typing or use this address.</small>}</div> : null}</div><small className={exactPreplan ? "matched" : ""}>{exactPreplan ? `Preplan · ${exactPreplan.name}` : "Type to search saved preplans and prior addresses"}</small></label>
          <div className="department-call-units"><span>Responding units</span><details><summary><span>{call.unitIds.length ? call.unitIds.map((unit) => <b key={unit}>{unit}</b>) : <small>Select units</small>}</span><em>{call.unitIds.length} selected</em></summary><div>{units.length ? units.map((unit) => { const controlId = `daily-call-${call.id}-unit-${unit.id}`; return <label key={unit.id} htmlFor={controlId}><input id={controlId} aria-label={`Select ${unit.id} ${unit.label}`} type="checkbox" disabled={!editable} checked={call.unitIds.includes(unit.id)} onChange={(event) => { const next = event.target.checked ? [...new Set([...call.unitIds, unit.id])] : call.unitIds.filter((id) => id !== unit.id); persist(call, { unitIds: next }); }}/><span><b>{unit.id}</b><small>{unit.label}</small></span></label>; }) : <small>No department apparatus is available.</small>}</div></details></div>
          <button className={openNotesId === call.id ? "department-call-note-button active" : "department-call-note-button"} type="button" onClick={() => setOpenNotesId((current) => current === call.id ? "" : call.id)}><span>+</span><small>Notes</small><b>{call.notes.length}</b></button>
        </div>
        {openNotesId === call.id ? <div className="department-call-notepad"><header><div><span>LIVE CALL NOTES</span><b>{call.reportNumber || call.address || "Unnumbered response"}</b></div><em>Respond checks for updates every 5 seconds</em></header><div className="department-call-note-stream">{call.notes.length ? call.notes.map((note) => <div key={note.id}><time>{noteTime(note.at)}</time><p>{note.text}</p><small>{note.author || "Department user"}</small></div>) : <p>No timestamped notes yet.</p>}</div>{editable ? <div className="department-call-note-compose"><textarea rows={3} maxLength={1000} placeholder="Add a factual incident update…" value={noteDrafts[call.id] || ""} onChange={(event) => setNoteDrafts((current) => ({ ...current, [call.id]: event.target.value }))}/><button type="button" disabled={savingId === call.id || !String(noteDrafts[call.id] || "").trim()} onClick={() => addNote(call)}>Add timestamped note</button></div> : null}</div> : null}
      </article>;
    })}</div> : <div className="department-daily-log-empty"><b>No calls recorded for this operational date.</b><span>{editable ? "Add a call to start the department record." : "An authorized Daily Log editor can add the first response."}</span></div>}
  </section>;
}
