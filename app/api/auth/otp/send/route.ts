import { NextResponse } from "next/server";
import { z } from "zod";

import { assertOtpSendAllowed, clientIpFromRequest } from "@/lib/auth/otp-rate-limit";
import { createSupabaseAnonClient, isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: z.string().email().max(254),
});

/**
 * Send 6-digit email OTP via Supabase Auth (Custom SMTP → Resend).
 * When Supabase env is missing, returns a mock success for local UI testing.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const ip = clientIpFromRequest(req);
    const rate = await assertOtpSendAllowed(email, ip);
    if (!rate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: rate.reason,
          retry_after_sec: rate.retryAfterSec ?? 60,
          captcha_required: rate.reason === "ip_limit",
        },
        { status: 429 },
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        mocked: true,
        message: "OTP mocked (Supabase not configured). Use any 6-digit code.",
      });
    }

    const supabase = createSupabaseAnonClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.error("[auth/otp/send]", error.name, error.message);
      return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/otp/send] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
