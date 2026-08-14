import { Resend } from "resend";
import { decryptIntegrationSecret } from "@/app/lib/integration-crypto";
import { getDepartmentIntegration, markResendDelivery } from "@/app/lib/department-integrations";
import { readWebhookBody, storeWebhookEvent, WebhookInputError } from "@/app/lib/webhooks";

export async function POST(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const integration = await getDepartmentIntegration(departmentId);
  if (!integration.resend_enabled || !integration.resend_webhook_secret_cipher) return Response.json({ accepted: false, error: "Department Resend intake is not configured" }, { status: 503 });

  try {
    const raw = await readWebhookBody(request);
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) return Response.json({ accepted: false, error: "Missing webhook signature" }, { status: 401 });
    const resend = new Resend(integration.resend_api_key_cipher ? decryptIntegrationSecret(integration.resend_api_key_cipher) : "re_webhook_verification_only");
    const event = resend.webhooks.verify({
      payload: raw,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: decryptIntegrationSecret(integration.resend_webhook_secret_cipher),
    });
    if (event.type !== "email.received") return Response.json({ accepted: true, ignored: true, reason: "Event type is not enabled for department CAD email intake" });
    const recipients = event.data.to.map((value) => value.toLowerCase());
    if (integration.resend_receiving_address && !recipients.includes(integration.resend_receiving_address.toLowerCase())) {
      return Response.json({ accepted: true, ignored: true, reason: "Email is not addressed to this department" });
    }
    const attachments = Array.isArray(event.data.attachments) ? event.data.attachments : [];
    const normalized = {
      emailId: event.data.email_id,
      messageId: event.data.message_id || "",
      from: event.data.from,
      to: event.data.to,
      subject: event.data.subject || "",
      attachmentCount: attachments.length,
      receivedAt: event.data.created_at,
      departmentId,
      contentStatus: integration.resend_api_key_cipher ? "retrieval_authorized" : "metadata_only",
      routingStatus: "department_mapped_not_dispatched",
    };
    const stored = await storeWebhookEvent({
      source: `resend:${departmentId}`,
      externalId: event.data.email_id,
      eventType: event.type,
      summary: `Inbound department email: ${event.data.subject || "No subject"}`,
      normalized,
      rawPayload: raw,
      departmentId,
      status: "mapped_not_dispatched",
    });
    await markResendDelivery(departmentId);
    return Response.json({ accepted: true, duplicate: stored.duplicate, departmentId, status: "mapped_not_dispatched" }, { status: stored.duplicate ? 200 : 202 });
  } catch (error) {
    if (error instanceof WebhookInputError) return Response.json({ accepted: false, error: error.message }, { status: error.status });
    return Response.json({ accepted: false, error: "Invalid Resend webhook" }, { status: 401 });
  }
}
