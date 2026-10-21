import { kv } from "@/lib/kv/client";

const EMAIL_COOLDOWN_SEC = 60;
const IP_WINDOW_SEC = 60 * 60;
const IP_MAX_REQUESTS = 10;

function emailKey(email: string): string {
  return `otp:email:${email.trim().toLowerCase()}`;
}

function ipKey(ip: string): string {
  return `otp:ip:${ip}`;
}

export type OtpRateLimitResult =
  | { ok: true }
  | { ok: false; reason: "email_cooldown" | "ip_limit"; retryAfterSec?: number };

/**
 * OTP send throttle. If Upstash/KV is down, fail *open* so signup/verify
 * can still deliver codes (auth must not 500 because Redis blipped).
 */
export async function assertOtpSendAllowed(email: string, ip: string): Promise<OtpRateLimitResult> {
  try {
    const eKey = emailKey(email);
    const existing = await kv.get<number>(eKey);
    if (existing) {
      return { ok: false, reason: "email_cooldown", retryAfterSec: EMAIL_COOLDOWN_SEC };
    }

    const iKey = ipKey(ip || "unknown");
    const count = (await kv.get<number>(iKey)) ?? 0;
    if (count >= IP_MAX_REQUESTS) {
      return { ok: false, reason: "ip_limit", retryAfterSec: IP_WINDOW_SEC };
    }

    await kv.set(eKey, 1, { ex: EMAIL_COOLDOWN_SEC });
    await kv.set(iKey, count + 1, { ex: IP_WINDOW_SEC });
    return { ok: true };
  } catch (error) {
    console.error(
      "[auth/otp-rate-limit] kv unavailable — allowing send",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
    );
    return { ok: true };
  }
}

export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
