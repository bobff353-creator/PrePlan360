"use client";

import { useEffect, useState } from "react";

type CadNote = { id: string; at: string; text: string; author: string };
type DailyCall = { id: string; reportNumber: string; address: string; notes: CadNote[] };

function noteTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "----";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replaceAll(":", "");
}

export default function RespondCadNotes({ departmentId, address, fallback }: { departmentId: string; address: string; fallback: string }) {
  const [calls, setCalls] = useState<DailyCall[]>([]);
  const [checked, setChecked] = useState(false);
  const [loadedAddress, setLoadedAddress] = useState("");

  useEffect(() => {
    if (!address) return;
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(`/api/departments/${departmentId}/daily-log?address=${encodeURIComponent(address)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Daily Log notes unavailable");
        const payload = await response.json() as { calls?: DailyCall[] };
        if (active) {
          setCalls(Array.isArray(payload.calls) ? payload.calls : []);
          setLoadedAddress(address);
        }
      } catch {
        if (active) {
          setCalls([]);
          setLoadedAddress(address);
        }
      } finally {
        if (active) setChecked(true);
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [address, departmentId]);

  const notes = address && loadedAddress === address ? calls.flatMap((call) => (Array.isArray(call.notes) ? call.notes : []).map((note) => ({ ...note, callId: call.id, reportNumber: call.reportNumber }))).sort((a, b) => a.at.localeCompare(b.at)).slice(-5) : [];
  const lookupFinished = !address || (checked && loadedAddress === address);
  return <article aria-live="polite"><div className="respond-context-label"><span>Current CAD notes</span><b>{notes.length ? `${notes.length} Daily Log update${notes.length === 1 ? "" : "s"}` : lookupFinished ? "Checks every 5s" : "Checking Daily Log"}</b></div>{notes.length ? <div className="respond-live-cad-notes">{notes.map((note) => <div key={`${note.callId}-${note.id}`}><time>{noteTime(note.at)}</time><span><b>{note.text}</b><small>{note.author || note.reportNumber || "Department user"}</small></span></div>)}</div> : <p>{fallback}</p>}</article>;
}
