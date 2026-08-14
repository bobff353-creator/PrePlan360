/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps is loaded at runtime without bundling its browser types. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MapPoint = { lat: number; lng: number };
export type MapPreplan = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  footprint: MapPoint[];
  targetId: string;
  sourceLabel?: string;
};
export type MapHydrant = {
  id: string;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  targetId?: string;
  href?: string;
};

type Props = {
  departmentId: string;
  departmentSlug: string;
  preplans: MapPreplan[];
  hydrants: MapHydrant[];
  editable: boolean;
};

type GoogleMapConfig = { configured: boolean; browserKey: string; mapId: string; streetViewEnabled: boolean; routesEnabled: boolean };
type GoogleWindow = Window & { google?: any; __preplanGoogleMapsPromise?: Promise<void> };

function finite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function loadGoogleMaps(config: GoogleMapConfig) {
  const target = window as GoogleWindow;
  if (target.google?.maps) return Promise.resolve();
  if (target.__preplanGoogleMapsPromise) return target.__preplanGoogleMapsPromise;
  target.__preplanGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({ key: config.browserKey, v: "weekly", loading: "async", auth_referrer_policy: "origin" });
    if (config.mapId) params.set("map_ids", config.mapId);
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps did not load."));
    document.head.appendChild(script);
  });
  return target.__preplanGoogleMapsPromise;
}

function openTarget(targetId?: string, href?: string) {
  if (targetId) {
    const target = document.getElementById(targetId);
    if (target) {
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.remove("map-selected-record");
      requestAnimationFrame(() => target.classList.add("map-selected-record"));
      window.setTimeout(() => target.classList.remove("map-selected-record"), 2400);
      return;
    }
  }
  if (href) window.location.assign(href);
}

function boundsOf(preplans: MapPreplan[], hydrants: MapHydrant[]) {
  const points: MapPoint[] = [];
  preplans.forEach((record) => {
    if (finite(record.latitude) && finite(record.longitude)) points.push({ lat: record.latitude, lng: record.longitude });
    points.push(...record.footprint.filter((point) => finite(point.lat) && finite(point.lng)));
  });
  hydrants.forEach((record) => {
    if (finite(record.latitude) && finite(record.longitude)) points.push({ lat: record.latitude, lng: record.longitude });
  });
  if (!points.length) return null;
  return {
    minLat: Math.min(...points.map((point) => point.lat)),
    maxLat: Math.max(...points.map((point) => point.lat)),
    minLng: Math.min(...points.map((point) => point.lng)),
    maxLng: Math.max(...points.map((point) => point.lng)),
  };
}

function PlotMap({ preplans, hydrants }: { preplans: MapPreplan[]; hydrants: MapHydrant[] }) {
  const bounds = useMemo(() => boundsOf(preplans, hydrants), [preplans, hydrants]);
  if (!bounds) return <div className="preplan-map-empty"><b>No mapped records yet</b><span>Add verified latitude and longitude to a preplan or hydrant. Saved building footprints will be highlighted here.</span></div>;
  const lngRange = bounds.maxLng - bounds.minLng;
  const latRange = bounds.maxLat - bounds.minLat;
  const x = (lng: number) => lngRange < 0.000001 ? 50 : 7 + ((lng - bounds.minLng) / lngRange) * 86;
  const y = (lat: number) => latRange < 0.000001 ? 50 : 93 - ((lat - bounds.minLat) / latRange) * 86;
  return <svg className="preplan-coordinate-plot" viewBox="0 0 100 100" role="img" aria-label="Coordinate plot of saved preplans and hydrants">
    <defs><pattern id="map-grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(148,168,184,.11)" strokeWidth=".35"/></pattern></defs>
    <rect width="100" height="100" fill="url(#map-grid)"/>
    <path d="M-5 72 C22 62 38 77 105 58" className="preplan-map-road"/><path d="M31 -5 C38 25 29 51 43 105" className="preplan-map-road minor"/>
    {preplans.map((record) => record.footprint.length >= 3 ? <polygon key={record.id} points={record.footprint.map((point) => `${x(point.lng)},${y(point.lat)}`).join(" ")} className="preplan-map-building" tabIndex={0} role="button" aria-label={`Open ${record.name}`} onClick={() => openTarget(record.targetId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openTarget(record.targetId); }}><title>{record.name} — {record.address}</title></polygon> : finite(record.latitude) && finite(record.longitude) ? <g key={record.id} className="preplan-map-building-pin" role="button" tabIndex={0} aria-label={`Open ${record.name}`} transform={`translate(${x(record.longitude)},${y(record.latitude)})`} onClick={() => openTarget(record.targetId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openTarget(record.targetId); }}><circle r="2.7"/><text y="-.2" textAnchor="middle">P</text><title>{record.name} — location saved, footprint not mapped</title></g> : null)}
    {hydrants.map((record) => finite(record.latitude) && finite(record.longitude) ? <g key={record.id} className={`preplan-map-hydrant ${record.status.toLowerCase().includes("out") ? "oos" : ""}`} role="button" tabIndex={0} aria-label={`${record.name} ${record.status}`} transform={`translate(${x(record.longitude)},${y(record.latitude)})`} onClick={() => openTarget(record.targetId, record.href)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openTarget(record.targetId, record.href); }}><circle r="2.4"/><path d="M-1.4 0h2.8M0-1.5v3"/><title>{record.name} — {record.location} — {record.status}</title></g> : null)}
  </svg>;
}

