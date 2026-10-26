import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { startJointSide } from "@/lib/passes/joint-decision";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Same idempotent charge as start — used by “重新开始本次对话”. */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const result = await startJointSide({ jointId: id, userId: user.id });
    if (!result.ok) {
      const status = result.reason === "insufficient_pass" ? 402 : 400;
      return NextResponse.json({ ok: false, error: result.reason }, { status });
    }
    return NextResponse.json({
      ok: true,
      joint: result.joint,
      seed: result.seed,
      charged_from: result.charged_from,
      already_charged: result.already_charged,
    });
  } catch (e) {
    console.error("[api/joint/retry-start]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
