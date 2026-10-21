import { NextResponse } from "next/server";
import { z } from "zod";

import { EmailSchema, normalizeEmail } from "@/lib/auth/auth-helpers";
import { AuthLocaleSchema, resolveAuthLocale } from "@/lib/auth/auth-locale";
import { assertOtpSendAllowed, clientIpFromRequest } from "@/lib/auth/otp-rate-limit";
import { resendSignupOtp } from "@/lib/auth/resume-unconfirmed-signup";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: EmailSchema,
  locale: AuthLocaleSchema.optional(),
});

/**
 * Resend signup confirmation OTP (Supabase `resend` type: signup).
 * Syncs `user_metadata.lang` when locale is provided so the email template matches the UI.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const lang = resolveAuthLocale(req, parsed.data.locale);
    const ip = clientIpFromRequest(req);
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

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, mocked: true });
    }

    const result = await resendSignupOtp(email, lang);
    if (result === "rate_limited") {
      return NextResponse.json(
        { ok: false, error: "rate_limited", retry_after_sec: 60 },
        { status: 429 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "[auth/resend-signup] unexpected",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
    );
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }
}
