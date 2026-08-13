import { db, id, now } from "@/db/access";

const MAX_WEBHOOK_BYTES = 256 * 1024;

type RuntimeSecrets = {
  CAD_WEBHOOK_SECRET?: string;
  RESEND_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
};

export type StoredWebhookEvent = {
  id: string;
  source: string;
  external_id: string;
  event_type: string;
  status: string;
  department_id: string | null;
  summary: string;
  received_at: string;
  processed_at: string | null;
};

export function webhookSecrets(): RuntimeSecrets {
  return {
    CAD_WEBHOOK_SECRET: process.env.CAD_WEBHOOK_SECRET,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  };
}

export function webhookReadiness() {
  const secrets = webhookSecrets();
  return {
    cadConfigured: Boolean(secrets.CAD_WEBHOOK_SECRET),
    resendConfigured: Boolean(secrets.RESEND_WEBHOOK_SECRET),
    resendContentConfigured: Boolean(secrets.RESEND_API_KEY),
  };
}

export async function readWebhookBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    throw new WebhookInputError("Payload too large", 413);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_WEBHOOK_BYTES) {
    throw new WebhookInputError("Payload too large", 413);
  }
  if (!raw.trim()) throw new WebhookInputError("Empty payload", 400);
  return raw;
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new WebhookInputError("Invalid JSON", 400);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WebhookInputError("JSON object required", 400);
  }
  return value as Record<string, unknown>;
}

export async function verifyCadSignature(raw: string, headerValue: string | null, secret: string) {
  const supplied = (headerValue || "").trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");
  let mismatch = expected.length ^ supplied.length;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ (supplied.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function firstText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 500);
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export async function storeWebhookEvent(input: {
  source: string;
  externalId: string;
  eventType: string;
  summary: string;
  normalized: Record<string, unknown>;
  rawPayload: string;
}) {
  const result = await db().prepare("INSERT OR IGNORE INTO webhook_events (id,source,external_id,event_type,status,department_id,summary,normalized_json,raw_payload,received_at,processed_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL)")
    .bind(id("wh"), input.source, input.externalId, input.eventType, "received", null, input.summary.slice(0, 500), JSON.stringify(input.normalized), input.rawPayload, now())
    .run();
  return { duplicate: Number(result.meta.changes || 0) === 0 };
}

export async function listWebhookEvents(limit = 30): Promise<StoredWebhookEvent[]> {
  const result = await db().prepare("SELECT id,source,external_id,event_type,status,department_id,summary,received_at,processed_at FROM webhook_events ORDER BY received_at DESC LIMIT ?")
    .bind(Math.max(1, Math.min(limit, 100)))
    .all<StoredWebhookEvent>();
  return result.results;
}

export class WebhookInputError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
