import { requireOwnerUser } from "@/app/chatgpt-auth";
import { DepartmentEditor } from "@/app/departments/department-brand";
import { DepartmentIntegrationCenter } from "@/app/departments/integration-center";
import { integrationEncryptionReady } from "@/app/lib/integration-crypto";
import { getDepartmentIntegration, listDepartmentExportDeliveries } from "@/app/lib/department-integrations";
import { getDepartment, getSupportSession, isOwner, listAudit } from "@/db/access";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function SupportSessionPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ integration_status?: string; integration_message?: string }> }) {
  const { sessionId } = await params;
  const user = await requireOwnerUser(`/owner/support/${sessionId}`);
  if (!(await isOwner(user.userId))) return <main className="access-shell"><section className="owner-claim"><h1>Owner access required.</h1><a className="access-primary" href="/portal">Department sign in</a></section></main>;
  const session = await getSupportSession(sessionId);
  if (!session || session.owner_user_id !== user.userId || session.status !== "active") return <main className="access-shell"><section className="owner-claim"><h1>This support session is closed or unavailable.</h1><a className="access-primary" href="/owner">Return to Owner Command</a></section></main>;
  const [department, audit, integration, deliveries, query, requestHeaders] = await Promise.all([
    getDepartment(session.department_id),
    listAudit(session.department_id),
    getDepartmentIntegration(session.department_id),
    listDepartmentExportDeliveries(session.department_id),
    searchParams,
    headers(),
  ]);
  if (!department) return null;
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "preplan-360.vercel.app";
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const baseUrl = `${protocol}://${host}`;

  return <main className="access-shell support-shell">
    <header className="support-header"><div><span className="support-live"><i/> OWNER SUPPORT MODE</span><b>{department.name}</b><small>Reason: {session.reason}</small></div><form method="post" action="/api/owner/support"><input type="hidden" name="action" value="close"/><input type="hidden" name="session_id" value={session.id}/><button type="submit">Exit support session</button></form></header>
    <section className="access-page department-page">
      <div className="department-banner"><div><div className="access-kicker">AUDITED SUPPORT SESSION</div><h1>Department app support</h1><p>Configure this department’s Google services, CAD webhooks, Resend routing, server backup, profile, branding, apparatus, and equipment. Saved changes are attributed to your owner identity and this active support session.</p></div><div className="support-actions"><a className="access-primary" href="#integrations">Integration setup</a><a className="access-secondary" href={`/d/${department.slug}?module=fleet&support=${session.id}`}>Open apparatus support</a></div></div>
      <DepartmentIntegrationCenter department={department} integration={integration} deliveries={deliveries} baseUrl={baseUrl} encryptionReady={integrationEncryptionReady()} status={query.integration_status} message={query.integration_message} supportSessionId={session.id}/>
      <DepartmentEditor department={department} supportSessionId={session.id}/>
      <section className="department-audit full"><h2>Department audit trail</h2>{audit.length ? audit.map((event) => <article key={event.id}><time>{new Date(event.created_at).toLocaleString()}</time><b>{event.event_type.replaceAll("_", " ")}</b><p>{event.detail}</p></article>) : <p className="access-muted">No audited changes yet.</p>}</section>
    </section>
  </main>;
}
