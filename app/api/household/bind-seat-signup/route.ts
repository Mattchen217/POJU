import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { AuthLocaleSchema, resolveAuthLocale } from "@/lib/auth/auth-locale";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { getServerUser } from "@/lib/auth/supabase-server";
import {
  createSupabaseAnonClient,
  isSupabaseConfigured,
} from "@/lib/auth/supabase";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  locale: AuthLocaleSchema.optional(),
});

/**
 * Register the partner account for seat bind.
 * Uses anon client only — must never touch the caller's Cookie session
 * (unlike /api/auth/signup which uses the server cookie client + signOut).
 */
export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const actor = await getServerUser();
    if (!actor?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;
    const lang = resolveAuthLocale(req, parsed.data.locale);

    if (normalizeEmail(actor.email ?? "") === email) {
      return NextResponse.json({ ok: false, error: "cannot_bind_self" }, { status: 400 });
    }

    const anon = createSupabaseAnonClient();
    const { data, error } = await anon.auth.signUp({
      email,
      password,
      options: {
        data: { lang, locale: lang },
      },
    });

    if (error) {
      const mapped = mapAuthErrorCode(
        error.message,
        (error as { code?: string }).code,
      );
      const found = await findAuthUserByEmail(email);
      if (found && !found.emailConfirmed) {
        return NextResponse.json({
          ok: true,
          needs_verification: true,
          email,
          existing_unconfirmed: true,
        });
      }
      if (mapped === "email_taken") {
        if (found?.emailConfirmed) {
          return NextResponse.json({ ok: false, error: "email_taken" }, { status: 400 });
        }
        return NextResponse.json({
          ok: true,
          needs_verification: true,
          email,
          existing_unconfirmed: true,
        });
      }
      return NextResponse.json({ ok: false, error: mapped }, { status: 400 });
    }

    const identities = data.user?.identities ?? [];
    if (data.user && identities.length === 0 && !data.session) {
      const found = await findAuthUserByEmail(email);
      if (found?.emailConfirmed) {
        return NextResponse.json({ ok: false, error: "email_taken" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        needs_verification: true,
        email,
        existing_unconfirmed: true,
      });
    }

    // If confirm-email is off, GoTrue may return a session in the body.
    // We deliberately do not write it to cookies — discard and require OTP path.
    if (data.session) {
      console.error(
        "[api/household/bind-seat-signup] session in signUp body — discarded; enable Confirm email",
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
  } catch (e) {
    console.error("[api/household/bind-seat-signup]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
