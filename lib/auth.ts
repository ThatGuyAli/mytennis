import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { query } from "@/lib/db";

export const SESSION_COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_MS / 1000;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-change-me";

export type SessionPayload = {
  userId: string;
  username: string;
  exp: number;
};

type DbUser = {
  id: string;
  username: string;
  password_hash: string;
};

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signPayload(payload: string) {
  return toBase64Url(
    crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest(),
  );
}

export function encodeSessionToken(payload: SessionPayload) {
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export function decodeSessionToken(raw: string): SessionPayload | null {
  const [payloadEncoded, signature] = raw.split(".");

  if (!payloadEncoded || !signature) {
    return null;
  }

  const expected = signPayload(payloadEncoded);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadEncoded)) as SessionPayload;
    if (!parsed.userId || !parsed.username || !parsed.exp) {
      return null;
    }

    if (Date.now() > parsed.exp) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash.startsWith("$2")) {
    return bcrypt.compare(password, passwordHash);
  }

  // Supports bootstrapping with plain text passwords only in local/dev setups.
  return password === passwordHash;
}

export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<SessionPayload | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password) {
    return null;
  }

  const result = await query<DbUser>(
    `SELECT id, username, password_hash
     FROM users
     WHERE lower(username) = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [normalized],
  );

  const user = result.rows[0];
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  return {
    userId: user.id,
    username: user.username,
    exp: Date.now() + SESSION_DURATION_MS,
  };
}

export async function createSession(session: SessionPayload) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  return decodeSessionToken(raw);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}
