import { firstText, parseJsonObject, readWebhookBody, sha256, storeWebhookEvent, verifyCadSignature, WebhookInputError, webhookSecrets } from "@/app/lib/webhooks";

export async function POST(request: Request) {
  const secret = webhookSecrets().CAD_WEBHOOK_SECRET;
  if (!secret) return Response.json({ accepted: false, error: "CAD webhook is not configured" }, { status: 503 });

  try {
    const raw = await readWebhookBody(request);
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
      routingStatus: "awaiting_department_mapping",
    };
    const stored = await storeWebhookEvent({
      source: (request.headers.get("x-cad-provider") || "cad").slice(0, 80),
      externalId,
      eventType,
      summary: [eventType, address].filter(Boolean).join(" at ") || "Signed CAD event received",
      normalized,
      rawPayload: raw,
    });
    return Response.json({ accepted: true, duplicate: stored.duplicate, status: "received_not_dispatched" }, { status: stored.duplicate ? 200 : 202 });
  } catch (error) {
    if (error instanceof WebhookInputError) return Response.json({ accepted: false, error: error.message }, { status: error.status });
    return Response.json({ accepted: false, error: "Webhook could not be accepted" }, { status: 500 });
  }
}
