import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAnonClient, isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: z.string().email().max(254),
  token: z.string().regex(/^\d{6}$/),
});

/**
 * Verify email OTP. Returns session tokens for the client to store / pass to checkout.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
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

    const supabase = createSupabaseAnonClient();
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
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (error) {
    console.error("[auth/otp/verify] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
