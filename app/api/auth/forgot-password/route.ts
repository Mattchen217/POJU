import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  normalizeEmail,
  requestOrigin,
  safeNextPath,
} from "@/lib/auth/auth-helpers";
import { AuthLocaleSchema, resolveAuthLocale } from "@/lib/auth/auth-locale";
import { assertOtpSendAllowed, clientIpFromRequest } from "@/lib/auth/otp-rate-limit";
import { syncAuthLangMetadata } from "@/lib/auth/sync-auth-lang";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { routing } from "@/i18n/routing";

const BodySchema = z.object({
  email: EmailSchema,
  /** Site UI locale — written to user_metadata.lang for Reset password templates. */
  locale: AuthLocaleSchema.optional(),
});

function resetPasswordNextPath(locale: string): string {
  if (locale === routing.defaultLocale) return "/reset-password";
  return `/${locale}/reset-password`;
}

/**
 * Request password-recovery email (6-digit OTP + optional link).
 * Always returns the same success shape (anti user enumeration).
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const lang = resolveAuthLocale(req, parsed.data.locale);
    const ip = clientIpFromRequest(req);
    const origin = requestOrigin(req);

    const rate = await assertOtpSendAllowed(email, ip);
    if (!rate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          retry_after_sec: rate.retryAfterSec ?? 60,
        },
        { status: 429 },
      );
    }

    if (isSupabaseConfigured()) {
      // Template branches on {{ .Data.lang }} — sync before send.
      await syncAuthLangMetadata(email, lang);

      const supabase = await createSupabaseServerClient();
      const next = safeNextPath(resetPasswordNextPath(lang), "/reset-password");
      const redirectTo = `${origin}/api/auth/confirm?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        // Log but do not reveal whether the email exists.
        console.error("[auth/forgot-password]", error.name, error.message);
      }
    }

    return NextResponse.json({
      ok: true,
      needs_verification: true,
      email,
    });
  } catch (error) {
    console.error(
      "[auth/forgot-password] unexpected",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
