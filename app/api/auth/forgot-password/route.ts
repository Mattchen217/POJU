import { NextResponse } from "next/server";
import { z } from "zod";

import { EmailSchema, normalizeEmail, siteOrigin } from "@/lib/auth/auth-helpers";
import { assertOtpSendAllowed, clientIpFromRequest } from "@/lib/auth/otp-rate-limit";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: EmailSchema,
});

/**
 * Request password-reset email. Always returns the same success shape
 * (anti user enumeration) whether or not the email exists.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const ip = clientIpFromRequest(req);

    // Reuse OTP send throttle so reset spam is limited the same way.
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
      const supabase = await createSupabaseServerClient();
      const redirectTo = `${siteOrigin()}/api/auth/confirm?next=${encodeURIComponent("/reset-password")}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        // Log but do not reveal whether the email exists.
        console.error("[auth/forgot-password]", error.name, error.message);
      }
    }

    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    console.error("[auth/forgot-password] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
