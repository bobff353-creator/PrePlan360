import Link from "next/link";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ owner?: string; module?: string }> }) {
  const query = await searchParams;
  const ownerMode = query.owner === "1";
  const ownerModule = ownerMode && query.module === "inspections" ? "&module=insp" : "";
  return <main className="demo-shell"><header className="demo-header"><Link className="demo-back" href="/" aria-label="Back to demo launch page"><span aria-hidden="true">←</span> Overview</Link><div className="demo-title"><strong>PrePlan <span>360</span></strong><small>{ownerMode ? "Owner usable foundation demo" : "Latest view-only build"}</small></div><div className="demo-mode"><i/> Fictional data · {ownerMode ? "device-local editing enabled" : "editing locked"}</div></header><iframe className="fireflow-frame" src={ownerMode ? `/fireflow-360-demo.html?v=20260813-owner-inspections${ownerModule}` : "/fireflow-360-demo.html?view=readonly&v=20260813-inspections-view-only"} title={ownerMode ? "PrePlan 360 owner usable foundation demo" : "PrePlan 360 latest view-only demo"}/></main>;
}
