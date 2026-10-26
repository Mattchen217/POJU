import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { agreeJointInvite } from "@/lib/passes/joint-decision";
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
      joint_id?: string;
      birth?: BirthInfo;
    };
    const jointId = typeof body.joint_id === "string" ? body.joint_id.trim() : "";
    if (!jointId) {
      return NextResponse.json({ ok: false, error: "missing_joint_id" }, { status: 400 });
    }
    if (!body.birth) {
      return NextResponse.json({ ok: false, error: "birth_required" }, { status: 400 });
    }
    const result = await agreeJointInvite({
      jointId,
      inviteeUserId: user.id,
      inviteeBirth: body.birth,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, joint: result.joint });
  } catch (e) {
    console.error("[api/joint/agree]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
