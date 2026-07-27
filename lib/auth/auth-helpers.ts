import { z } from "zod";

export const EmailSchema = z.string().email().max(254);
export const PasswordSchema = z.string().min(8).max(128);
export const OtpTokenSchema = z.string().regex(/^\d{6}$/);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Only allow same-origin relative paths (block open redirects).
 * Rejects protocol-relative (`//evil.com`) and absolute URLs.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw) return fallback;
  const next = raw.trim();
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("://")) return fallback;
  if (next.includes("\\")) return fallback;
  return next.slice(0, 512) || fallback;
}

export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "") ||
    "http://localhost:3000";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

/** Map Supabase AuthApiError-ish messages to short stable codes. */
export function mapAuthErrorCode(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return "auth_failed";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "invalid_credentials";
  if (m.includes("email not confirmed") || m.includes("not confirmed")) return "email_not_confirmed";
  if (m.includes("user already") || m.includes("already registered")) return "email_taken";
  if (m.includes("password") && (m.includes("weak") || m.includes("least") || m.includes("short"))) {
    return "weak_password";
  }
  if (m.includes("rate") || m.includes("too many")) return "rate_limited";
  if (m.includes("expired") || m.includes("otp") || m.includes("token")) return "invalid_code";
  return "auth_failed";
}
