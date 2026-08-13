import type { CSSProperties } from "react";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { DepartmentLogo } from "@/app/departments/department-brand";
import {
  canAccessDepartment,
  canAdminDepartment,
  getDepartmentAsset,
  getDepartmentBySlug,
  getSupportSession,
  isOwner,
  listAssetEvents,
  listAssetMaintenance,
  listAssetResources,
} from "@/db/access";
import { AssetDetail } from "../../asset-manager";

export const dynamic = "force-dynamic";

export default async function AssetRecordPage({ params, searchParams }: { params: Promise<{ slug: string; assetId: string }>; searchParams: Promise<{ support?: string }> }) {
  const { slug, assetId } = await params;
  const query = await searchParams;
  const supportQuery = query.support ? `?support=${encodeURIComponent(query.support)}` : "";
  const department = await getDepartmentBySlug(slug);
  if (!department) return <main className="department-app-missing"><h1>Department app not found.</h1><a href="/portal">Return to department sign in</a></main>;

  const user = await requireChatGPTUser(`/d/${slug}/assets/${assetId}${supportQuery}`);
  if (!(await canAccessDepartment(user.userId, department.id))) return <main className="department-app-missing"><h1>Department access required.</h1><p>This record is not assigned to your signed-in account.</p><a href="/portal">Return to department sign in</a></main>;

  const asset = await getDepartmentAsset(department.id, assetId);
  if (!asset) return <main className="department-app-missing"><h1>Equipment record not found.</h1><a href={`/d/${slug}?module=fleet`}>Return to apparatus and equipment</a></main>;

  const owner = await isOwner(user.userId);
  const supportSession = owner && query.support ? await getSupportSession(query.support) : null;
  const ownerSupport = !!supportSession && supportSession.owner_user_id === user.userId && supportSession.department_id === department.id && supportSession.status === "active";
  const editable = owner ? ownerSupport : await canAdminDepartment(user.userId, department.id);
  const [resources, maintenance, events] = await Promise.all([
    listAssetResources(department.id, asset.id),
    listAssetMaintenance(department.id, asset.id),
    listAssetEvents(department.id, asset.id),
  ]);
  const fleetSupport = ownerSupport ? `&support=${encodeURIComponent(supportSession.id)}` : "";
  const style = { "--dept-primary": department.brand_primary, "--dept-bg": department.brand_secondary, "--dept-accent": department.brand_accent, "--dept-action": department.brand_action, "--dept-alert": department.brand_alert } as CSSProperties;

  return <main className="asset-record-page" style={style}>
    <header className="asset-record-top"><a className="asset-record-brand" href={`/d/${slug}${ownerSupport ? `?support=${encodeURIComponent(supportSession.id)}` : ""}`}><DepartmentLogo department={department}/><span><b>{department.app_title || department.name}</b><small>Apparatus & equipment records</small></span></a><div><span>{ownerSupport ? "Audited owner support" : editable ? "Department administrator" : "View only"}</span><b>{user.displayName}</b></div></header>
    <div className="asset-record-shell">
      <nav className="asset-record-nav"><a href={`/d/${slug}?module=fleet${fleetSupport}`}>← Return to apparatus & equipment</a><span>Permanent record</span><code>{asset.id}</code></nav>
      <section className="asset-record-card"><AssetDetail department={department} asset={asset} resources={resources} maintenance={maintenance} events={events} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} recordMode/></section>
    </div>
  </main>;
}
