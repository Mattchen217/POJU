import { createHmac, timingSafeEqual } from "node:crypto";

export const OPS_COOKIE_NAME = "poju_ops_session";
/** 7 days */
export const OPS_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type OpsCredentials = {
  user: string;
  password: string;
  secret: string;
};

/** Fail closed when env missing — never ship defaults in source. */
export function getOpsCredentials(): OpsCredentials | null {
  const user = process.env.OPS_USER?.trim();
  const password = process.env.OPS_PASSWORD?.trim();
  const secret = process.env.OPS_SESSION_SECRET?.trim();
  if (!user || !password || !secret || secret.length < 16) return null;
  return { user, password, secret };
}

function hmacEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "ops-cmp").update(a).digest();
  const hb = createHmac("sha256", "ops-cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyOpsLogin(username: string, password: string): boolean {
  const creds = getOpsCredentials();
  if (!creds) return false;
  return hmacEqual(username, creds.user) && hmacEqual(password, creds.password);
}

export function createOpsSessionToken(username: string, secret: string): string {
  const exp = Date.now() + OPS_COOKIE_MAX_AGE_SEC * 1000;
  const payload = `${username}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOpsSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const creds = getOpsCredentials();
  if (!creds) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [username, expStr, sig] = parts;
  if (!username || !expStr || !sig) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  if (!hmacEqual(username, creds.user)) return false;

  const payload = `${username}.${expStr}`;
  const expected = createHmac("sha256", creds.secret).update(payload).digest("base64url");
  return hmacEqual(sig, expected);
}

export function opsCookieOptions(maxAge = OPS_COOKIE_MAX_AGE_SEC) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
