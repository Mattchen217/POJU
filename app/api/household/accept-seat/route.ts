import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { acceptSeatInvite } from "@/lib/passes/household";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
    }
    const result = await acceptSeatInvite({ token, userId: user.id });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      household: {
        id: result.household.id,
        status: result.household.status,
        shared_sub_balance: result.household.shared_sub_balance,
        quota: result.household.quota,
      },
    });
  } catch (e) {
    console.error("[api/household/accept-seat]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
