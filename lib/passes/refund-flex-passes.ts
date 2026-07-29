import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

export type FlexRefundResult = {
  ok: boolean;
  reason?: string;
  mock?: boolean;
  refund_id?: string;
  quantity?: number;
  flex_after?: number;
  sub_after?: number;
  total_after?: number;
};

/**
 * Placeholder Dodo Payments refund for purchased (flex) Passes.
 * When gateway is off: treat as completed and debit local flex balance.
 * TODO: call Dodo refund API with payment_id when PAYMENT_GATEWAY_ENABLED.
 */
export async function requestDodoFlexPassRefund(params: {
  userId: string;
  quantity: number;
}): Promise<FlexRefundResult> {
  const qty = Math.floor(params.quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return { ok: false, reason: "invalid_quantity" };
  }

  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }

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

  if (flexBefore < 1) {
    return { ok: false, reason: "nothing_to_refund" };
  }
  if (qty > flexBefore) {
    return { ok: false, reason: "quantity_exceeds_balance" };
  }

  // Payment gateway placeholder — always succeed until Dodo is wired.
  let refundId = `mock_dodo_refund_${Date.now()}`;
  let mock = true;
  if (isPaymentGatewayEnabled()) {
    // TODO: POST https://api.dodopayments.com/v1/refunds with payment_id + amount
    console.info("[passes] dodo flex refund placeholder", {
      userId: params.userId.slice(0, 8),
      quantity: qty,
    });
    mock = true;
    refundId = `pending_dodo_refund_${Date.now()}`;
  }

  const flexAfter = Math.max(0, flexBefore - qty);
  const totalAfter = flexAfter + subAfter;
  const { error: writeErr } = await admin
    .from("user_passes")
    .update({
      flex_balance: flexAfter,
      pass_balance: totalAfter,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  if (writeErr) {
    console.error("[passes] refund write", writeErr.code ?? writeErr.message);
    return { ok: false, reason: "debit_failed" };
  }

  return {
    ok: true,
    mock,
    refund_id: refundId,
    quantity: qty,
    flex_after: flexAfter,
    sub_after: subAfter,
    total_after: totalAfter,
  };
}
