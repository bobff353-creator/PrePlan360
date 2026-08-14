import { decryptIntegrationSecret } from "@/app/lib/integration-crypto";
import { getDepartmentIntegration, markCadDelivery } from "@/app/lib/department-integrations";
import { firstText, parseJsonObject, readWebhookBody, sha256, storeWebhookEvent, verifyCadSignature, WebhookInputError } from "@/app/lib/webhooks";

export async function POST(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const integration = await getDepartmentIntegration(departmentId);
  if (!integration.cad_enabled || !integration.cad_signing_secret_cipher) return Response.json({ accepted: false, error: "Department CAD intake is not configured" }, { status: 503 });

  try {
    const raw = await readWebhookBody(request);
    const secret = decryptIntegrationSecret(integration.cad_signing_secret_cipher);
    const valid = await verifyCadSignature(raw, request.headers.get("x-preplan-signature") || request.headers.get("x-fireflow-signature") || request.headers.get("x-cad-signature"), secret);
    if (!valid) return Response.json({ accepted: false, error: "Invalid signature" }, { status: 401 });

    const payload = parseJsonObject(raw);
    const externalId = firstText(payload, ["correlationId", "callId", "incidentId", "eventId", "id"]) || request.headers.get("x-idempotency-key")?.slice(0, 200) || await sha256(raw);
    const eventType = firstText(payload, ["eventType", "type", "nature", "incidentType"]) || "cad.event";
    const address = firstText(payload, ["address", "location", "dispatchAddress"]);
    const normalized = {
      correlationId: externalId,
      eventType,
      address,
      latitude: firstText(payload, ["latitude", "lat"]),
      longitude: firstText(payload, ["longitude", "lng", "lon"]),
      dispatchedAt: firstText(payload, ["dispatchedAt", "dispatchTime", "timestamp", "createdAt"]),
      units: Array.isArray(payload.units) ? payload.units.slice(0, 50) : [],
      departmentId,
      routingStatus: "department_mapped_not_dispatched",
    };
    const provider = (request.headers.get("x-cad-provider") || integration.cad_provider || "cad").slice(0, 80);
    const stored = await storeWebhookEvent({
      source: `${provider}:${departmentId}`,
      externalId,
      eventType,
      summary: [eventType, address].filter(Boolean).join(" at ") || "Signed department CAD event received",
      normalized,
      rawPayload: raw,
      departmentId,
      status: "mapped_not_dispatched",
    });
    await markCadDelivery(departmentId);
    return Response.json({ accepted: true, duplicate: stored.duplicate, departmentId, status: "mapped_not_dispatched" }, { status: stored.duplicate ? 200 : 202 });
  } catch (error) {
    if (error instanceof WebhookInputError) return Response.json({ accepted: false, error: error.message }, { status: error.status });
    return Response.json({ accepted: false, error: "Webhook could not be accepted" }, { status: 500 });
  }
}
