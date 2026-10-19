import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { PLAN_PRICES_CENTS } from "@/lib/auth/pending-intent";
import { refundCreemTransaction } from "@/lib/payments/creem-refund";

export type FlexRefundUnit = {
  payment_record_id: string;
  transaction_id: string;
  amount_cents: number;
  created_at: string;
};

export type FlexRefundQuote = {
  ok: boolean;
  reason?: string;
  quantity?: number;
  amount_cents?: number;
  flex_balance?: number;
  units?: FlexRefundUnit[];
};

export type FlexRefundResult = {
  ok: boolean;
  reason?: string;
  mock?: boolean;
  refund_id?: string;
  refund_ids?: string[];
  quantity?: number;
  amount_cents?: number;
  flex_after?: number;
  sub_after?: number;
  total_after?: number;
};

type PaymentRow = {
  id: string;
  quantity: number | null;
  amount_cents: number | null;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
  status: string | null;
  created_at: string;
};

/** Expand payment_records into Path A unit slots (1 PASS = 1 txn). */
function expandFlexUnits(rows: PaymentRow[]): FlexRefundUnit[] {
  const units: FlexRefundUnit[] = [];
  for (const row of rows) {
    if ((row.status ?? "completed").toLowerCase() === "refunded") continue;
    const qty = Math.max(1, Math.floor(row.quantity ?? 1));
    const totalCents =
      typeof row.amount_cents === "number" && row.amount_cents > 0
        ? row.amount_cents
        : PLAN_PRICES_CENTS.flex_pass * qty;
    const perCents = qty > 0 ? Math.round(totalCents / qty) : PLAN_PRICES_CENTS.flex_pass;
    const baseTxn =
      row.stripe_payment_intent_id?.trim() ||
      row.stripe_session_id?.trim() ||
      row.id;
    for (let i = 0; i < qty; i++) {
      const transaction_id =
        qty === 1 ? baseTxn : `${baseTxn}__legacy${i}`;
      units.push({
        payment_record_id: row.id,
        transaction_id,
        amount_cents: perCents,
        created_at: row.created_at,
      });
    }
  }
  return units;
}

/**
 * Unused purchased units = completed flex rows minus already-consumed flex
 * (inferred from flex_balance). FIFO: oldest unused first.
 */
export async function quoteFlexPassRefund(params: {
  userId: string;
  quantity: number;
}): Promise<FlexRefundQuote> {
  const qty = Math.floor(params.quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return { ok: false, reason: "invalid_quantity" };
  }
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }

  const admin = createSupabaseAdminClient();
  const { data: bal, error: balErr } = await admin
    .from("user_passes")
    .select("flex_balance, pass_balance")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (balErr) {
    console.error("[passes] refund quote balance", balErr.code ?? balErr.message);
    return { ok: false, reason: "lookup_failed" };
  }

  const flexBalance =
    typeof bal?.flex_balance === "number"
      ? bal.flex_balance
      : typeof bal?.pass_balance === "number"
        ? bal.pass_balance
        : 0;

  if (flexBalance < 1) return { ok: false, reason: "nothing_to_refund", flex_balance: flexBalance };
  if (qty > flexBalance) {
    return { ok: false, reason: "quantity_exceeds_balance", flex_balance: flexBalance };
  }

  const { data: payRows, error: payErr } = await admin
    .from("payment_records")
    .select(
      "id, quantity, amount_cents, stripe_payment_intent_id, stripe_session_id, status, created_at",
    )
    .eq("user_id", params.userId)
    .eq("plan_type", "flex_pass")
    .order("created_at", { ascending: true });

  if (payErr) {
    console.error("[passes] refund quote payments", payErr.code ?? payErr.message);
    return { ok: false, reason: "lookup_failed" };
  }

  const allUnits = expandFlexUnits((payRows ?? []) as PaymentRow[]);
  const consumed = Math.max(0, allUnits.length - flexBalance);
  const unused = allUnits.slice(consumed);
  if (unused.length < qty) {
    return { ok: false, reason: "insufficient_refundable_units", flex_balance: flexBalance };
  }

  const selected = unused.slice(0, qty);
  const amount_cents = selected.reduce((s, u) => s + Math.max(0, u.amount_cents), 0);

  return {
    ok: true,
    quantity: qty,
    amount_cents,
    flex_balance: flexBalance,
    units: selected,
  };
}

/**
 * Path A: refund qty N unused purchased PASS via N× Creem full refunds (FIFO).
 * Debit ledger first; on provider failure restore ledger + clear refund marks.
 */
