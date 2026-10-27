import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  cancelJointAsInitiator,
  declineJointAsInvitee,
  getJointForUser,
} from "@/lib/passes/joint-decision";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — initiator cancels invite, or invitee declines (删除待同意).
 * Body optional: `{ "as": "initiator" | "invitee" }` — otherwise inferred from role.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const jointId = id?.trim() ?? "";
    if (!jointId) {
      return NextResponse.json({ ok: false, error: "missing_joint_id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { as?: string };
    const view = await getJointForUser(jointId, user.id);
    if (!view.ok) {
      const status = view.reason === "forbidden" ? 403 : 404;
      return NextResponse.json({ ok: false, error: view.reason }, { status });
    }

    const asRole =
      body.as === "initiator" || body.as === "invitee" ? body.as : view.joint.role;

    if (asRole === "initiator") {
      const result = await cancelJointAsInitiator({ jointId, userId: user.id });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
      }
      return NextResponse.json({ ok: true, action: "canceled" });
    }

    const result = await declineJointAsInvitee({ jointId, userId: user.id });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, action: "declined" });
  } catch (e) {
    console.error("[api/joint/cancel]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
