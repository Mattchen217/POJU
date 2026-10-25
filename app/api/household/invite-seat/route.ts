import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  createSeatInvite,
  findHouseholdForUser,
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
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const hh = await findHouseholdForUser(user.id);
    if (!hh) {
      return NextResponse.json({ ok: false, error: "no_duo_household" }, { status: 400 });
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
