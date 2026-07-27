import { NextResponse } from "next/server";
import { z } from "zod";

import { EmailSchema, OtpTokenSchema, normalizeEmail } from "@/lib/auth/auth-helpers";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: EmailSchema,
  token: OtpTokenSchema,
});

/**
 * Verify email OTP (login via code). Writes Cookie session (single session model).
 * Still returns access_token fields for transitional client compatibility.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const token = parsed.data.token;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        mocked: true,
        user: {
          id: `mock-user-${Buffer.from(email).toString("base64url").slice(0, 16)}`,
          email,
        },
        access_token: `mock_access_${Date.now().toString(36)}`,
        refresh_token: null,
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error || !data.user || !data.session) {
      console.error("[auth/otp/verify]", error?.name ?? "no_session");
      return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
      },
      // Transitional: Cookie is source of truth; tokens kept for older clients.
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (error) {
    console.error("[auth/otp/verify] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
