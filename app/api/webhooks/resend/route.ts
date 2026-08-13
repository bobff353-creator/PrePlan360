import { Resend } from "resend";
import { readWebhookBody, storeWebhookEvent, WebhookInputError, webhookSecrets } from "@/app/lib/webhooks";

export async function POST(request: Request) {
  const secrets = webhookSecrets();
  const secret = secrets.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ accepted: false, error: "Resend webhook is not configured" }, { status: 503 });
  const resend = new Resend(secrets.RESEND_API_KEY || "re_webhook_verification_only");

  try {
    const raw = await readWebhookBody(request);
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return Response.json({ accepted: false, error: "Missing webhook signature" }, { status: 401 });
    }
    const event = resend.webhooks.verify({
      payload: raw,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: secret,
    });
    if (event.type !== "email.received") {
      return Response.json({ accepted: true, ignored: true, reason: "Event type is not enabled for CAD email intake" });
    }

    const data = event.data;
    const externalId = data.email_id;
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    const normalized = {
      emailId: data.email_id,
      messageId: data.message_id || "",
      from: data.from,
      to: data.to,
      subject: data.subject || "",
      attachmentCount: attachments.length,
      receivedAt: data.created_at,
      contentStatus: webhookSecrets().RESEND_API_KEY ? "available_for_future_retrieval" : "metadata_only",
      routingStatus: "awaiting_department_mapping",
    };
    const stored = await storeWebhookEvent({
      source: "resend",
      externalId,
      eventType: event.type,
      summary: `Inbound email: ${data.subject || "No subject"}`,
      normalized,
      rawPayload: raw,
    });
    return Response.json({ accepted: true, duplicate: stored.duplicate, status: "received_not_dispatched" }, { status: stored.duplicate ? 200 : 202 });
  } catch (error) {
    if (error instanceof WebhookInputError) return Response.json({ accepted: false, error: error.message }, { status: error.status });
    return Response.json({ accepted: false, error: "Invalid Resend webhook" }, { status: 401 });
  }
}
