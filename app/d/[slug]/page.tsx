import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "../../live-ops-foundation.css";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, canDepartmentPermission, getDepartmentBySlug, getDepartmentModuleData, getSupportSession, isOwner, listDepartmentAssets, listDepartmentHydrants, listDepartmentPreplans, listSharedHydrants, listSharedPreplans } from "@/db/access";
import { DepartmentLogo } from "@/app/departments/department-brand";
import { loadDepartmentEmployeeOverlays, loadDepartmentScheduleOverlays, loadStickneyModule, type StickneyModuleData } from "@/db/stickney";
import AssetManager from "./asset-manager";
import ReferenceLibrary from "./reference-library";
import StickneyWorkspace from "./stickney-workspace";
import ModuleBuilder from "./module-builder";
import LiveOpsBoard from "./live-ops-board";
import { getDepartmentFoundation, orderedVisibleModules } from "@/db/foundation";

export const dynamic = "force-dynamic";

const stickneyModules = new Set(["dashboard", "live-ops", "staffing", "scheduling", "preplans", "fleet", "inventory", "duties", "documents", "phones", "hydrants"]);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const department = await getDepartmentBySlug(slug);
  if (!department) return { title: "Department app" };
  const logo = department.logo_key ? `/api/departments/${department.id}/logo` : undefined;
  return {
    title: department.app_title || department.name,
    description: department.welcome_message || `${department.name} department operations app.`,
    manifest: `/d/${slug}/manifest.webmanifest`,
    icons: logo ? { icon: logo, apple: logo } : undefined,
  };
}

