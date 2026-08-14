import { Resend } from "resend";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { audit, canAdminDepartment, db, getDepartment, now } from "@/db/access";
import { decryptIntegrationSecret, encryptIntegrationSecret, hmacSha256, integrationEncryptionReady } from "@/app/lib/integration-crypto";
import { deliverDepartmentExport, validateDepartmentExportUrl } from "@/app/lib/department-export";
import { ensureDepartmentIntegration, getDepartmentIntegration } from "@/app/lib/department-integrations";

function enabled(form: FormData, name: string) {
  return form.get(name) === "on";
}

function field(form: FormData, name: string, max = 500) {
  return String(form.get(name) || "").trim().slice(0, max);
}

function messageRedirect(request: Request, departmentId: string, status: "ok" | "error", message: string) {
  const target = new URL(`/departments/${departmentId}`, request.url);
  target.searchParams.set("integration_status", status);
  target.searchParams.set("integration_message", message.slice(0, 240));
  target.hash = "integrations";
  return Response.redirect(target, 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!(await canAdminDepartment(user.userId, id))) return new Response("Department administrator access required", { status: 403 });
  if (!await getDepartment(id)) return new Response("Department not found", { status: 404 });

  const form = await request.formData();
  const intent = field(form, "intent", 60);
  await ensureDepartmentIntegration(id, user.userId);

  try {
    if (intent === "save-maps") {
      const current = await getDepartmentIntegration(id);
      const browserKey = field(form, "google_browser_key", 300);
      const clearKey = enabled(form, "clear_google_browser_key");
      const savedKey = clearKey ? "" : browserKey || current.google_browser_key;
      const mapsEnabled = enabled(form, "maps_enabled");
      const streetViewEnabled = enabled(form, "street_view_enabled");
      const routesEnabled = enabled(form, "routes_enabled");
      const mapId = field(form, "google_map_id", 160);
      const changed = savedKey !== current.google_browser_key || mapId !== current.google_map_id || Number(mapsEnabled) !== current.maps_enabled || Number(streetViewEnabled) !== current.street_view_enabled || Number(routesEnabled) !== current.routes_enabled;
      await db().prepare("UPDATE department_integrations SET maps_enabled=?,street_view_enabled=?,routes_enabled=?,google_browser_key=?,google_map_id=?,google_verified_at=CASE WHEN ? THEN NULL ELSE google_verified_at END,google_verification_json=CASE WHEN ? THEN '{}' ELSE google_verification_json END,updated_by=?,updated_at=? WHERE department_id=?")
        .bind(mapsEnabled ? 1 : 0, streetViewEnabled ? 1 : 0, routesEnabled ? 1 : 0, savedKey, mapId, changed ? 1 : 0, changed ? 1 : 0, user.userId, now(), id).run();
      await audit(user.userId, id, "department_maps_integration_updated", `Google Maps ${mapsEnabled ? "enabled" : "disabled"}; Street View ${streetViewEnabled ? "enabled" : "disabled"}; Routes ${routesEnabled ? "enabled" : "disabled"}.`);
      return messageRedirect(request, id, "ok", changed ? "Google settings saved. Run the browser verification before treating them as live." : "Google settings saved.");
    }

    if (intent === "save-cad") {
      const current = await getDepartmentIntegration(id);
      const secret = field(form, "cad_signing_secret", 500);
      if (secret && !integrationEncryptionReady()) throw new Error("Secure integration storage is not configured.");
      const savedSecret = secret ? encryptIntegrationSecret(secret) : current.cad_signing_secret_cipher;
      const cadEnabled = enabled(form, "cad_enabled");
      const provider = field(form, "cad_provider", 80);
      const changed = savedSecret !== current.cad_signing_secret_cipher || provider !== current.cad_provider || Number(cadEnabled) !== current.cad_enabled;
      await db().prepare("UPDATE department_integrations SET cad_enabled=?,cad_provider=?,cad_signing_secret_cipher=?,cad_verified_at=CASE WHEN ? THEN NULL ELSE cad_verified_at END,updated_by=?,updated_at=? WHERE department_id=?")
        .bind(cadEnabled ? 1 : 0, provider, savedSecret, changed ? 1 : 0, user.userId, now(), id).run();
      await audit(user.userId, id, "department_cad_integration_updated", `Signed CAD intake ${cadEnabled ? "enabled" : "disabled"} for ${provider || "unselected provider"}.`);
      return messageRedirect(request, id, "ok", "CAD setup saved. Run the safe signed test before using the provider endpoint.");
    }

    if (intent === "test-cad") {
      const integration = await getDepartmentIntegration(id);
      if (!integration.cad_enabled || !integration.cad_signing_secret_cipher) throw new Error("Enable CAD intake and save a signing secret first.");
      const secret = decryptIntegrationSecret(integration.cad_signing_secret_cipher);
      const raw = JSON.stringify({ correlationId: `integration-test-${crypto.randomUUID()}`, eventType: "integration.test", address: "SAFE TEST — no operational dispatch", dispatchedAt: now(), units: [] });
      const response = await fetch(`${new URL(request.url).origin}/api/webhooks/cad/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-preplan-signature": `sha256=${hmacSha256(raw, secret)}`, "x-cad-provider": integration.cad_provider || "department-test" },
        body: raw,
      });
      if (!response.ok) throw new Error(`Signed CAD test returned HTTP ${response.status}.`);
      await audit(user.userId, id, "department_cad_integration_verified", "Safe signed CAD test was accepted and stored without dispatching an incident.");
      return messageRedirect(request, id, "ok", "Signed CAD test accepted and audited. No live incident was created.");
    }

    if (intent === "save-resend") {
      const current = await getDepartmentIntegration(id);
      const apiKey = field(form, "resend_api_key", 500);
      const webhookSecret = field(form, "resend_webhook_secret", 500);
      if ((apiKey || webhookSecret) && !integrationEncryptionReady()) throw new Error("Secure integration storage is not configured.");
      const savedApiKey = apiKey ? encryptIntegrationSecret(apiKey) : current.resend_api_key_cipher;
      const savedWebhookSecret = webhookSecret ? encryptIntegrationSecret(webhookSecret) : current.resend_webhook_secret_cipher;
      const receivingAddress = field(form, "resend_receiving_address", 254).toLowerCase();
      if (receivingAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receivingAddress)) throw new Error("Enter a valid Resend receiving email address.");
      const resendEnabled = enabled(form, "resend_enabled");
      const changed = savedApiKey !== current.resend_api_key_cipher || savedWebhookSecret !== current.resend_webhook_secret_cipher || receivingAddress !== current.resend_receiving_address || Number(resendEnabled) !== current.resend_enabled;
      await db().prepare("UPDATE department_integrations SET resend_enabled=?,resend_receiving_address=?,resend_api_key_cipher=?,resend_webhook_secret_cipher=?,resend_provider_verified_at=CASE WHEN ? THEN NULL ELSE resend_provider_verified_at END,updated_by=?,updated_at=? WHERE department_id=?")
        .bind(resendEnabled ? 1 : 0, receivingAddress, savedApiKey, savedWebhookSecret, changed ? 1 : 0, user.userId, now(), id).run();
      await audit(user.userId, id, "department_resend_integration_updated", `Resend inbound email ${resendEnabled ? "enabled" : "disabled"}; receiving address ${receivingAddress || "not set"}.`);
      return messageRedirect(request, id, "ok", "Resend settings saved. Provision the webhook to verify the API key and endpoint.");
    }

    if (intent === "provision-resend") {
      const integration = await getDepartmentIntegration(id);
      if (!integration.resend_enabled || !integration.resend_api_key_cipher) throw new Error("Enable Resend and save an API key first.");
      if (!integration.resend_receiving_address) throw new Error("Save the department receiving address first.");
      const resend = new Resend(decryptIntegrationSecret(integration.resend_api_key_cipher));
      const endpoint = `${new URL(request.url).origin}/api/webhooks/resend/${encodeURIComponent(id)}`;
      const listed = await resend.webhooks.list();
      if (listed.error) throw new Error(`Resend API verification failed: ${listed.error.message}`);
      const existing = listed.data?.data.find((item) => item.endpoint === endpoint);
      const result = existing ? await resend.webhooks.get(existing.id) : await resend.webhooks.create({ endpoint, events: ["email.received"] });
      if (result.error || !result.data?.signing_secret) throw new Error(`Resend webhook setup failed: ${result.error?.message || "No signing secret returned"}`);
      const at = now();
      await db().prepare("UPDATE department_integrations SET resend_webhook_secret_cipher=?,resend_webhook_id=?,resend_provider_verified_at=?,updated_by=?,updated_at=? WHERE department_id=?")
        .bind(encryptIntegrationSecret(result.data.signing_secret), result.data.id, at, user.userId, at, id).run();
      await audit(user.userId, id, "department_resend_provider_verified", existing ? "Existing Resend email.received webhook was verified." : "Resend email.received webhook was created and its signing secret stored encrypted.");
      return messageRedirect(request, id, "ok", existing ? "Existing Resend webhook verified." : "Resend webhook created and signing secret stored securely.");
    }

    if (intent === "save-export") {
      const current = await getDepartmentIntegration(id);
      const endpoint = field(form, "nightly_export_url", 1000);
      const exportEnabled = enabled(form, "nightly_export_enabled");
      if (endpoint) await validateDepartmentExportUrl(endpoint);
      if (exportEnabled && !endpoint) throw new Error("Enter the department server HTTPS endpoint before enabling nightly export.");
      const secret = field(form, "nightly_export_secret", 500);
      if (secret && !integrationEncryptionReady()) throw new Error("Secure integration storage is not configured.");
      const savedSecret = secret ? encryptIntegrationSecret(secret) : current.nightly_export_secret_cipher;
      if (exportEnabled && !savedSecret) throw new Error("Create a signing secret before enabling nightly export.");
      const changed = endpoint !== current.nightly_export_url || savedSecret !== current.nightly_export_secret_cipher;
      await db().prepare("UPDATE department_integrations SET nightly_export_enabled=?,nightly_export_url=?,nightly_export_secret_cipher=?,nightly_export_verified_at=CASE WHEN ? THEN NULL ELSE nightly_export_verified_at END,nightly_export_last_status=CASE WHEN ? THEN 'verification_required' ELSE nightly_export_last_status END,updated_by=?,updated_at=? WHERE department_id=?")
        .bind(exportEnabled ? 1 : 0, endpoint, savedSecret, changed ? 1 : 0, changed ? 1 : 0, user.userId, now(), id).run();
      await audit(user.userId, id, "department_nightly_export_updated", `Nightly signed export ${exportEnabled ? "enabled" : "disabled"}; endpoint ${endpoint ? "saved" : "not set"}.`);
      return messageRedirect(request, id, "ok", "Nightly export settings saved. Test the department server before the scheduled job can send.");
    }

    if (intent === "test-export" || intent === "send-export") {
      const integration = await getDepartmentIntegration(id);
      if (!integration.nightly_export_url || !integration.nightly_export_secret_cipher) throw new Error("Save an HTTPS endpoint and signing secret first.");
      const delivery = await deliverDepartmentExport(integration, intent === "test-export" ? "connection_test" : "manual");
      await audit(user.userId, id, intent === "test-export" ? "department_export_verified" : "department_export_sent", delivery.summary);
      return messageRedirect(request, id, "ok", intent === "test-export" ? "Department server accepted the signed connection test." : "Full department snapshot accepted by the department server.");
    }

    throw new Error("Unknown integration action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integration action failed.";
    await audit(user.userId, id, "department_integration_error", `${intent || "unknown"}: ${message}`);
    return messageRedirect(request, id, "error", message);
  }
}
