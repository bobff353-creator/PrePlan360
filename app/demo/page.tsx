import Link from "next/link";
import { requireOwnerUser } from "@/app/chatgpt-auth";
import { isOwner } from "@/db/access";
import StationDisplayButton from "@/app/station-display-button";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ owner?: string; module?: string }> }) {
  const query = await searchParams;
  const ownerMode = query.owner === "1";
  if (ownerMode) {
    const returnTo = `/demo?owner=1${query.module ? `&module=${encodeURIComponent(query.module)}` : ""}`;
    const owner = await requireOwnerUser(returnTo);
    if (!(await isOwner(owner.userId))) return <main className="demo-shell"><section className="owner-claim"><h1>Owner access required.</h1><p>Only the verified platform owner can open the editable foundation demo.</p><Link href="/owner/sign-in">Owner sign in</Link></section></main>;
  }
  const ownerModule = ownerMode && query.module === "inspections" ? "&module=insp" : ownerMode && query.module === "box-cards" ? "&module=resources" : "";
  const demoSource = ownerMode ? `/fireflow-360-demo.html?v=20260814-call-notes${ownerModule}` : "/fireflow-360-demo.html?view=readonly&v=20260814-call-notes";
  const stationSource = `${demoSource}${demoSource.includes("?") ? "&" : "?"}station=1`;
  return <main className="demo-shell"><header className="demo-header"><Link className="demo-back" href="/" aria-label="Back to demo launch page"><span aria-hidden="true">←</span> Overview</Link><div className="demo-title"><strong>PrePlan <span>360</span></strong><small>{ownerMode ? "Owner usable foundation demo" : "Latest view-only build"}</small></div><div className="demo-actions"><div className="demo-mode"><i/> Fictional data · {ownerMode ? "device-local editing enabled" : "editing locked"}</div>{ownerMode ? <StationDisplayButton displayUrl={stationSource}/> : null}</div></header><iframe className="fireflow-frame" src={demoSource} title={ownerMode ? "PrePlan 360 owner usable foundation demo" : "PrePlan 360 latest view-only demo"} allow="autoplay; fullscreen" allowFullScreen/></main>;
}
