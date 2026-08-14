import { headers } from "next/headers";
import { requireOwnerUser } from "@/app/chatgpt-auth";
import { isOwner, upsertIdentity } from "@/db/access";
import { listWebhookEvents, webhookReadiness } from "@/app/lib/webhooks";
import { mapsConfigured } from "@/app/lib/maps";

export const dynamic = "force-dynamic";

function Status({ ready, readyLabel = "Configured" }: { ready: boolean; readyLabel?: string }) {
  return <span className={`integration-status ${ready ? "ready" : "waiting"}`}><i/>{ready ? readyLabel : "Setup required"}</span>;
}

export default async function OwnerIntegrations() {
  const user = await requireOwnerUser("/owner/integrations");
  await upsertIdentity(user);
  if (!await isOwner(user.userId)) return <main className="access-shell"><section className="owner-claim"><div className="access-kicker">ACCESS DENIED</div><h1>Owner access required.</h1><p>This setup contains protected integration details and event history.</p><a className="access-primary" href="/portal">Go to department sign in</a></section></main>;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "your-preplan360-site.example";
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const baseUrl = `${protocol}://${host}`;
  const readiness = webhookReadiness();
  const events = await listWebhookEvents();

  return <main className="access-shell owner-shell">
    <header className="access-header"><a href="/owner" className="access-brand">PrePlan <span>360</span><small>Integration control</small></a><div className="access-account"><span>Platform owner · {user.displayName}</span><a href="/owner">← Owner console</a></div></header>
    <section className="access-page integration-page">
      <div className="owner-title"><div><div className="access-kicker">OWNER · INTEGRATIONS</div><h1>CAD & inbound email webhooks</h1><p>Secure endpoints are built and waiting for each department’s provider mapping. Receiving an event never tones out or creates a live incident until that mapping is approved and tested.</p></div><span className="owner-secure"><i/> Secrets stay server-side</span></div>
      <div className="integration-truth"><b>Foundation ready · live connection not configured</b><span>Add the keys below, connect each provider, then complete one signed end-to-end test before changing this status.</span></div>
      <div className="integration-grid">
        <article className="integration-card"><div className="integration-card-head"><div><span>MAPS</span><h2>Department Google Maps</h2></div><Status ready={mapsConfigured()} readyLabel="Basemap active"/></div><div className="integration-label">Shared browser-key setting</div><code>GOOGLE_MAPS_BROWSER_KEY</code><div className="integration-label">Optional department-key JSON</div><code>GOOGLE_MAPS_DEPARTMENT_KEYS_JSON</code><ol><li>Enable Maps JavaScript API in the Google Cloud project.</li><li>Restrict each browser key to approved HTTPS referrers, including this production domain.</li><li>Use JSON such as <code>{`{"stickney":"key","fermilab":"key"}`}</code> only when departments need separate billing or restrictions.</li><li>Redeploy, open a department Pre-Plans page, and confirm the status reads Google map active.</li></ol><p>The key is browser-visible by design. API and HTTP-referrer restrictions are required. The fictional owner demo uses its local district map so fictional addresses are never presented as real locations.</p></article>
        <article className="integration-card"><div className="integration-card-head"><div><span>DIRECT CAD</span><h2>Signed CAD intake</h2></div><Status ready={readiness.cadConfigured}/></div><div className="integration-label">Webhook URL</div><code>{baseUrl}/api/webhooks/cad</code><div className="integration-label">Server-only setting</div><code>CAD_WEBHOOK_SECRET</code><ol><li>Create a long random signing secret in the CAD provider and add the same value to the hosted environment.</li><li>Sign the exact raw JSON body with HMAC-SHA256.</li><li>Send <code>x-preplan-signature: sha256=&lt;hex&gt;</code>, plus a stable correlation ID.</li><li>Verify the event below, then approve department routing and incident rules.</li></ol></article>
        <article className="integration-card"><div className="integration-card-head"><div><span>RESEND</span><h2>Inbound CAD email</h2></div><Status ready={readiness.resendConfigured}/></div><div className="integration-label">Webhook URL</div><code>{baseUrl}/api/webhooks/resend</code><div className="integration-label">Required server-only setting</div><code>RESEND_WEBHOOK_SECRET</code><div className="integration-label">Optional future content retrieval</div><div className="integration-inline"><code>RESEND_API_KEY</code><Status ready={readiness.resendContentConfigured} readyLabel="Available"/></div><ol><li>In Resend, add this URL as a webhook and select <code>email.received</code>.</li><li>Copy that webhook’s signing secret into the hosted environment.</li><li>Use a Resend receiving address or a separate receiving subdomain.</li><li>Metadata is recorded now; body and attachment retrieval stays off until an API key and department rules are approved.</li></ol></article>
      </div>
      <section className="integration-history"><div className="owner-section-head"><div><span>DELIVERY AUDIT</span><h2>Recent verified events</h2></div><b>{events.length} shown</b></div>{events.length ? <div className="integration-events">{events.map((event) => <article key={event.id}><time>{new Date(event.received_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</time><div><b>{event.source} · {event.event_type}</b><p>{event.summary}</p></div><span className="integration-event-state">{event.status.replaceAll("_", " ")}</span></article>)}</div> : <div className="access-empty compact"><p>No signed webhook deliveries have been recorded. This is the correct state until setup and testing begin.</p></div>}</section>
    </section>
  </main>;
}
