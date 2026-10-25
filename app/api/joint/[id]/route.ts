import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { getJointForUser } from "@/lib/passes/joint-decision";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const result = await getJointForUser(id, user.id);
    if (!result.ok) {
      const status = result.reason === "forbidden" ? 403 : 404;
      return NextResponse.json({ ok: false, error: result.reason }, { status });
    }
    return NextResponse.json({
      ok: true,
      joint: result.joint,
      seed: result.seed ?? null,
    });
  } catch (e) {
    console.error("[api/joint/id]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
