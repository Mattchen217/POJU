import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  ensureHouseholdForActiveSubscriber,
  householdIsFull,
  householdPeerUserId,
  listHouseholdSeatsForViewer,
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
        seats: [
          { role: "seat_a", user_id: null, email: null, is_you: false },
          { role: "seat_b", user_id: null, email: null, is_you: false },
        ],
        can_joint: false,
        subscription_active: subscriptionActive,
        joint_enabled: subscriptionActive,
        can_bind_seat: false,
      });
    }

    const peer = householdPeerUserId(hh, user.id);
    const seats = await listHouseholdSeatsForViewer(hh, user.id);
    const isSeatA = hh.seat_a_user_id === user.id;

    return NextResponse.json({
      ok: true,
      household: {
        id: hh.id,
        status: hh.status,
        shared_sub_balance: hh.shared_sub_balance,
        quota: hh.quota,
        role: isSeatA ? "seat_a" : "seat_b",
        peer_bound: Boolean(peer),
        peer_user_id: peer,
        current_period_end: hh.current_period_end,
      },
      seats,
      can_joint: householdIsFull(hh) && hh.shared_sub_balance >= 2,
      subscription_active: true,
      joint_enabled: true,
      can_bind_seat: isSeatA && !hh.seat_b_user_id,
    });
  } catch (e) {
    console.error("[api/household/me]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
