import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  mapAuthErrorCode,
  normalizeEmail,
  safeNextPath,
  siteOrigin,
} from "@/lib/auth/auth-helpers";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { userNeedsEmail } from "@/lib/auth/user-identity";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: EmailSchema,
  next: z.string().max(512).optional(),
});

/**
 * Logged-in user without email: request email change / confirmation mail.
 */
export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const next = safeNextPath(parsed.data.next, "/");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!userNeedsEmail(user) && user.email?.trim().toLowerCase() === email) {
      return NextResponse.json({ ok: true, already_complete: true });
    }

    const origin = siteOrigin();
    const emailRedirectTo = `${origin}/api/auth/confirm?type=email_change&next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo },
    );

    if (error) {
      console.error("[auth/complete-email]", error.name, error.message);
      return NextResponse.json(
        { ok: false, error: mapAuthErrorCode(error.message) },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    console.error(
      "[auth/complete-email] unexpected",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
