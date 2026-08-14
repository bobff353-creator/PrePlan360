"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type IncidentPayload = { incident: null | { id: string; title: string; location: string; updatedAt: string } };

export default function StationIncidentMonitor({ departmentId, departmentSlug, currentModule, responseSeconds, supportSessionId }: { departmentId: string; departmentSlug: string; currentModule: string; responseSeconds: number; supportSessionId: string }) {
  const router = useRouter();
  const currentModuleRef = useRef(currentModule);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    currentModuleRef.current = currentModule;
  }, [currentModule]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer = 0;
    let returnTimer = 0;
    let countdownTimer = 0;
    const seenKey = `preplan360.stationDisplay.seenIncident.${departmentId}`;
    const untilKey = `preplan360.stationDisplay.respondUntil.${departmentId}`;
    const support = supportSessionId ? `&support=${encodeURIComponent(supportSessionId)}` : "";

    const returnToBoard = (delay: number) => {
      window.clearTimeout(returnTimer);
      returnTimer = window.setTimeout(() => {
        if (!cancelled && currentModuleRef.current === "respond") router.replace(`/d/${departmentSlug}?module=live-ops&station=1${support}`);
      }, Math.max(0, delay));
    };

    const updateCountdown = () => {
      const until = Number(sessionStorage.getItem(untilKey) || 0);
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (currentModuleRef.current === "respond" && until > Date.now()) returnToBoard(until - Date.now());
    };

    const poll = async () => {
      try {
        const response = await fetch(`/api/departments/${departmentId}/active-incident`, { cache: "no-store" });
        if (!response.ok) throw new Error("Incident watch unavailable");
        const payload = await response.json() as IncidentPayload;
        if (cancelled) return;
        const incident = payload.incident;
        if (!incident) {
          sessionStorage.removeItem(seenKey);
        } else if (sessionStorage.getItem(seenKey) !== incident.id) {
          const endsAt = Date.now() + Math.max(5, responseSeconds) * 1000;
          sessionStorage.setItem(seenKey, incident.id);
          sessionStorage.setItem(untilKey, String(endsAt));
          window.parent.postMessage({ type: "preplan360:station-incident", incidentId: incident.id, title: incident.title, endsAt }, window.location.origin);
          if (currentModuleRef.current !== "respond") router.replace(`/d/${departmentSlug}?module=respond&station=1${support}`);
          else returnToBoard(endsAt - Date.now());
          updateCountdown();
        }
      } catch {
        // Keep the last confirmed incident state through temporary network errors.
      } finally {
        if (!cancelled) pollTimer = window.setTimeout(poll, 5000);
      }
    };

    updateCountdown();
    countdownTimer = window.setInterval(updateCountdown, 1000);
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer);
      window.clearTimeout(returnTimer);
      window.clearInterval(countdownTimer);
    };
  }, [departmentId, departmentSlug, responseSeconds, router, supportSessionId]);

  return <div className="station-incident-monitor" role="status"><i />{currentModule === "respond" && secondsRemaining > 0 ? `Respond takeover · ${secondsRemaining}s` : "Incident watch · 5s"}</div>;
}