export async function requestDodoFlexPassRefund(params: {
  userId: string;
  quantity: number;
}): Promise<FlexRefundResult> {
  return requestCreemFlexPassRefund(params);
}

export async function requestCreemFlexPassRefund(params: {
  userId: string;
  quantity: number;
}): Promise<FlexRefundResult> {
  const quote = await quoteFlexPassRefund(params);
  if (!quote.ok || !quote.units?.length || quote.amount_cents == null) {
    return { ok: false, reason: quote.reason ?? "quote_failed" };
  }

  const qty = quote.quantity!;
  const units = quote.units;
  const admin = createSupabaseAdminClient();

  const { data: row, error: readErr } = await admin
    .from("user_passes")
    .select("flex_balance, sub_balance, pass_balance")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (readErr) {
    console.error("[passes] refund read", readErr.code ?? readErr.message);
    return { ok: false, reason: "lookup_failed" };
  }

  const flexBefore =
    typeof row?.flex_balance === "number"
      ? row.flex_balance
      : typeof row?.pass_balance === "number"
        ? row.pass_balance
        : 0;
  const subAfter = typeof row?.sub_balance === "number" ? row.sub_balance : 0;
  if (flexBefore < qty) {
    return { ok: false, reason: "quantity_exceeds_balance" };
  }

  const flexAfter = Math.max(0, flexBefore - qty);
  const totalAfter = flexAfter + subAfter;
  const { error: debitErr } = await admin
    .from("user_passes")
    .update({
      flex_balance: flexAfter,
      pass_balance: totalAfter,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);
  if (debitErr) {
    console.error("[passes] refund debit", debitErr.code ?? debitErr.message);
    return { ok: false, reason: "debit_failed" };
  }

  const refundIds: string[] = [];
  let anyMock = false;
  const markedRecordIds = new Set<string>();

  try {
    for (const unit of units) {
      const provider = await refundCreemTransaction(unit.transaction_id);
      if (!provider.ok || !provider.refund_id) {
        throw new Error(provider.reason ?? "creem_refund_failed");
      }
      if (provider.mock) anyMock = true;
      refundIds.push(provider.refund_id);

      if (!markedRecordIds.has(unit.payment_record_id)) {
        markedRecordIds.add(unit.payment_record_id);
        const now = new Date().toISOString();
        const { data: rec } = await admin
          .from("payment_records")
          .select("quantity, amount_cents")
          .eq("id", unit.payment_record_id)
          .maybeSingle();
        const recQty = Math.max(1, Math.floor(rec?.quantity ?? 1));
        const unitsFromThis = units.filter((u) => u.payment_record_id === unit.payment_record_id);
        if (recQty <= unitsFromThis.length) {
          const { error: markErr } = await admin
            .from("payment_records")
            .update({
              status: "refunded",
              refund_id: provider.refund_id,
              refunded_at: now,
            })
            .eq("id", unit.payment_record_id);
          if (markErr) {
            console.error("[passes] refund mark", markErr.code ?? markErr.message);
            throw new Error("mark_refunded_failed");
          }
        } else {
          // Legacy multi-qty row: reduce remaining quantity/amount (Path A prefers qty=1 rows).
          const left = recQty - unitsFromThis.length;
          const prevCents = typeof rec?.amount_cents === "number" ? rec.amount_cents : 0;
          const per = recQty > 0 ? Math.round(prevCents / recQty) : 0;
          const { error: markErr } = await admin
            .from("payment_records")
            .update({
              quantity: left,
              amount_cents: Math.max(0, per * left),
            })
            .eq("id", unit.payment_record_id);
          if (markErr) {
            console.error("[passes] refund reduce", markErr.code ?? markErr.message);
            throw new Error("mark_refunded_failed");
          }
        }
      }
    }
  } catch (error) {
    console.error("[passes] refund provider", error instanceof Error ? error.message : "unknown");
    // Restore ledger
    await admin
      .from("user_passes")
      .update({
        flex_balance: flexBefore,
        pass_balance: flexBefore + subAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", params.userId);
    // Best-effort clear refund marks on records we touched this attempt
    for (const id of markedRecordIds) {
      await admin
        .from("payment_records")
        .update({ status: "completed", refund_id: null, refunded_at: null })
        .eq("id", id)
        .eq("status", "refunded");
    }
    return { ok: false, reason: "provider_refund_failed" };
  }

  return {
    ok: true,
    mock: anyMock,
    refund_id: refundIds[0],
    refund_ids: refundIds,
    quantity: qty,
    amount_cents: quote.amount_cents,
    flex_after: flexAfter,
    sub_after: subAfter,
    total_after: totalAfter,
  };
}
