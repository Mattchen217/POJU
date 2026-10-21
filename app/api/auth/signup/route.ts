import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { AuthLocaleSchema, normalizeAuthLocale } from "@/lib/auth/auth-locale";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { jsonNeedsVerification } from "@/lib/auth/resume-unconfirmed-signup";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  /** Site UI locale — written to user_metadata.lang for email templates. */
  locale: AuthLocaleSchema.optional(),
});

/**
 * Email + password signup. Supabase sends confirmation OTP/email per dashboard templates.
 * Session is not established until verify-signup (when confirm email is enabled).
 *
 * Passes `user_metadata.lang` so Confirm sign up templates can render zh|en|es|fr
 * via `{{ if eq .Data.lang "zh" }}…{{ end }}`.
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
    const lang = normalizeAuthLocale(parsed.data.locale);

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
      options: {
        data: { lang },
      },
    });

    if (error) {
      const mapped = mapAuthErrorCode(
        error.message,
        (error as { code?: string }).code,
      );
      console.error("[auth/signup]", error.name, error.message, mapped);

      const found = await findAuthUserByEmail(email);
      if (found && !found.emailConfirmed) {
        return jsonNeedsVerification(email, { existingUnconfirmed: true, lang });
      }

      if (mapped === "email_taken") {
        if (found?.emailConfirmed) {
          return NextResponse.json({ ok: false, error: "email_taken" }, { status: 400 });
        }
        return jsonNeedsVerification(email, { existingUnconfirmed: true, lang });
      }

      return NextResponse.json({ ok: false, error: mapped }, { status: 400 });
    }

    const identities = data.user?.identities ?? [];
    if (data.user && identities.length === 0 && !data.session) {
      const found = await findAuthUserByEmail(email);
      if (found?.emailConfirmed) {
        return NextResponse.json({ ok: false, error: "email_taken" }, { status: 400 });
      }
      return jsonNeedsVerification(email, { existingUnconfirmed: true, lang });
    }

    if (data.session) {
      await supabase.auth.signOut();
      console.error(
        "[auth/signup] session returned on signUp — enable Confirm email in Supabase Auth",
      );
      return NextResponse.json(
        { ok: false, error: "confirm_email_required", email },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      needs_verification: true,
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
