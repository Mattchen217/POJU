/**
 * Resend From addresses — all @mail.easternos.com.
 * Override via env; never default Auth/Reports/Notify to noreply@.
 */

export const RESEND_FROM_VERIFY_DEFAULT =
  "Eastern OS Validation <verify@mail.easternos.com>";
export const RESEND_FROM_REPORTS_DEFAULT =
  "Eastern OS Reports <reports@mail.easternos.com>";
export const RESEND_FROM_NOTIFY_DEFAULT =
  "Eastern OS <notify@mail.easternos.com>";

function pick(envVal: string | undefined, fallback: string): string {
  const v = envVal?.trim();
  return v && v.length > 0 ? v : fallback;
}

/** Signup / login OTP / password reset — usually via Supabase SMTP; kept for docs + rare app sends. */
export function getResendFromVerify(): string {
  return pick(process.env.RESEND_FROM_VERIFY, RESEND_FROM_VERIFY_DEFAULT);
}

/** User-requested decision report / baseline pack email. */
export function getResendFromReports(): string {
  return pick(process.env.RESEND_FROM_REPORTS, RESEND_FROM_REPORTS_DEFAULT);
}

/** Companion 30-day daily reminder. */
export function getResendFromNotify(): string {
  return pick(process.env.RESEND_FROM_NOTIFY, RESEND_FROM_NOTIFY_DEFAULT);
}

/**
 * @deprecated Prefer getResendFromVerify / Reports / Notify.
 * Brief compatibility: RESEND_FROM_EMAIL only if set; never noreply@.
 */
export function getResendFromLegacyFallback(role: "verify" | "reports" | "notify"): string {
  const legacy = process.env.RESEND_FROM_EMAIL?.trim();
  if (legacy && !/noreply@/i.test(legacy)) {
    return legacy;
  }
  if (role === "verify") return getResendFromVerify();
  if (role === "reports") return getResendFromReports();
  return getResendFromNotify();
}
