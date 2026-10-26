import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EmailSchema,
  PasswordSchema,
  normalizeEmail,
} from "@/lib/auth/auth-helpers";
import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  bindSeatByCredentials,
  listHouseholdSeatsForViewer,
} from "@/lib/passes/household";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  replace: z.boolean().optional(),
});

/**
 * Seat A binds seat B with email+password (existing login or new account).
 * Caller session stays on seat A — partner is never signed in here.
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

    const result = await bindSeatByCredentials({
      actorUserId: user.id,
      email: normalizeEmail(parsed.data.email),
      password: parsed.data.password,
      replace: parsed.data.replace === true,
    });

    if (!result.ok) {
      const status =
        result.reason === "invalid_credentials" || result.reason === "cannot_bind_self"
          ? 400
          : result.reason === "already_full" || result.reason === "already_in_household"
            ? 409
            : 400;
      return NextResponse.json({ ok: false, error: result.reason }, { status });
    }

    const seats = await listHouseholdSeatsForViewer(result.household, user.id);
    return NextResponse.json({
      ok: true,
      created: result.created,
      seats,
      household: {
        id: result.household.id,
        status: result.household.status,
        shared_sub_balance: result.household.shared_sub_balance,
        quota: result.household.quota,
      },
    });
  } catch (e) {
    console.error("[api/household/bind-seat]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
