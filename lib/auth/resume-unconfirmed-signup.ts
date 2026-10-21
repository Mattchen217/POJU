import { NextResponse } from "next/server";

import { mapAuthErrorCode } from "@/lib/auth/auth-helpers";
import type { AuthLocale } from "@/lib/auth/auth-locale";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import {
  createSupabaseAdminClient,
  createSupabaseAnonClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";

export type ResendSignupResult = "ok" | "rate_limited" | "failed";

/**
 * Keep `user_metadata.lang` in sync so Confirm-signup emails can branch on
 * `{{ .Data.lang }}` (zh | en | es | fr).
 */
async function syncSignupLangMetadata(email: string, lang?: AuthLocale): Promise<void> {
  if (!lang || !isSupabaseAdminConfigured()) return;
  const found = await findAuthUserByEmail(email);
  if (!found) return;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(found.id, {
    user_metadata: { lang },
  });
  if (error) {
    console.error("[auth/resend-signup-otp] metadata", error.name, error.message);
  }
}

/** Resend signup confirmation OTP via Supabase Auth (Custom SMTP). */
export async function resendSignupOtp(
  email: string,
  lang?: AuthLocale,
): Promise<ResendSignupResult> {
  await syncSignupLangMetadata(email, lang);
  const anon = createSupabaseAnonClient();
  const { error } = await anon.auth.resend({
    type: "signup",
    email,
  });
  if (!error) return "ok";
  console.error("[auth/resend-signup-otp]", error.name, error.message);
  const mapped = mapAuthErrorCode(error.message, (error as { code?: string }).code);
  if (mapped === "rate_limited") return "rate_limited";
  return "failed";
}

/**
 * Unconfirmed account already exists — (re)send OTP and tell the client to
 * collect the code instead of showing a hard "already registered" error.
 */
export async function jsonNeedsVerification(
  email: string,
  opts?: {
    existingUnconfirmed?: boolean;
    resend?: ResendSignupResult;
    lang?: AuthLocale;
  },
): Promise<NextResponse> {
  const resend = opts?.resend ?? (await resendSignupOtp(email, opts?.lang));
  if (resend === "rate_limited") {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  return NextResponse.json({
    ok: true,
    needs_verification: true,
    existing_unconfirmed: opts?.existingUnconfirmed ?? true,
    email,
    // SMTP may still be broken; client can surface a soft hint while showing OTP.
    email_send_warning: resend === "failed",
  });
}
