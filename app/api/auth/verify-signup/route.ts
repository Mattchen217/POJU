import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  OtpTokenSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: EmailSchema,
  token: OtpTokenSchema,
});

/**
 * Confirm signup with 6-digit email OTP (`type: "signup"`). Writes Cookie session.
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
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    if (error || !data.user) {
      console.error("[auth/verify-signup]", error?.name ?? "no_user");
      return NextResponse.json(
        { ok: false, error: mapAuthErrorCode(error?.message) || "invalid_code" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
      },
    });
  } catch (error) {
    console.error("[auth/verify-signup] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