export default async function BrandedDepartmentApp({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ module?: string; asset?: string; support?: string }> }) {
  const { slug } = await params;
  const department = await getDepartmentBySlug(slug);
  if (!department)
    return (
      <main className="department-app-missing">
        <h1>Department app not found.</h1>
        <a href="/portal">Return to department sign in</a>
      </main>
    );
  const user = await requireChatGPTUser(`/d/${slug}`);
  if (!(await canAccessDepartment(user.userId, department.id)))
    return (
      <main className="department-app-missing">
        <h1>Department access required.</h1>
        <p>This app is not assigned to your signed-in account.</p>
        <a href="/portal">Return to department sign in</a>
      </main>
    );
  const owner = await isOwner(user.userId);
  const foundation = await getDepartmentFoundation(department.id);
  const visibleModules = orderedVisibleModules(foundation);
  const query = await searchParams;
  const selected = query.module || "dashboard";
  const active = visibleModules.find(([key]) => key === selected) || visibleModules[0];
  const supportSession = owner && query.support ? await getSupportSession(query.support) : null;
  const ownerSupport = !!supportSession && supportSession.owner_user_id === user.userId && supportSession.department_id === department.id && supportSession.status === "active";
  const permissionByModule = (
    {
      "live-ops": "live_ops",
      respond: "respond",
      staffing: "staffing",
      scheduling: "scheduling",
      preplans: "preplans",
      fleet: "fleet",
      inventory: "inventory",
      duties: "duties",
      documents: "documents",
      phones: "phones",
      hydrants: "hydrants",
    } as const
  )[active[0] as "live-ops" | "respond" | "staffing" | "scheduling" | "preplans" | "fleet" | "inventory" | "duties" | "documents" | "phones" | "hydrants"];
  const editable = permissionByModule ? await canDepartmentPermission(user.userId, department.id, permissionByModule, ownerSupport ? supportSession?.id : "") : false;
  const supportQuery = ownerSupport ? `&support=${encodeURIComponent(supportSession.id)}` : "";
  const referenceData = active[0] === "preplans" || active[0] === "hydrants" ? await Promise.all([listDepartmentPreplans(department.id), listSharedPreplans(department.id), listDepartmentHydrants(department.id), listSharedHydrants(department.id)]) : null;
  const configurableModule = active[0] === "live-ops" || active[0] === "respond" ? active[0] : null;
  const moduleData = configurableModule ? await getDepartmentModuleData(department.id, configurableModule) : null;
  const liveOpsAssets = active[0] === "live-ops" ? await listDepartmentAssets(department.id) : [];
  // Every department slug uses this shared route, including foundation calendar upgrades.
  const isStickney = department.slug === "stickney";
  let stickneyData: StickneyModuleData | null = null;
  let stickneyConnectionError = "";
  if (isStickney && stickneyModules.has(active[0])) {
    try {
      stickneyData = await loadStickneyModule(active[0], department.id);
    } catch (error) {
      stickneyConnectionError = error instanceof Error ? error.message : "The Stickney data connection is unavailable.";
      stickneyData = {};
    }
  } else if (active[0] === "live-ops" || active[0] === "staffing" || active[0] === "scheduling") {
    try {
      const employees = await loadDepartmentEmployeeOverlays(department.id);
      stickneyData =
        active[0] === "live-ops"
          ? { employees, schedule: await loadDepartmentScheduleOverlays(department.id) }
          : active[0] === "staffing"
          ? { employees }
          : {
              employees,
              schedule: await loadDepartmentScheduleOverlays(department.id),
            };
    } catch (error) {
      stickneyConnectionError = error instanceof Error ? error.message : "The department personnel workspace is unavailable.";
      stickneyData = {};
    }
  }
  const style = {
    "--dept-primary": department.brand_primary,
    "--dept-bg": department.brand_secondary,
    "--dept-accent": department.brand_accent,
    "--dept-action": department.brand_action,
    "--dept-alert": department.brand_alert,
  } as CSSProperties;

  return (
    <main className="department-app" style={style} data-daily-log-equipment-accountability={foundation.daily_log_equipment_accountability ? "shown" : "hidden"}>
      <aside className="dept-app-sidebar">
        <input
          aria-label="Expand or collapse department navigation"
          className="dept-sidebar-toggle"
          id="dept-sidebar-expanded"
          type="checkbox"
        />
        <label
          aria-label="Expand or collapse department navigation"
          className="dept-sidebar-toggle-label"
          htmlFor="dept-sidebar-expanded"
          title="Expand or collapse department navigation"
        >
          <span aria-hidden="true" className="dept-sidebar-toggle-open">›</span>
          <span aria-hidden="true" className="dept-sidebar-toggle-close">‹</span>
        </label>
        <div className="dept-app-brand">
          <DepartmentLogo department={department} />
          <div className="dept-sidebar-copy dept-app-brand-copy">
            <b>{department.app_title || department.name}</b>
            <small>Department operations</small>
          </div>
        </div>
        <nav>
          {visibleModules.map(([key, label, number]) => (
            <a
              aria-label={label}
              className={active[0] === key ? "active" : ""}
              href={`/d/${slug}?module=${key}${supportQuery}`}
              key={key}
              title={label}
            >
              <span>{number}</span>
              <span className="dept-sidebar-copy dept-nav-label">{label}</span>
            </a>
          ))}
        </nav>
        <div className="dept-sidebar-foot">
          <span className="dept-security-status" title={ownerSupport ? "Audited owner support" : "Secure department app"}>
            <i />
            <span className="dept-sidebar-copy">{ownerSupport ? "Audited owner support" : "Secure department app"}</span>
          </span>
          <form method="post" action="/api/member/logout">
            <button aria-label="Sign out" title="Sign out" type="submit">
              <span aria-hidden="true" className="dept-signout-mark">↪</span>
              <span className="dept-sidebar-copy">Sign out</span>
            </button>
          </form>
        </div>
      </aside>
      <section className="dept-app-workspace">
        <header>
          <button className="dept-mobile-mark" aria-label="Department menu">
            <DepartmentLogo department={department} />
          </button>
          <div>
            <span>{department.name}</span>
            <b>{active[1]}</b>
          </div>
          <div className="dept-user">
            <span>{user.displayName}</span>
            {owner ? <a href="/owner">Owner console</a> : <a href="/portal">Switch department</a>}
          </div>
        </header>
        <div className="dept-app-content">
          <div className="dept-app-heading">
            <div>
              <span>DEPARTMENT WORKSPACE</span>
              <h1>{active[1]}</h1>
              <p>{department.welcome_message || `${department.name} operations, connected in one web app.`}</p>
            </div>
            <div className="dept-app-status">
              <i /> App configured
            </div>
          </div>
          {active[0] === "live-ops" || active[0] === "respond" || active[0] === "scheduling" ? (
            <div className="dept-foundation-rulebar">
              <span>Foundation</span>
              <b>{foundation.is_override ? "Department override" : "Owner master"}</b>
              <small>{active[0] === "scheduling" ? `${foundation.shift_hours_on} on / ${foundation.shift_hours_off} off · ${foundation.shift_start_time} start · OT ${foundation.overtime_threshold_hours} hours per ${foundation.overtime_period_days} days` : `${foundation.board_rotation_seconds}s rotation · ${foundation.response_duration_seconds}s response page`}</small>
            </div>
          ) : null}
          {active[0] === "live-ops" && moduleData ? (
            <LiveOpsBoard departmentId={department.id} departmentSlug={department.slug} departmentName={department.name} weatherLocation={department.weather_location} vehicleCount={department.vehicle_count} settings={foundation} data={moduleData} sourceData={stickneyData} assets={liveOpsAssets} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} />
          ) : active[0] === "respond" && moduleData ? (
            <ModuleBuilder moduleKey="respond" moduleName={active[1]} departmentId={department.id} data={moduleData} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} />
          ) : stickneyData ? (
            <>
              <StickneyWorkspace module={active[0]} departmentId={department.id} departmentSlug={department.slug} data={stickneyData} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} connectionError={stickneyConnectionError || undefined} />
              {active[0] === "fleet" ? (
                <details id="native-assets" className="stickney-archive">
                  <summary>VIN, barcode, QR, and odometer capture</summary>
                  <AssetManager department={department} selectedAssetId={query.asset} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} />
                </details>
              ) : null}
              {referenceData ? <ReferenceLibrary showMap={false} kind={active[0] as "preplans" | "hydrants"} department={department} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} ownPreplans={referenceData[0]} sharedPreplans={referenceData[1]} ownHydrants={referenceData[2]} sharedHydrants={referenceData[3]} /> : null}
            </>
          ) : active[0] === "dashboard" ? (
            <Dashboard department={department.name} stations={department.station_count} vehicles={department.vehicle_count} weather={department.weather_location} supportQuery={supportQuery} modules={visibleModules} />
          ) : active[0] === "fleet" ? (
            <AssetManager department={department} selectedAssetId={query.asset} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} />
          ) : referenceData ? (
            <ReferenceLibrary kind={active[0] as "preplans" | "hydrants"} department={department} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} ownPreplans={referenceData[0]} sharedPreplans={referenceData[1]} ownHydrants={referenceData[2]} sharedHydrants={referenceData[3]} />
          ) : active[0] === "documents" ? (
            <DocumentsFoundation owner={owner} />
          ) : active[0] === "inspections" ? (
            <ComingSoon owner={owner} />
          ) : (
            <ModuleEmpty moduleName={active[1]} />
          )}
        </div>
      </section>
    </main>
  );
}

