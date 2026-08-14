import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "../../live-ops-foundation.css";
import "../../inventory-browser.css";
import "../../operations-foundation.css";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment, canDepartmentPermission, getDepartmentBySlug, getDepartmentModuleData, getSupportSession, isOwner, listDepartmentAssets, listDepartmentHydrants, listDepartmentPreplans, listDepartmentScheduleRequests, listSharedHydrants, listSharedPreplans } from "@/db/access";
import { DepartmentLogo } from "@/app/departments/department-brand";
import { loadDepartmentEmployeeOverlays, loadDepartmentScheduleOverlays, type StickneyModuleData } from "@/db/stickney";
import { getDepartmentSource, loadDepartmentSourceModule } from "@/db/department-source";
import AssetManager from "./asset-manager";
import ReferenceLibrary from "./reference-library";
import StickneyWorkspace from "./stickney-workspace";
import ModuleBuilder from "./module-builder";
import LiveOpsBoard from "./live-ops-board";
import { getDepartmentFoundation, orderedVisibleModules } from "@/db/foundation";
import propagation from "@/foundation/propagation.json";
import StationDisplayButton from "@/app/station-display-button";
import StationIncidentMonitor from "@/app/station-incident-monitor";
import DailyLogWorkspace from "./daily-log-workspace";
import { ActiveIncidentWorkspace, CommandCenterWorkspace, PayrollWorkspace } from "./operations-workspaces";

export const dynamic = "force-dynamic";

const sourceModules = new Set(["dashboard", "live-ops", "staffing", "scheduling", "preplans", "fleet", "inventory", "duties", "documents", "phones", "hydrants"]);

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

