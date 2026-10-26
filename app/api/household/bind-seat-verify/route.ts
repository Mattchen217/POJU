import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  OtpTokenSchema,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  bindSeatAfterSignupOtp,
  listHouseholdSeatsForViewer,
} from "@/lib/passes/household";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: EmailSchema,
  token: OtpTokenSchema,
  replace: z.boolean().optional(),
});

/**
 * Seat A confirms partner signup OTP and binds seat B without switching cookies.
 */
export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const result = await bindSeatAfterSignupOtp({
      actorUserId: user.id,
      email: normalizeEmail(parsed.data.email),
      token: parsed.data.token,
      replace: parsed.data.replace === true,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }

    const seats = await listHouseholdSeatsForViewer(result.household, user.id);
    return NextResponse.json({ ok: true, seats });
  } catch (e) {
    console.error("[api/household/bind-seat-verify]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