function Dashboard({ department, stations, vehicles, weather, supportQuery, modules: dashboardModules }: { department: string; stations: number; vehicles: number; weather: string; supportQuery: string; modules: ReadonlyArray<readonly [string, string, string]> }) {
  return (
    <>
      <div className="dept-metrics">
        <article>
          <span>Stations</span>
          <b>{stations}</b>
          <small>Configured locations</small>
        </article>
        <article>
          <span>Vehicles</span>
          <b>{vehicles}</b>
          <small>Configured apparatus</small>
        </article>
        <article>
          <span>Weather location</span>
          <b className="metric-text">{weather || "Not set"}</b>
          <small>{weather ? "Location saved" : "Add in Build & branding"}</small>
        </article>
        <article className="attention">
          <span>Live integrations</span>
          <b className="metric-text">Not connected</b>
          <small>Truthful setup status</small>
        </article>
      </div>
      <div className="dept-home-grid">
        <section>
          <span className="dept-section-label">READY TO BUILD</span>
          <h2>{department} workspace</h2>
          <p>The department identity is live. Operational modules remain clean until authorized records or integrations are connected.</p>
          <div className="dept-module-grid">
            {dashboardModules
              .filter(([key]) => key !== "dashboard")
              .slice(0, 6)
              .map(([key, label, number]) => (
                <a href={`?module=${key}${supportQuery}`} key={key}>
                  <span>{number}</span>
                  <b>{label}</b>
                  <small>Open module</small>
                </a>
              ))}
          </div>
        </section>
        <aside>
          <span className="dept-section-label">CURRENT STATUS</span>
          <h2>No active incident</h2>
          <p>No live CAD or operational feed is connected to this department app.</p>
          <div className="dept-safe-state">
            <i /> Available for configured workflows
          </div>
        </aside>
      </div>
    </>
  );
}

function DocumentsFoundation({ owner }: { owner: boolean }) {
  return (
    <section className="dept-module-empty" data-box-card-release="owner-preview" aria-label="Box Card publishing status">
      <div className="dept-empty-mark">LIB</div>
      <span className="dept-section-label">POLICIES & BOX CARDS</span>
      <h2>Policy and grouped Box Card foundation ready. Department records not published.</h2>
      <p>The shared owner build supports a searchable, paged policy library with a focused document reader, plus town/group Box Card tabs, secure browser-safe imports, structured alarm rows, and autosaved owner edits. Only the signed-in, verified platform owner can build drafts; this department remains empty until an authorized administrator publishes verified records to tenant storage.</p>
      <a aria-label={owner ? "Open owner Documents development workbench" : "Return to department portal"} href={owner ? "/demo?owner=1&module=box-cards" : "/portal"}>{owner ? "Open owner Documents workbench" : "Return to department portal"}</a>
    </section>
  );
}

function ComingSoon({ owner }: { owner: boolean }) {
  return (
    <section className="dept-module-empty coming-soon" data-inspection-release="owner-preview">
      <div className="dept-empty-mark">LOCKED</div>
      <span className="dept-section-label">INSPECTIONS</span>
      <h2>Owner workbench active. Department publishing locked.</h2>
      <p>The shared Inspection 360 foundation is available in the owner demo, but inspection names, occupancies, schedules, findings, and compliance figures remain protected from every department until the owner publishes a verified tenant-safe release.</p>
      <a aria-label={owner ? "Open owner Inspection development workbench" : "Return to department portal"} href={owner ? "/demo?owner=1&module=inspections" : "/portal"}>{owner ? "Open owner Inspection workbench" : "Return to department portal"}</a>
    </section>
  );
}

function ModuleEmpty({ moduleName }: { moduleName: string }) {
  return (
    <section className="dept-module-empty">
      <div className="dept-empty-mark">+</div>
      <span className="dept-section-label">{moduleName.toUpperCase()}</span>
      <h2>Ready for department configuration.</h2>
      <p>This module is part of the branded department app, but no department records or live integration have been connected yet.</p>
      <a href="/portal">Return to department portal</a>
    </section>
  );
}