export default async function BrandedDepartmentApp({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ module?: string; asset?: string; support?: string; boardSaved?: string; station?: string; invQ?: string; invUnit?: string; invPage?: string; photoPage?: string }> }) {
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
  const stationDisplay = query.station === "1";
  const selected = query.module || "dashboard";
  const active = visibleModules.find(([key]) => key === selected) || visibleModules[0];
  const supportSession = owner && query.support ? await getSupportSession(query.support) : null;
  const ownerSupport = !!supportSession && supportSession.owner_user_id === user.userId && supportSession.department_id === department.id && supportSession.status === "active";
  const permissionByModule = (
    {
      "live-ops": "live_ops",
      "command-center": "live_ops",
      respond: "respond",
      "active-incident": "respond",
      staffing: "staffing",
      scheduling: "scheduling",
      payroll: "payroll",
      "daily-log": "duties",
      preplans: "preplans",
      fleet: "fleet",
      inventory: "inventory",
      duties: "duties",
      documents: "documents",
      phones: "phones",
      hydrants: "hydrants",
    } as const
  )[active[0] as "live-ops" | "command-center" | "respond" | "active-incident" | "staffing" | "scheduling" | "payroll" | "daily-log" | "preplans" | "fleet" | "inventory" | "duties" | "documents" | "phones" | "hydrants"];
  const editable = permissionByModule ? await canDepartmentPermission(user.userId, department.id, permissionByModule, ownerSupport ? supportSession?.id : "") : false;
  const supportQuery = ownerSupport ? `&support=${encodeURIComponent(supportSession.id)}` : "";
  const referenceData = active[0] === "preplans" || active[0] === "hydrants" ? await Promise.all([listDepartmentPreplans(department.id), listSharedPreplans(department.id), listDepartmentHydrants(department.id), listSharedHydrants(department.id)]) : null;
  const configurableModule = active[0] === "live-ops" || active[0] === "respond" ? active[0] : null;
  const liveOpsData = active[0] === "live-ops" || active[0] === "command-center" || active[0] === "active-incident" ? await getDepartmentModuleData(department.id, "live-ops") : null;
  const moduleData = configurableModule ? configurableModule === "live-ops" ? liveOpsData : await getDepartmentModuleData(department.id, configurableModule) : null;
  const liveOpsAssets = active[0] === "live-ops" || active[0] === "command-center" || active[0] === "active-incident" ? await listDepartmentAssets(department.id) : [];
  const dailyLogReference = active[0] === "daily-log" ? await Promise.all([getDepartmentModuleData(department.id, "daily-log"), listDepartmentPreplans(department.id), listDepartmentAssets(department.id)]) : null;
  // Every department slug uses this shared route. Source adapters add preserved legacy records without changing the shared shell.
  const source = getDepartmentSource(department.slug);
  let sourceData: StickneyModuleData | null = null;
  let sourceConnectionError = "";
  if (source && active[0] === "daily-log") {
    try {
      const [fleet, preplans] = await Promise.all([loadDepartmentSourceModule(source, "fleet", department.id), loadDepartmentSourceModule(source, "preplans", department.id)]);
      sourceData = { ...fleet, ...preplans };
    } catch (error) {
      sourceConnectionError = error instanceof Error ? error.message : "The department Daily Log reference data is unavailable.";
      sourceData = {};
    }
  } else if (source && active[0] === "command-center") {
    try {
      const [dashboard, liveOps] = await Promise.all([loadDepartmentSourceModule(source, "dashboard", department.id), loadDepartmentSourceModule(source, "live-ops", department.id)]);
      sourceData = { ...dashboard, ...liveOps };
    } catch (error) {
      sourceConnectionError = error instanceof Error ? error.message : "The department Command Center source is unavailable.";
      sourceData = {};
    }
  } else if (source && active[0] === "active-incident") {
    try {
      const [liveOps, preplans] = await Promise.all([loadDepartmentSourceModule(source, "live-ops", department.id), loadDepartmentSourceModule(source, "preplans", department.id)]);
      sourceData = { ...liveOps, ...preplans };
    } catch (error) {
      sourceConnectionError = error instanceof Error ? error.message : "The department incident references are unavailable.";
      sourceData = {};
    }
  } else if (source && active[0] === "payroll") {
    try {
      sourceData = await loadDepartmentSourceModule(source, "payroll", department.id);
    } catch (error) {
      sourceConnectionError = error instanceof Error ? error.message : "The department payroll schedule source is unavailable.";
      sourceData = {};
    }
  } else if (source && sourceModules.has(active[0])) {
    try {
      sourceData = await loadDepartmentSourceModule(source, active[0], department.id);
    } catch (error) {
      sourceConnectionError = error instanceof Error ? error.message : "The department source connection is unavailable.";
      sourceData = {};
    }
  } else if (["live-ops", "command-center", "active-incident", "staffing", "scheduling", "payroll"].includes(active[0])) {
    try {
      const employees = await loadDepartmentEmployeeOverlays(department.id);
      const schedule = ["live-ops", "command-center", "active-incident", "scheduling", "payroll"].includes(active[0]) ? await loadDepartmentScheduleOverlays(department.id) : [];
      sourceData =
        active[0] === "live-ops" || active[0] === "command-center" || active[0] === "active-incident"
          ? { employees, schedule, scheduleCalendar: schedule }
          : active[0] === "staffing"
          ? { employees }
          : {
              employees,
              schedule,
            };
    } catch (error) {
      sourceConnectionError = error instanceof Error ? error.message : "The department personnel workspace is unavailable.";
      sourceData = {};
    }
  }
  const scheduleRequests = active[0] === "scheduling" ? await listDepartmentScheduleRequests(department.id) : [];
  const selfEmployeeId = active[0] === "scheduling"
    ? (sourceData?.employees ?? []).find((employee) => employee.email.trim().toLowerCase() === user.email.trim().toLowerCase())?.id ?? ""
    : "";
  const style = {
    "--dept-primary": department.brand_primary,
    "--dept-bg": department.brand_secondary,
    "--dept-accent": department.brand_accent,
    "--dept-action": department.brand_action,
    "--dept-alert": department.brand_alert,
  } as CSSProperties;
  const dailyLogPreplans = dailyLogReference ? [
    ...(sourceData?.preplans || []).map((preplan) => ({ id: preplan.id, name: preplan.business_name, address: preplan.address })),
    ...dailyLogReference[1].map((preplan) => ({ id: preplan.id, name: preplan.property_name, address: preplan.address })),
  ].filter((preplan, index, all) => preplan.address && all.findIndex((candidate) => candidate.address.toLowerCase() === preplan.address.toLowerCase()) === index) : [];
  const dailyLogUnits = dailyLogReference ? [
    ...(sourceData?.apparatus || []).map((apparatus) => ({ id: apparatus.name, label: `${apparatus.asset_type}${apparatus.status ? ` · ${apparatus.status}` : ""}` })),
    ...dailyLogReference[2].map((asset) => ({ id: asset.unit_number || asset.name, label: `${asset.asset_type || asset.category || "Apparatus"}${asset.status ? ` · ${asset.status}` : ""}` })),
  ].filter((unit, index, all) => unit.id && all.findIndex((candidate) => candidate.id.toLowerCase() === unit.id.toLowerCase()) === index) : [];
  const dailyLogDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

  return (
    <main className={`department-app${stationDisplay ? " station-embedded" : ""}`} style={style} data-foundation-release={propagation.release} data-daily-log-equipment-accountability={foundation.daily_log_equipment_accountability ? "shown" : "hidden"}>
      {stationDisplay ? <StationIncidentMonitor departmentId={department.id} departmentSlug={department.slug} currentModule={active[0]} responseSeconds={foundation.response_duration_seconds} supportSessionId={ownerSupport ? supportSession.id : ""}/> : null}
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
            {!stationDisplay ? <StationDisplayButton displayUrl={`/d/${slug}?module=live-ops&station=1${supportQuery}`}/> : null}
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
          {active[0] === "live-ops" || active[0] === "respond" || active[0] === "scheduling" || active[0] === "payroll" ? (
            <div className="dept-foundation-rulebar">
              <span>Foundation</span>
              <b>{foundation.is_override ? "Department override" : "Owner master"}</b>
              <small>{active[0] === "scheduling" || active[0] === "payroll" ? `${foundation.shift_hours_on} on / ${foundation.shift_hours_off} off · ${foundation.shift_start_time} start · ${foundation.minimum_staffing > 0 ? `minimum ${foundation.minimum_staffing}` : "minimum not configured"} · OT ${foundation.overtime_threshold_hours} hours per ${foundation.overtime_period_days} days` : `${foundation.board_rotation_seconds}s rotation · ${foundation.response_duration_seconds}s response page`}</small>
            </div>
          ) : null}
          {active[0] === "live-ops" && moduleData ? (
            <LiveOpsBoard departmentId={department.id} departmentSlug={department.slug} departmentName={department.name} weatherLocation={department.weather_location} vehicleCount={department.vehicle_count} settings={foundation} data={moduleData} sourceData={sourceData} assets={liveOpsAssets} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} saveStatus={query.boardSaved === "1" ? "saved" : query.boardSaved === "0" ? "failed" : ""} />
          ) : active[0] === "command-center" && liveOpsData ? (
            <CommandCenterWorkspace departmentId={department.id} departmentName={department.name} supportQuery={supportQuery} source={source} sourceData={sourceData} connectionError={sourceConnectionError || undefined} liveOpsData={liveOpsData} assets={liveOpsAssets} settings={foundation}/>
          ) : active[0] === "respond" && moduleData ? (
            <ModuleBuilder moduleKey="respond" moduleName={active[1]} departmentId={department.id} data={moduleData} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} />
          ) : active[0] === "active-incident" && liveOpsData ? (
            <><ActiveIncidentWorkspace departmentId={department.id} departmentName={department.name} supportQuery={supportQuery} source={source} sourceData={sourceData} connectionError={sourceConnectionError || undefined} liveOpsData={liveOpsData} assets={liveOpsAssets} editable={editable}/>{editable ? <details className="live-ops-records"><summary>Manage active incident record</summary><ModuleBuilder moduleKey="live-ops" moduleName="Live Operations" departmentId={department.id} data={liveOpsData} editable supportSessionId={ownerSupport ? supportSession.id : ""} recordManagerOnly/></details> : null}</>
          ) : active[0] === "payroll" ? (
            <PayrollWorkspace departmentId={department.id} departmentName={department.name} supportQuery={supportQuery} source={source} sourceData={sourceData} connectionError={sourceConnectionError || undefined} settings={foundation} editable={editable}/>
          ) : active[0] === "daily-log" && dailyLogReference ? (
            <DailyLogWorkspace departmentId={department.id} departmentName={department.name} initialDate={dailyLogDate} initialItems={dailyLogReference[0].items} preplans={dailyLogPreplans} units={dailyLogUnits} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""}/>
          ) : sourceData && source ? (
            <>
              <StickneyWorkspace module={active[0]} departmentId={department.id} departmentSlug={department.slug} source={source} data={sourceData} minimumStaffing={foundation.minimum_staffing} scheduleRequests={scheduleRequests} selfEmployeeId={selfEmployeeId} editable={editable} supportSessionId={ownerSupport ? supportSession.id : ""} connectionError={sourceConnectionError || undefined} inventoryQuery={query.invQ || ""} inventoryUnit={query.invUnit || ""} inventoryPage={query.invPage || "1"} inventoryPhotoPage={query.photoPage || "1"} />
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