export default function PreplanMap({ departmentId, departmentSlug, preplans, hydrants, editable }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"checking" | "google" | "plot" | "error">("checking");
  const mappedPreplans = useMemo(() => preplans.filter((record) => finite(record.latitude) && finite(record.longitude) || record.footprint.length >= 3), [preplans]);
  const mappedHydrants = useMemo(() => hydrants.filter((record) => finite(record.latitude) && finite(record.longitude)), [hydrants]);

  useEffect(() => {
    let active = true;
    fetch(`/api/map-config?department=${encodeURIComponent(departmentSlug)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Map configuration unavailable.")))
      .then(async (config: GoogleMapConfig) => {
        if (!config.configured || !config.browserKey || !host.current) {
          if (active) setState("plot");
          return;
        }
        const records = [...mappedPreplans.flatMap((record) => record.footprint.length ? record.footprint : finite(record.latitude) && finite(record.longitude) ? [{ lat: Number(record.latitude), lng: Number(record.longitude) }] : []), ...mappedHydrants.flatMap((record) => finite(record.latitude) && finite(record.longitude) ? [{ lat: Number(record.latitude), lng: Number(record.longitude) }] : [])];
        if (!records.length) {
          if (active) setState("plot");
          return;
        }
        await loadGoogleMaps(config);
        if (!active || !host.current) return;
        const google = (window as GoogleWindow).google;
        const map = new google.maps.Map(host.current, {
          center: records[0], zoom: 15, mapId: config.mapId || undefined,
          mapTypeControl: true, streetViewControl: config.streetViewEnabled, fullscreenControl: true,
        });
        const bounds = new google.maps.LatLngBounds();
        mappedPreplans.forEach((record) => {
          const path = record.footprint.length >= 3 ? record.footprint : [];
          const overlay = path.length ? new google.maps.Polygon({ map, paths: path, strokeColor: "#ff4b43", strokeOpacity: 1, strokeWeight: 3, fillColor: "#ff4b43", fillOpacity: .25, clickable: true }) : new google.maps.Marker({ map, position: { lat: Number(record.latitude), lng: Number(record.longitude) }, title: `${record.name} — footprint not mapped`, label: "P" });
          overlay.addListener("click", () => openTarget(record.targetId));
          path.forEach((point) => bounds.extend(point));
          if (!path.length && finite(record.latitude) && finite(record.longitude)) bounds.extend({ lat: Number(record.latitude), lng: Number(record.longitude) });
        });
        mappedHydrants.forEach((record) => {
          const position = { lat: Number(record.latitude), lng: Number(record.longitude) };
          const marker = new google.maps.Marker({ map, position, title: `${record.name} — ${record.location}`, label: { text: "H", color: "#ffffff", fontWeight: "800" }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: record.status.toLowerCase().includes("out") ? "#d93838" : "#1677d2", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 } });
          marker.addListener("click", () => openTarget(record.targetId, record.href));
          bounds.extend(position);
        });
        if (!bounds.isEmpty()) map.fitBounds(bounds, 46);
        setState("google");
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [departmentSlug, mappedHydrants, mappedPreplans]);

  return <section className="preplan-map-panel">
    <div className="preplan-map-head"><div><span>PREPLAN & WATER MAP</span><h2>Buildings and hydrants</h2><p>Click a saved building footprint or marker to open that record.</p></div><div className={`preplan-map-provider ${state}`}><i/>{state === "google" ? "Google map active" : state === "checking" ? "Checking map service" : "Coordinate plot"}</div></div>
    <div className="preplan-map-stage">
      <div ref={host} className={`preplan-google-map ${state === "google" ? "active" : ""}`}/>
      {state !== "google" ? <PlotMap preplans={preplans} hydrants={hydrants}/> : null}
      <div className="preplan-map-legend"><span><i className="building"/>Saved footprint</span><span><i className="pin"/>Preplan location only</span><span><i className="hydrant"/>Hydrant</span></div>
    </div>
    <div className="preplan-map-truth"><b>{mappedPreplans.length} mapped preplans · {mappedHydrants.length} mapped hydrants</b><span>{state === "google" ? "Live Google basemap with department records overlaid." : "Add and verify a restricted Google Maps browser key in this department's Build & Branding Integration Center. This fallback uses only saved record coordinates."}</span>{state !== "google" && editable ? <a href={`/departments/${departmentId}#integrations`}>Set up Google Maps</a> : null}</div>
  </section>;
}
