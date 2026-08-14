"use client";

import dynamic from "next/dynamic";
import type { PreplanDetailHydrant, PreplanDetailRecord } from "./preplan-detail";

const InteractivePreplanDetail = dynamic(() => import("./preplan-detail"), {
  ssr: false,
  loading: () => <div className="department-preplan-loading">Opening property workspace…</div>,
});

export default function PreplanDetailClient(props: { record: PreplanDetailRecord; hydrants: PreplanDetailHydrant[]; editable: boolean; shared?: boolean }) {
  return <InteractivePreplanDetail {...props}/>;
}
