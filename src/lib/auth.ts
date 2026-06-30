import crypto from "node:crypto";

// Хэширование паролей (scrypt, встроенный crypto) и подписанные сессии (HMAC).
// Секрет берётся из окружения; на сервере задаётся в .env (SESSION_SECRET).

const SECRET = process.env.SESSION_SECRET || "goh-dev-secret-change-me";
export const SESSION_COOKIE = "goh_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 32).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(test, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signSession(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, t: Date.now() }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.uid === "string" ? data.uid : null;
  } catch {
    return null;
  }
}
