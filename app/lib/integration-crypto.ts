import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = "v1";

function encryptionKey(): Buffer {
  const configured = String(process.env.INTEGRATION_ENCRYPTION_KEY || "").trim();
  if (!configured) throw new Error("Secure integration storage is not configured.");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function integrationEncryptionReady() {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptIntegrationSecret(value: string) {
  const secret = value.trim();
  if (!secret) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptIntegrationSecret(envelope: string) {
  if (!envelope) return "";
  const [version, ivValue, tagValue, encryptedValue] = envelope.split(".");
  if (version !== ENVELOPE_VERSION || !ivValue || !tagValue || !encryptedValue) throw new Error("Stored integration secret is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function hmacSha256(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
