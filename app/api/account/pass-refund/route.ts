import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { requestDodoFlexPassRefund } from "@/lib/passes/refund-flex-passes";

export const runtime = "nodejs";

const BodySchema = z.object({
  quantity: z.number().int().min(1).max(999),
});

/**
 * Refund purchased (flex) Passes via Dodo (placeholder) and debit balance.
 */
export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }

    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const result = await requestDodoFlexPassRefund({
      userId: user.id,
      quantity: parsed.data.quantity,
    });

    if (!result.ok) {
      const status =
        result.reason === "nothing_to_refund" || result.reason === "quantity_exceeds_balance"
          ? 400
          : result.reason === "admin_unconfigured"
            ? 503
            : 500;
      return NextResponse.json({ ok: false, error: result.reason ?? "refund_failed" }, { status });
    }

    return NextResponse.json({
      ok: true,
      mock: result.mock === true,
      refund_id: result.refund_id,
      quantity: result.quantity,
      flex_balance: result.flex_after,
      sub_balance: result.sub_after,
      pass_balance: result.total_after,
    });
  } catch (error) {
    console.error("[account/pass-refund]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "refund_failed" }, { status: 500 });
  }
}
