import { requireOwnerUser } from "@/app/chatgpt-auth";
import { isOwner } from "@/db/access";

export const dynamic = "force-dynamic";

const workspaces = [
  ["Occupancy register", "Building identity, contacts, hazards, systems, permit types, and inspection cadence."],
  ["Inspection queue", "Assignment, scheduling, field status, reinspection, and supervisor review."],
  ["Forms and code sets", "Owner-controlled templates, editions, local amendments, findings, and correction language."],
  ["Reporting and exchange", "PDF reports, controlled exports, provider adapters, and future authorized integrations."],
];

export default async function OwnerDevelopmentPreview() {
  const user = await requireOwnerUser("/owner/demo");
  if (!(await isOwner(user.userId))) return <main className="access-shell"><section className="owner-claim"><div className="access-kicker">OWNER ACCESS REQUIRED</div><h1>Development preview is protected.</h1><p>Only the verified platform owner can open unpublished modules.</p><a className="access-primary" href="/portal">Department sign in</a></section></main>;
  return <main className="access-shell owner-dev"><header className="access-header"><a className="department-admin-brand" href="/owner"><span className="department-monogram">DEV</span><span><b>Owner development build</b><small>Unpublished workspace</small></span></a><div className="access-account"><span>{user.displayName}</span><a href="/owner">Return to Owner Command</a></div></header><section className="access-page"><div className="owner-dev-banner"><span>OWNER ONLY · NOT PUBLISHED</span><h1>Inspections</h1><p>This module stays hidden behind “Coming Soon” everywhere else. Build and review its structure here without exposing occupancies, inspectors, schedules, or compliance information.</p></div><div className="owner-dev-grid">{workspaces.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{copy}</p><button disabled>Continue building</button></article>)}</div><div className="owner-dev-state"><div><span>DATA CONNECTION</span><h2>No department inspection records connected</h2><p>Real records will appear only after the module is approved, department-scoped authorization is verified, and a migration/import path is selected.</p></div><b>Protected empty state</b></div></section></main>;
}
