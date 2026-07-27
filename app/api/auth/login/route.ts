import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  mapAuthErrorCode,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { assertLoginAttemptAllowed } from "@/lib/auth/auth-rate-limit";
import { clientIpFromRequest } from "@/lib/auth/otp-rate-limit";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

/**
 * Email + password login. Writes Cookie session on success.
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
    const ip = clientIpFromRequest(req);

    const rate = await assertLoginAttemptAllowed(email, ip);
    if (!rate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          retry_after_sec: rate.retryAfterSec,
        },
        { status: 429 },
      );
    }

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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.error("[auth/login]", error?.name ?? "no_user");
      return NextResponse.json(
        { ok: false, error: mapAuthErrorCode(error?.message) },
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
    console.error("[auth/login] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
