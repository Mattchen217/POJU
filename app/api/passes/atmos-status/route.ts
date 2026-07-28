import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";

export const runtime = "nodejs";

/** Check whether this account+record still has an active Atmos 30-day window. */
export async function GET(req: Request) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const recordKey = new URL(req.url).searchParams.get("record_key")?.trim() ?? "";
    if (!recordKey) {
      return NextResponse.json({ ok: false, error: "record_required" }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ ok: true, active: false, ends_at: null, admin: false });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("atmos_entitlements")
      .select("ends_at")
      .eq("user_id", user.id)
      .eq("record_key", recordKey)
      .maybeSingle();

    if (error) {
      console.error("[passes/atmos-status]", error.code);
      return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
    }

    const endsAt = data?.ends_at ? String(data.ends_at) : null;
    const active = Boolean(endsAt && new Date(endsAt).getTime() > Date.now());

    return NextResponse.json({
      ok: true,
      active,
      ends_at: endsAt,
    });
  } catch (error) {
    console.error("[passes/atmos-status]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "status_failed" }, { status: 500 });
  }
}
