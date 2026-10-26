import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  ensureHouseholdForActiveSubscriber,
  householdIsFull,
  householdPeerUserId,
} from "@/lib/passes/household";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { household: hh, subscriptionActive } =
      await ensureHouseholdForActiveSubscriber(user.id);

    if (!hh) {
      return NextResponse.json({
        ok: true,
        household: null,
        can_joint: false,
        subscription_active: subscriptionActive,
        joint_enabled: subscriptionActive,
      });
    }

    const peer = householdPeerUserId(hh, user.id);
    return NextResponse.json({
      ok: true,
      household: {
        id: hh.id,
        status: hh.status,
        shared_sub_balance: hh.shared_sub_balance,
        quota: hh.quota,
        role: hh.seat_a_user_id === user.id ? "seat_a" : "seat_b",
        peer_bound: Boolean(peer),
        peer_user_id: peer,
        current_period_end: hh.current_period_end,
      },
      can_joint: householdIsFull(hh) && hh.shared_sub_balance >= 2,
      subscription_active: true,
      /** Lit CTA when subscribed (household exists or was just backfilled). */
      joint_enabled: true,
    });
  } catch (e) {
    console.error("[api/household/me]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
