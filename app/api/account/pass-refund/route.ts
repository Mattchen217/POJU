import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  quoteFlexPassRefund,
  requestCreemFlexPassRefund,
} from "@/lib/passes/refund-flex-passes";

export const runtime = "nodejs";

const BodySchema = z
  .object({
    quantity: z.number().int().min(1).max(999).optional(),
    qty: z.number().int().min(1).max(999).optional(),
    /** When true, return FIFO quote only (no debit / no provider call). */
    preview: z.boolean().optional(),
  })
  .refine((b) => (b.quantity ?? b.qty) != null, { message: "quantity_required" });

/**
 * Refund purchased (flex) Passes — Path A (1 PASS = 1 Creem transaction).
 * POST { quantity } => N FIFO full refunds via Creem POST /v1/refunds.
 * POST { quantity, preview: true } => dollar quote from original intents.
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

    const quantity = parsed.data.quantity ?? parsed.data.qty!;
    const { preview } = parsed.data;

    if (preview) {
      const quote = await quoteFlexPassRefund({ userId: user.id, quantity });
      if (!quote.ok) {
        const status =
          quote.reason === "nothing_to_refund" ||
          quote.reason === "quantity_exceeds_balance" ||
          quote.reason === "insufficient_refundable_units" ||
          quote.reason === "missing_original_amounts"
            ? 400
            : quote.reason === "admin_unconfigured"
              ? 503
              : 500;
        return NextResponse.json({ ok: false, error: quote.reason ?? "quote_failed" }, { status });
      }
      return NextResponse.json({
        ok: true,
        preview: true,
        quantity: quote.quantity,
        amount_cents: quote.amount_cents,
        flex_balance: quote.flex_balance,
        unit_transaction_ids: quote.units?.map((u) => u.transaction_id) ?? [],
      });
    }

    const result = await requestCreemFlexPassRefund({
      userId: user.id,
      quantity,
    });

    if (!result.ok) {
      const status =
        result.reason === "nothing_to_refund" ||
        result.reason === "quantity_exceeds_balance" ||
        result.reason === "insufficient_refundable_units" ||
        result.reason === "missing_original_amounts"
          ? 400
          : result.reason === "admin_unconfigured"
            ? 503
            : result.reason === "provider_refund_failed"
              ? 502
              : 500;
      return NextResponse.json({ ok: false, error: result.reason ?? "refund_failed" }, { status });
    }

    return NextResponse.json({
      ok: true,
      mock: result.mock === true,
      refund_id: result.refund_id,
      refund_ids: result.refund_ids,
      quantity: result.quantity,
      amount_cents: result.amount_cents,
      flex_balance: result.flex_after,
      sub_balance: result.sub_after,
      pass_balance: result.total_after,
    });
  } catch (error) {
    console.error("[account/pass-refund]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "refund_failed" }, { status: 500 });
  }
}
