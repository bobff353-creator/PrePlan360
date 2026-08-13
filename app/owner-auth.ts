import { cookies } from "next/headers";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { db, id, now } from "@/db/access";

const PASSWORD_ITERATIONS = 600_000;
const SESSION_SECONDS = 60 * 60 * 12;
const SESSION_COOKIE = "__Host-preplan360-owner";
const DEV_SESSION_COOKIE = "preplan360-owner-dev";
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type CredentialRow = {
  user_id: string;
  email: string;
  password_salt: string;
  password_hash: string;
  iterations: number;
};

type LoginStateRow = {
  failed_count: number;
  locked_until: string | null;
};

export type OwnerLoginResult =
  | { ok: true; user: ChatGPTUser; token: string }
  | { ok: false; reason: "invalid" | "locked" };

export function validateOwnerPassword(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 128) return "Use no more than 128 characters.";
  return null;
}

export async function ownerCredentialCount(): Promise<number> {
  const row = await db()
    .prepare("SELECT COUNT(*) AS count FROM owner_credentials")
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function ownerCredentialExists(userId: string): Promise<boolean> {
  return !!(await db()
    .prepare("SELECT user_id FROM owner_credentials WHERE user_id = ?")
    .bind(userId)
    .first());
}

export async function createOwnerPassword(
  user: ChatGPTUser,
  password: string,
): Promise<string> {
  const validation = validateOwnerPassword(password);
  if (validation) throw new Error(validation);

  const salt = randomBytes(16);
  const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  const at = now();

  await db()
    .prepare(
      "INSERT INTO owner_credentials (user_id,email,password_salt,password_hash,iterations,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      user.userId,
      normalizeEmail(user.email),
      bytesToBase64(salt),
      bytesToBase64(hash),
      PASSWORD_ITERATIONS,
      at,
      at,
    )
    .run();

  return createOwnerSession(user.userId);
}

export async function createFirstVercelOwner(
  email: string,
  displayName: string,
  password: string,
): Promise<{ user: ChatGPTUser; token: string }> {
  if (process.env.VERCEL_ENV !== "preview") throw new Error("First-owner setup is preview-only.");
  if (await ownerCredentialCount()) throw new Error("Owner setup is already complete.");
  const validation = validateOwnerPassword(password);
  if (validation) throw new Error(validation);

  const normalizedEmail = normalizeEmail(email);
  const normalizedName = displayName.trim().slice(0, 120);
  if (!normalizedEmail || !normalizedName) throw new Error("Owner name and email are required.");
  const userId = id("owner");
  const salt = randomBytes(16);
  const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  const at = now();

  await db().batch([
    db().prepare("INSERT INTO platform_users (id,email,display_name,platform_role,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(userId, normalizedEmail, normalizedName, "platform_owner", at, at),
    db().prepare("INSERT INTO owner_credentials (user_id,email,password_salt,password_hash,iterations,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(userId, normalizedEmail, bytesToBase64(salt), bytesToBase64(hash), PASSWORD_ITERATIONS, at, at),
  ]);

  const user: ChatGPTUser = { userId, email: normalizedEmail, displayName: normalizedName, fullName: normalizedName };
  return { user, token: await createOwnerSession(userId) };
}

export async function verifyOwnerLogin(
  email: string,
  password: string,
): Promise<OwnerLoginResult> {
  const normalizedEmail = normalizeEmail(email);
  const currentTime = now();
  const state = await db()
    .prepare(
      "SELECT failed_count,locked_until FROM owner_login_state WHERE email = ?",
    )
    .bind(normalizedEmail)
    .first<LoginStateRow>();

  if (state?.locked_until && state.locked_until > currentTime) {
    return { ok: false, reason: "locked" };
  }
  const previousFailedCount =
    state?.locked_until && state.locked_until <= currentTime
      ? 0
      : (state?.failed_count ?? 0);

  const credential = await db()
    .prepare(
      "SELECT user_id,email,password_salt,password_hash,iterations FROM owner_credentials WHERE lower(email) = lower(?)",
    )
    .bind(normalizedEmail)
    .first<CredentialRow>();

  const fallbackSalt = new Uint8Array(16);
  const salt = credential
    ? base64ToBytes(credential.password_salt)
    : fallbackSalt;
  const candidate = await derivePasswordHash(
    password.slice(0, 128),
    salt,
    credential?.iterations ?? PASSWORD_ITERATIONS,
  );
  const valid = credential
    ? constantTimeEqual(candidate, base64ToBytes(credential.password_hash))
    : false;

  if (!credential || !valid) {
    await recordFailedLogin(normalizedEmail, previousFailedCount);
    return { ok: false, reason: "invalid" };
  }

  await db()
    .prepare("DELETE FROM owner_login_state WHERE email = ?")
    .bind(normalizedEmail)
    .run();

  const user = await db()
    .prepare(
      "SELECT id AS user_id,email,display_name FROM platform_users WHERE id = ? AND platform_role = 'platform_owner'",
    )
    .bind(credential.user_id)
    .first<{ user_id: string; email: string; display_name: string }>();

  if (!user) return { ok: false, reason: "invalid" };
  const token = await createOwnerSession(user.user_id);
  return {
    ok: true,
    token,
    user: {
      userId: user.user_id,
      email: user.email,
      displayName: user.display_name,
      fullName: user.display_name,
    },
  };
}

export async function getOwnerSessionUser(): Promise<ChatGPTUser | null> {
  const token = await readOwnerSessionToken();
  if (!token) return null;

  const tokenHash = await sha256(token);
  const row = await db()
    .prepare(
      "SELECT u.id AS user_id,u.email,u.display_name FROM owner_sessions s JOIN platform_users u ON u.id=s.user_id JOIN owner_credentials c ON c.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.platform_role='platform_owner'",
    )
    .bind(tokenHash, now())
    .first<{ user_id: string; email: string; display_name: string }>();

  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    fullName: row.display_name,
  };
}

export async function revokeCurrentOwnerSession(): Promise<void> {
  const token = await readOwnerSessionToken();
  if (!token) return;
  await db()
    .prepare("DELETE FROM owner_sessions WHERE token_hash = ?")
    .bind(await sha256(token))
    .run();
}

export function ownerSessionCookie(token: string, requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === "https:";
  const name = secure ? SESSION_COOKIE : DEV_SESSION_COOKIE;
  return `${name}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

export function clearOwnerSessionCookies(requestUrl: string): string[] {
  const secure = new URL(requestUrl).protocol === "https:";
  return [
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
    `${DEV_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`,
  ];
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 254);
}

async function createOwnerSession(userId: string): Promise<string> {
  const token = bytesToBase64Url(randomBytes(32));
  const createdAt = now();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await db().batch([
    db().prepare("DELETE FROM owner_sessions WHERE expires_at <= ?").bind(createdAt),
    db()
      .prepare(
        "INSERT INTO owner_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)",
      )
      .bind(await sha256(token), userId, createdAt, expiresAt),
  ]);
  return token;
}

async function recordFailedLogin(email: string, previousCount: number) {
  const failedCount = previousCount + 1;
  const lockedUntil =
    failedCount >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
      : null;
  await db()
    .prepare(
      "INSERT INTO owner_login_state (email,failed_count,locked_until,updated_at) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at",
    )
    .bind(email, failedCount, lockedUntil, now())
    .run();
}

async function readOwnerSessionToken(): Promise<string | null> {
  const store = await cookies();
  return (
    store.get(SESSION_COOKIE)?.value ??
    store.get(DEV_SESSION_COOKIE)?.value ??
    null
  );
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations,
    },
    material,
    256,
  );
  return new Uint8Array(bits);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
