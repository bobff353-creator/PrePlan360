"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps libraries are loaded from the department's restricted browser key. */
import { useState } from "react";

type GoogleMapConfig = { configured: boolean; browserKey: string; mapId: string; streetViewEnabled: boolean; routesEnabled: boolean };
type GoogleWindow = Window & { google?: any; __departmentGooglePromise?: Promise<void> };

function loadGoogle(config: GoogleMapConfig) {
  const target = window as GoogleWindow;
  if (target.google?.maps) return Promise.resolve();
  if (target.__departmentGooglePromise) return target.__departmentGooglePromise;
  target.__departmentGooglePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({ key: config.browserKey, v: "weekly", loading: "async", auth_referrer_policy: "origin" });
    if (config.mapId) params.set("map_ids", config.mapId);
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps JavaScript API did not load."));
    document.head.append(script);
  });
  return target.__departmentGooglePromise;
}

function coordinates(value: string) {
  const [lat, lng] = value.split(",").map((item) => Number(item.trim()));
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function GoogleIntegrationTest({ departmentId, departmentSlug, weatherLocation }: { departmentId: string; departmentSlug: string; weatherLocation: string }) {
  const [state, setState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [message, setMessage] = useState("Run this from the production domain after saving a restricted browser key.");

  async function run() {
    setState("testing");
    setMessage("Loading Google Maps and checking the enabled services…");
    try {
      const response = await fetch(`/api/map-config?department=${encodeURIComponent(departmentSlug)}`, { cache: "no-store" });
      const config = await response.json() as GoogleMapConfig;
      if (!config.configured || !config.browserKey) throw new Error("Save and enable a Google Maps browser key first.");
      const center = coordinates(weatherLocation);
      if (!center) throw new Error("Save verified latitude and longitude in Department identity first.");
      await loadGoogle(config);
      const google = (window as GoogleWindow).google;
      await google.maps.importLibrary("maps");
      let streetViewOk = !config.streetViewEnabled;
      let routesOk = !config.routesEnabled;
      if (config.streetViewEnabled) {
        const { StreetViewService } = await google.maps.importLibrary("streetView");
        try {
          await new StreetViewService().getPanorama({ location: center, radius: 1000, preference: "nearest" });
          streetViewOk = true;
        } catch (error) {
          const status = String((error as { code?: string })?.code || error);
          if (status.includes("ZERO_RESULTS")) streetViewOk = true;
          else throw error;
        }
      }
      if (config.routesEnabled) {
        const { Route } = await google.maps.importLibrary("routes");
        const result = await Route.computeRoutes({ origin: center, destination: { lat: center.lat + 0.003, lng: center.lng + 0.003 }, travelMode: "DRIVING", fields: ["distanceMeters", "durationMillis"] });
        routesOk = Array.isArray(result.routes);
      }
      const verified = await fetch(`/api/departments/${encodeURIComponent(departmentId)}/integrations/google-verified`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maps: true, streetView: streetViewOk, routes: routesOk }),
      });
      if (!verified.ok) throw new Error(await verified.text() || "Verification could not be saved.");
      setState("ok");
      setMessage(`Verified: Maps${config.streetViewEnabled ? ", Street View" : ""}${config.routesEnabled ? ", Routes" : ""}.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Google verification failed.");
    }
  }

  return <div className={`integration-browser-test ${state}`}><button type="button" onClick={run} disabled={state === "testing"}>{state === "testing" ? "Testing Google services…" : "Verify Google in this browser"}</button><span aria-live="polite">{message}</span></div>;
}

export function GeneratedSecretField({ name, label, saved }: { name: string; label: string; saved: boolean }) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  function generate() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const generated = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    setValue(generated);
    setVisible(true);
    void navigator.clipboard?.writeText(generated);
  }
  return <label className="wide integration-secret-field">{label}<span><input name={name} type={visible ? "text" : "password"} autoComplete="new-password" value={value} onChange={(event) => setValue(event.target.value)} placeholder={saved ? "Saved securely — leave blank to keep" : "Enter or generate a signing secret"}/><button type="button" onClick={generate}>Generate + copy</button><button type="button" onClick={() => setVisible((current) => !current)}>{visible ? "Hide" : "Show"}</button></span><small>Copy a generated secret into the provider or department server before saving. It is encrypted and will not be shown again.</small></label>;
}
