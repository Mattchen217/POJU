import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { createJointInvite } from "@/lib/passes/joint-decision";
import type { BirthInfo } from "@/lib/profile/types";

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
    const body = (await req.json().catch(() => ({}))) as {
      shared_question?: string;
      birth?: BirthInfo;
    };
    const q = typeof body.shared_question === "string" ? body.shared_question : "";
    if (!body.birth) {
      return NextResponse.json({ ok: false, error: "birth_required" }, { status: 400 });
    }
    const result = await createJointInvite({
      initiatorUserId: user.id,
      sharedQuestion: q,
      initiatorBirth: body.birth,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, joint: result.joint });
  } catch (e) {
    console.error("[api/joint/create]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
