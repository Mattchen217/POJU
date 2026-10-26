import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  clearSeatBForReplace,
  listHouseholdSeatsForViewer,
} from "@/lib/passes/household";

export const runtime = "nodejs";

/** Seat A removes seat B binding (shared sub stays on household / seat A). */
export async function POST() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const result = await clearSeatBForReplace({ actorUserId: user.id });
    if (!result.ok) {
      const status =
        result.reason === "only_seat_a_can_bind"
          ? 403
          : result.reason === "no_subscription"
            ? 400
            : 400;
      return NextResponse.json({ ok: false, error: result.reason }, { status });
    }

    const seats = await listHouseholdSeatsForViewer(result.household, user.id);
    return NextResponse.json({
      ok: true,
      seats,
      household: {
        id: result.household.id,
        status: result.household.status,
        shared_sub_balance: result.household.shared_sub_balance,
        quota: result.household.quota,
      },
    });
  } catch (e) {
    console.error("[api/household/unbind-seat]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
