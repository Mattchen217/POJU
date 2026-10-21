import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { jsonNeedsVerification } from "@/lib/auth/resume-unconfirmed-signup";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

/**
 * Email + password signup. Supabase sends confirmation OTP/email per dashboard templates.
 * Session is not established until verify-signup (when confirm email is enabled).
 *
 * Common failure mode: `signUp` creates an unconfirmed user, then Custom SMTP fails.
 * Retry would normally return `email_taken` and block login — we detect unconfirmed
 * accounts (and empty-identity “fake” duplicates) and resume verification instead.
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

      // signUp often creates the row before SMTP delivery fails — recover.
      const found = await findAuthUserByEmail(email);
      if (found && !found.emailConfirmed) {
        return jsonNeedsVerification(email, { existingUnconfirmed: true });
      }

      if (mapped === "email_taken") {
        // Only hard-block when admin confirms the account is already verified.
        if (found?.emailConfirmed) {
          return NextResponse.json({ ok: false, error: "email_taken" }, { status: 400 });
        }
        // Unconfirmed or lookup missed — resume OTP (resend may warn if SMTP fails).
        return jsonNeedsVerification(email, { existingUnconfirmed: true });
      }

      return NextResponse.json({ ok: false, error: mapped }, { status: 400 });
    }

    // Supabase anti-enumeration: existing email may return a user with empty identities
    // and no session — no email is sent unless we explicitly resend.
    const identities = data.user?.identities ?? [];
    if (data.user && identities.length === 0 && !data.session) {
      const found = await findAuthUserByEmail(email);
      if (found?.emailConfirmed) {
        return NextResponse.json({ ok: false, error: "email_taken" }, { status: 400 });
      }
      return jsonNeedsVerification(email, { existingUnconfirmed: true });
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
