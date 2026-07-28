import { NextResponse } from "next/server";
import { z } from "zod";

import { EmailSchema, normalizeEmail, OtpTokenSchema } from "@/lib/auth/auth-helpers";
import { createSupabaseAdminClient, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/auth/supabase";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: EmailSchema,
  token: OtpTokenSchema,
});

/**
 * Confirm email_change OTP for OAuth users completing the hard email gate.
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
    const token = parsed.data.token;
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email_change",
    });

    if (error || !data.user) {
      console.error("[auth/complete-email/verify]", error?.name ?? "no_user");
      return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 401 });
    }

    const confirmed = data.user.email?.trim().toLowerCase();
    if (!confirmed) {
      return NextResponse.json({ ok: false, error: "email_not_confirmed" }, { status: 400 });
    }

    if (isSupabaseAdminConfigured()) {
      try {
        const admin = createSupabaseAdminClient();
        await admin.from("profiles").upsert(
          { id: data.user.id, email: confirmed },
          { onConflict: "id" },
        );
      } catch (profileError) {
        console.error(
          "[auth/complete-email/verify] profile",
          profileError instanceof Error ? profileError.name : "unknown",
        );
      }
    }

    return NextResponse.json({
      ok: true,
      user: { id: data.user.id, email: confirmed },
    });
  } catch (error) {
    console.error(
      "[auth/complete-email/verify] unexpected",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
