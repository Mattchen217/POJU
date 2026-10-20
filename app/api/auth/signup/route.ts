import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { createSupabaseAnonClient, isSupabaseConfigured } from "@/lib/auth/supabase";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

/**
 * Email + password signup. Supabase sends confirmation OTP/email per dashboard templates.
 * Session is not established until verify-signup (when confirm email is enabled).
 *
 * If the email is already registered but unconfirmed, resends the signup OTP and
 * returns `needs_verification: true` so the client can collect the code on /signup.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        mocked: true,
        needs_verification: true,
        email,
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      const mapped = mapAuthErrorCode(
        error.message,
        (error as { code?: string }).code,
      );
      console.error("[auth/signup]", error.name, error.message, mapped);

      if (mapped === "email_taken") {
        const found = await findAuthUserByEmail(email);
        if (found && !found.emailConfirmed) {
          const anon = createSupabaseAnonClient();
          const { error: resendError } = await anon.auth.resend({
            type: "signup",
            email,
          });
          if (resendError) {
            console.error("[auth/signup] resend", resendError.name, resendError.message);
            const resendMapped = mapAuthErrorCode(
              resendError.message,
              (resendError as { code?: string }).code,
            );
            if (resendMapped === "rate_limited") {
              return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
            }
          }
          return NextResponse.json({
            ok: true,
            needs_verification: true,
            existing_unconfirmed: true,
            email,
          });
        }
      }

      return NextResponse.json({ ok: false, error: mapped }, { status: 400 });
    }

    // When email confirm is on, session is null until OTP/link confirmed.
    const needsVerification = !data.session;

    return NextResponse.json({
      ok: true,
      needs_verification: needsVerification,
      email,
      user: data.user
        ? { id: data.user.id, email: data.user.email ?? email }
        : null,
    });
  } catch (error) {
    console.error("[auth/signup] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
