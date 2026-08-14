import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { canAdminDepartment, getDepartment, isOwner, listAudit } from "@/db/access";
import { DepartmentEditor, DepartmentLogo } from "@/app/departments/department-brand";
import { DepartmentIntegrationCenter } from "@/app/departments/integration-center";
import { getDepartmentIntegration, listDepartmentExportDeliveries } from "@/app/lib/department-integrations";
import { integrationEncryptionReady } from "@/app/lib/integration-crypto";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function DepartmentBuild({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ integration_status?: string; integration_message?: string }> }) {
  const { id } = await params;
  const user = await requireChatGPTUser(`/departments/${id}`);
  if (!(await canAdminDepartment(user.userId, id))) {
    return <main className="access-shell"><section className="owner-claim"><div className="access-kicker">DEPARTMENT ACCESS REQUIRED</div><h1>This build is not assigned to your account.</h1><p>Return to the department portal to request or select authorized administrator access.</p><a className="access-primary" href="/portal">Return to portal</a></section></main>;
  }
  const [department, audit, integration, deliveries, query, requestHeaders] = await Promise.all([getDepartment(id), listAudit(id), getDepartmentIntegration(id), listDepartmentExportDeliveries(id), searchParams, headers()]);
  if (!department) return <main className="access-shell"><section className="owner-claim"><h1>Department not found.</h1><a className="access-primary" href="/portal">Return to portal</a></section></main>;
  const owner = await isOwner(user.userId);
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "preplan-360.vercel.app";
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const baseUrl = `${protocol}://${host}`;

  return <main className="access-shell">
    <header className="access-header department-admin-header">
      <a href={owner ? "/owner" : "/portal"} className="department-admin-brand"><DepartmentLogo department={department}/><span><b>{department.app_title || department.name}</b><small>Build and branding</small></span></a>
      <div className="access-account"><span>{user.displayName}</span><a href={owner ? "/owner" : "/portal"}>Exit build</a></div>
    </header>
    <section className="access-page department-page">
      <div className="department-banner"><div><div className="access-kicker">DEPARTMENT WEB APP</div><h1>{department.name}</h1><p>Control the identity members see when they enter this department.</p></div><a className="access-primary" href={`/d/${department.slug}`}>Open live department app <span aria-hidden="true">↗</span></a></div>
      <DepartmentEditor department={department}/>
      <DepartmentIntegrationCenter department={department} integration={integration} deliveries={deliveries} baseUrl={baseUrl} encryptionReady={integrationEncryptionReady()} status={query.integration_status} message={query.integration_message}/>
      <div className="department-grid"><section className="department-summary"><h2>App identity</h2><div><span>Direct shortcut</span><b>/d/{department.slug}</b></div><div><span>Visible app name</span><b>{department.app_title || department.name}</b></div><div><span>Stations</span><b>{department.station_count}</b></div><div><span>Vehicles</span><b>{department.vehicle_count}</b></div><div><span>Platform branding</span><b>Hidden in department app</b></div></section><section className="department-audit"><h2>Recent activity</h2>{audit.length ? audit.map((event) => <article key={event.id}><time>{new Date(event.created_at).toLocaleString()}</time><b>{event.event_type.replaceAll("_", " ")}</b><p>{event.detail}</p></article>) : <p className="access-muted">No audited changes yet.</p>}</section></div>
    </section>
  </main>;
}
