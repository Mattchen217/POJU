import { NextResponse } from "next/server";
import { z } from "zod";

import { EmailSchema, normalizeEmail } from "@/lib/auth/auth-helpers";
import { assertOtpSendAllowed, clientIpFromRequest } from "@/lib/auth/otp-rate-limit";
import { createSupabaseAnonClient, isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: EmailSchema,
});

/**
 * Resend signup confirmation OTP (Supabase `resend` type: signup).
 * Rate-limited like otp/send. Always returns generic success when configured
 * to avoid email enumeration (except rate limit / invalid payload).
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const ip = clientIpFromRequest(req);
    const rate = await assertOtpSendAllowed(email, ip);
    if (!rate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: rate.reason === "ip_limit" ? "rate_limited" : "rate_limited",
          retry_after_sec: rate.retryAfterSec ?? 60,
        },
        { status: 429 },
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, mocked: true });
    }

    const supabase = createSupabaseAnonClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      // Avoid leaking whether the email exists / already confirmed.
      console.error("[auth/resend-signup]", error.name, error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/resend-signup] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
