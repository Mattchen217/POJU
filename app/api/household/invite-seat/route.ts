import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  clearSeatBForReplace,
  createSeatInvite,
  ensureHouseholdForActiveSubscriber,
} from "@/lib/passes/household";

export const runtime = "nodejs";

/** Seat A invites seat B into duo household. */
export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      replace?: boolean;
    };

    const ensured = await ensureHouseholdForActiveSubscriber(user.id);
    let hh = ensured.household;

    if (!hh) {
      // Prefer concrete infra reasons over a false "need subscribe".
      const infra = [
        "household_schema_missing",
        "admin_unconfigured",
        "create_failed",
        "update_failed",
        "lookup_failed",
      ];
      if (ensured.reason && infra.includes(ensured.reason)) {
        return NextResponse.json({ ok: false, error: ensured.reason }, { status: 500 });
      }
      if (!ensured.subscriptionActive || ensured.reason === "no_subscription") {
        return NextResponse.json({ ok: false, error: "no_subscription" }, { status: 400 });
      }
      return NextResponse.json(
        { ok: false, error: ensured.reason ?? "create_failed" },
        { status: 500 },
      );
    }

    if (hh.seat_a_user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "only_seat_a_can_invite" }, { status: 403 });
    }

    if (body.replace === true && hh.seat_b_user_id) {
      const cleared = await clearSeatBForReplace({ actorUserId: user.id });
      if (!cleared.ok) {
        return NextResponse.json({ ok: false, error: cleared.reason }, { status: 400 });
      }
      hh = cleared.household;
    }

    const result = await createSeatInvite({
      householdId: hh.id,
      actorUserId: user.id,
      inviteEmail: body.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      token: result.token,
      expires_at: result.expires_at,
      invite_path: `/account/household/accept?token=${encodeURIComponent(result.token)}`,
    });
  } catch (e) {
    console.error("[api/household/invite-seat]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
