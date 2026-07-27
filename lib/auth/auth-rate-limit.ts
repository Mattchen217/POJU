import { kv } from "@/lib/kv/client";

const EMAIL_WINDOW_SEC = 60 * 15;
const EMAIL_MAX = 8;
const IP_WINDOW_SEC = 60 * 60;
const IP_MAX = 30;

export type AuthRateLimitResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited"; retryAfterSec: number };

/**
 * Login / password-attempt throttle (anti credential stuffing).
 * Separate keys from OTP send cooldown.
 */
export async function assertLoginAttemptAllowed(
  email: string,
  ip: string,
): Promise<AuthRateLimitResult> {
  const eKey = `auth:login:email:${email.trim().toLowerCase()}`;
  const iKey = `auth:login:ip:${ip || "unknown"}`;

  const emailCount = (await kv.get<number>(eKey)) ?? 0;
  if (emailCount >= EMAIL_MAX) {
    return { ok: false, reason: "rate_limited", retryAfterSec: EMAIL_WINDOW_SEC };
  }

  const ipCount = (await kv.get<number>(iKey)) ?? 0;
  if (ipCount >= IP_MAX) {
    return { ok: false, reason: "rate_limited", retryAfterSec: IP_WINDOW_SEC };
  }

  await kv.set(eKey, emailCount + 1, { ex: EMAIL_WINDOW_SEC });
  await kv.set(iKey, ipCount + 1, { ex: IP_WINDOW_SEC });
  return { ok: true };
}
