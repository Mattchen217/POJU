const fs = require("fs");
const path = require("path");

function write(rel, content) {
  const p = path.join("D:/POJU/pojulife", rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel, Buffer.byteLength(content), "bytes");
}

// --- auth-helpers: better error mapping + post-auth navigate helper note in comments only ---
write("lib/auth/auth-helpers.ts", `import { z } from "zod";

export const EmailSchema = z.string().email().max(254);
export const PasswordSchema = z.string().min(8).max(128);
export const OtpTokenSchema = z.string().regex(/^\\d{6}$/);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Only allow same-origin relative paths (block open redirects).
 * Rejects protocol-relative (\`//evil.com\`) and absolute URLs.
 * Default return path is site home \`/\` — not \`/app\` — so login from marketing
 * returns there unless callers pass an explicit \`next\`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  const next = raw.trim();
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("://")) return fallback;
  if (next.includes("\\\\")) return fallback;
  return next.slice(0, 512) || fallback;
}

export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\\/$/, "") ||
    (process.env.VERCEL_URL ? \`https://\${process.env.VERCEL_URL.replace(/\\/$/, "")}\` : "") ||
    "http://localhost:3000";
  return raw.startsWith("http") ? raw : \`https://\${raw}\`;
}

/**
 * Prefer the incoming request host (localhost vs production) over env Site URL.
 * Auth redirects must stay on the host the user started on.
 */
export function requestOrigin(request: Request): string {
  try {
    const url = new URL(request.url);
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost) {
      const proto = xfProto || (url.protocol === "https:" ? "https" : "http");
      return \`\${proto}://\${xfHost}\`;
    }
    return url.origin;
  } catch {
    return siteOrigin();
  }
}

/**
 * Map Supabase AuthApiError-ish messages / codes to short stable codes.
 * Pass both \`error.message\` and \`error.code\` when available.
 */
export function mapAuthErrorCode(message: string | undefined, code?: string | undefined): string {
  const c = (code ?? "").toLowerCase().replace(/-/g, "_");
  if (c === "email_not_confirmed" || c === "user_not_confirmed") return "email_not_confirmed";
  if (c === "invalid_credentials" || c === "invalid_login_credentials") return "invalid_credentials";
  if (c === "user_already_exists" || c === "email_exists" || c === "user_already_registered") {
    return "email_taken";
  }
  if (c === "over_request_rate_limit" || c === "over_email_send_rate_limit") return "rate_limited";
  if (c === "weak_password") return "weak_password";
  if (c === "otp_expired" || c === "otp_disabled") return "invalid_code";

  const m = (message ?? "").toLowerCase();
  if (!m) return "auth_failed";
  if (m.includes("email not confirmed") || m.includes("not confirmed") || m.includes("confirm your email")) {
    return "email_not_confirmed";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid_credentials")) {
    return "invalid_credentials";
  }
  if (
    m.includes("user already") ||
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("email address is already")
  ) {
    return "email_taken";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("least") || m.includes("short"))) {
    return "weak_password";
  }
  if (m.includes("rate") || m.includes("too many") || m.includes("security purposes")) return "rate_limited";
  if (m.includes("expired") || m.includes("otp") || m.includes("token") || m.includes("one-time")) {
    return "invalid_code";
  }
  return "auth_failed";
}
`);

console.log("helpers done");
