import type { Department } from "@/db/access";
import type { DepartmentExportDelivery, DepartmentIntegration } from "@/app/lib/department-integrations";
import { GeneratedSecretField, GoogleIntegrationTest } from "@/app/departments/google-integration-test";

function IntegrationStatus({ configured, verified, verifiedLabel = "Verified" }: { configured: boolean; verified: boolean; verifiedLabel?: string }) {
  const label = verified ? verifiedLabel : configured ? "Verification required" : "Not configured";
  return <span className={`integration-status ${verified ? "ready" : "waiting"}`}><i/>{label}</span>;
}

function When({ value, empty = "Never" }: { value: string | null; empty?: string }) {
  return <>{value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago" }) : empty}</>;
}

function SubmitAction({ intent, children, secondary = false }: { intent: string; children: React.ReactNode; secondary?: boolean }) {
  return <button className={secondary ? "access-secondary" : "access-primary"} type="submit" name="intent" value={intent}>{children}</button>;
}

export function DepartmentIntegrationCenter({ department, integration, deliveries, baseUrl, encryptionReady, status, message }: {
  department: Department;
  integration: DepartmentIntegration;
  deliveries: DepartmentExportDelivery[];
  baseUrl: string;
  encryptionReady: boolean;
  status?: string;
  message?: string;
}) {
  const cadConfigured = Boolean(integration.cad_enabled && integration.cad_signing_secret_cipher);
  const resendConfigured = Boolean(integration.resend_enabled && integration.resend_api_key_cipher && integration.resend_receiving_address);
  const mapsConfigured = Boolean(integration.maps_enabled && integration.google_browser_key);
  const exportConfigured = Boolean(integration.nightly_export_enabled && integration.nightly_export_url && integration.nightly_export_secret_cipher);
  const action = `/api/departments/${department.id}/integrations`;
  return <section className="department-integrations" id="integrations">
    <div className="department-integration-heading"><div><span>DEPARTMENT CONNECTIONS</span><h2>Integration Center</h2><p>Configure this department’s maps, CAD intake, Resend email routing, and optional signed server backup. Saved is not the same as live: every card shows whether its real provider path has been verified.</p></div><span className={`integration-vault ${encryptionReady ? "ready" : "waiting"}`}><i/>{encryptionReady ? "Encrypted secret vault ready" : "Secret vault setup required"}</span></div>
    {status && message ? <div className={`integration-message ${status}`} role="status">{message}</div> : null}
    <div className="integration-center-grid">
      <details className="department-integration-card" open>
        <summary><span><i className="maps"/><b>Google Maps platform</b><small>Maps · Street View · Routes</small></span><IntegrationStatus configured={mapsConfigured} verified={Boolean(integration.google_verified_at)}/></summary>
        <div className="department-integration-body">
          <p className="integration-purpose">One restricted browser key powers the department basemap, building footprints, hydrants, Street View fallback, and route checks. The key is browser-visible by design and must be limited to this production domain and only the enabled Google APIs.</p>
          <form method="post" action={action} className="integration-form">
            <label className="integration-switch"><input type="checkbox" name="maps_enabled" defaultChecked={Boolean(integration.maps_enabled)}/><span>Enable Google basemap for this department</span></label>
            <label className="integration-switch"><input type="checkbox" name="street_view_enabled" defaultChecked={Boolean(integration.street_view_enabled)}/><span>Enable Street View / A-side fallback</span></label>
            <label className="integration-switch"><input type="checkbox" name="routes_enabled" defaultChecked={Boolean(integration.routes_enabled)}/><span>Enable Google Routes checks</span></label>
            <label className="wide">Restricted Google browser key<input type="password" name="google_browser_key" autoComplete="new-password" placeholder={integration.google_browser_key ? "Saved — leave blank to keep" : "Paste the HTTP-referrer restricted key"}/><small>Required Google services: Maps JavaScript API; add Routes API when Routes is enabled. Restrict websites to this production domain.</small></label>
            <label>Google Map ID<input name="google_map_id" defaultValue={integration.google_map_id} placeholder="Optional styled map ID"/></label>
            <label className="integration-switch compact"><input type="checkbox" name="clear_google_browser_key"/><span>Remove saved browser key</span></label>
            <div className="integration-actions wide"><SubmitAction intent="save-maps">Save Google setup</SubmitAction><a className="access-secondary" href={`/d/${department.slug}?module=preplans`}>Open department map ↗</a></div>
          </form>
          <GoogleIntegrationTest departmentId={department.id} departmentSlug={department.slug} weatherLocation={department.weather_location}/>
          <dl className="integration-facts"><div><dt>Production referrer</dt><dd>{`${baseUrl}/*`}</dd></div><div><dt>Last browser verification</dt><dd><When value={integration.google_verified_at}/></dd></div></dl>
        </div>
      </details>

      <details className="department-integration-card" open>
        <summary><span><i className="cad"/><b>Direct CAD webhook</b><small>Signed JSON · department routed</small></span><IntegrationStatus configured={cadConfigured} verified={Boolean(integration.cad_verified_at)} verifiedLabel="Signed delivery verified"/></summary>
        <div className="department-integration-body">
          <p className="integration-purpose">Each department gets its own endpoint and signing secret. A valid delivery is stored, deduplicated, and routed to this department, but it does not tone out or open an operational incident until dispatch rules are separately approved.</p>
          <code className="integration-endpoint">{baseUrl}/api/webhooks/cad/{department.id}</code>
          <form method="post" action={action} className="integration-form">
            <label className="integration-switch"><input type="checkbox" name="cad_enabled" defaultChecked={Boolean(integration.cad_enabled)}/><span>Enable signed CAD intake</span></label>
            <label>CAD provider<input name="cad_provider" defaultValue={integration.cad_provider} placeholder="Bryx, IamResponding, CentralSquare…"/></label>
            <GeneratedSecretField name="cad_signing_secret" label="HMAC-SHA256 signing secret" saved={Boolean(integration.cad_signing_secret_cipher)}/>
            <div className="integration-actions wide"><SubmitAction intent="save-cad">Save CAD setup</SubmitAction><SubmitAction intent="test-cad" secondary>Run safe signed test</SubmitAction></div>
          </form>
          <div className="integration-code-notes"><span>Header</span><code>x-preplan-signature: sha256=&lt;HMAC of raw JSON&gt;</code><span>Idempotency</span><code>correlationId or x-idempotency-key</code></div>
          <dl className="integration-facts"><div><dt>Last verified signed delivery</dt><dd><When value={integration.cad_verified_at}/></dd></div><div><dt>Last CAD event</dt><dd><When value={integration.cad_last_event_at}/></dd></div></dl>
        </div>
      </details>

      <details className="department-integration-card">
        <summary><span><i className="email"/><b>Resend inbound CAD email</b><small>Receiving address · verified webhook</small></span><IntegrationStatus configured={resendConfigured} verified={Boolean(integration.resend_provider_verified_at)} verifiedLabel="Provider connected"/></summary>
        <div className="department-integration-body">
          <p className="integration-purpose">Save the department’s Resend API key and receiving address, then let PrePlan 360 create or verify the email.received webhook. Resend signatures are checked against the raw request before metadata is stored.</p>
          <code className="integration-endpoint">{baseUrl}/api/webhooks/resend/{department.id}</code>
          <form method="post" action={action} className="integration-form">
            <label className="integration-switch"><input type="checkbox" name="resend_enabled" defaultChecked={Boolean(integration.resend_enabled)}/><span>Enable inbound CAD email</span></label>
            <label>Department receiving address<input type="email" name="resend_receiving_address" defaultValue={integration.resend_receiving_address} placeholder="calls@dispatch.department.gov"/></label>
            <label className="wide">Resend API key<input type="password" name="resend_api_key" autoComplete="new-password" placeholder={integration.resend_api_key_cipher ? "Saved securely — leave blank to keep" : "re_…"}/></label>
            <label className="wide">Webhook signing secret (manual setup only)<input type="password" name="resend_webhook_secret" autoComplete="new-password" placeholder={integration.resend_webhook_secret_cipher ? "Saved securely — leave blank to keep" : "Provision automatically below or paste whsec_…"}/></label>
            <div className="integration-actions wide"><SubmitAction intent="save-resend">Save Resend setup</SubmitAction><SubmitAction intent="provision-resend" secondary>Provision / verify webhook</SubmitAction></div>
          </form>
          <dl className="integration-facts"><div><dt>Provider verified</dt><dd><When value={integration.resend_provider_verified_at}/></dd></div><div><dt>Last signed inbound email</dt><dd><When value={integration.resend_last_event_at}/></dd></div><div><dt>Webhook ID</dt><dd>{integration.resend_webhook_id || "Not provisioned"}</dd></div></dl>
        </div>
      </details>

      <details className="department-integration-card" open>
        <summary><span><i className="export"/><b>Department server backup</b><small>Signed nightly snapshot · opt in</small></span><IntegrationStatus configured={exportConfigured} verified={Boolean(integration.nightly_export_verified_at)} verifiedLabel="Server accepted test"/></summary>
        <div className="department-integration-body">
          <p className="integration-purpose">At 07:00 UTC nightly (1:00 a.m. CST / 2:00 a.m. CDT), PrePlan 360 can send this department’s saved profile, members, preplans, hydrants, apparatus, inventory, module records, settings, and sanitized event history to a department-owned HTTPS endpoint. Passwords, sessions, API keys, signing secrets, and raw webhook payloads are excluded.</p>
          <form method="post" action={action} className="integration-form">
            <label className="integration-switch"><input type="checkbox" name="nightly_export_enabled" defaultChecked={Boolean(integration.nightly_export_enabled)}/><span>Enable nightly signed department snapshot</span></label>
            <label className="wide">Department server HTTPS endpoint<input type="url" name="nightly_export_url" defaultValue={integration.nightly_export_url} placeholder="https://records.department.gov/api/preplan360-backup"/></label>
            <GeneratedSecretField name="nightly_export_secret" label="Department server HMAC signing secret" saved={Boolean(integration.nightly_export_secret_cipher)}/>
            <div className="integration-actions wide"><SubmitAction intent="save-export">Save backup setup</SubmitAction><SubmitAction intent="test-export" secondary>Send signed connection test</SubmitAction><SubmitAction intent="send-export" secondary>Send full snapshot now</SubmitAction></div>
          </form>
          <div className="integration-code-notes"><span>Signature input</span><code>&lt;x-preplan-timestamp&gt;.&lt;raw JSON body&gt;</code><span>Header</span><code>x-preplan-signature: sha256=&lt;hex HMAC&gt;</code></div>
          <dl className="integration-facts"><div><dt>Server verified</dt><dd><When value={integration.nightly_export_verified_at}/></dd></div><div><dt>Last success</dt><dd><When value={integration.nightly_export_last_success_at}/></dd></div><div><dt>Last status</dt><dd>{integration.nightly_export_last_status.replaceAll("_", " ")}</dd></div></dl>
          <div className="integration-deliveries"><h3>Recent export delivery audit</h3>{deliveries.length ? deliveries.map((delivery) => <article key={delivery.id}><time><When value={delivery.created_at}/></time><b>{delivery.delivery_mode.replaceAll("_", " ")}</b><span className={delivery.status}>{delivery.status}{delivery.http_status ? ` · HTTP ${delivery.http_status}` : ""}</span><p>{delivery.summary}</p></article>) : <p>No export attempts yet. Nothing leaves PrePlan 360 until the department server accepts a signed test.</p>}</div>
        </div>
      </details>
    </div>
  </section>;
}
