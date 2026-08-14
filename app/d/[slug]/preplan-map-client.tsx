"use client";

import dynamic from "next/dynamic";
import type { MapHydrant, MapPreplan } from "./preplan-map";

const InteractivePreplanMap = dynamic(() => import("./preplan-map"), {
  ssr: false,
  loading: () => <section className="preplan-map-panel" id="preplan-map"><div className="preplan-map-empty"><b>Opening department map</b><span>Loading saved preplan and hydrant locations…</span></div></section>,
});

export default function PreplanMapClient(props: { departmentId: string; departmentSlug: string; preplans: MapPreplan[]; hydrants: MapHydrant[]; editable: boolean }) {
  return <InteractivePreplanMap {...props}/>;
}
