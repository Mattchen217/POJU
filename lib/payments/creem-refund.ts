/**
 * Creem MoR refund helper — Path A (2026-10-19).
 * Creem: POST /v1/refunds { transaction_id } — full refund only (no partial amount).
 * 1 PASS = 1 Creem transaction; refund qty N => N full refunds (FIFO unused).
 */

import { isPaymentGatewayEnabled, isMockOrderId } from "@/lib/payments/gateway-enabled";

export type CreemRefundResult = {
  ok: boolean;
  mock?: boolean;
  refund_id?: string;
  reason?: string;
};

function creemApiBase(): string {
  return (
    process.env.CREEM_API_BASE?.replace(/\/$/, "") ||
    "https://api.creem.io"
  );
}

function creemApiKey(): string | null {
  return process.env.CREEM_API_KEY?.trim() || null;
}

export function isMockProviderTransactionId(transactionId: string): boolean {
  const id = transactionId.trim();
  return (
    isMockOrderId(id) ||
    id.startsWith("mock_txn_") ||
    id.startsWith("mock_creem_") ||
    id.includes("__legacy")
  );
}

/**
 * Full-refund one Creem (or mock) transaction. No partial amount.
 */
export async function refundCreemTransaction(
  transactionId: string,
): Promise<CreemRefundResult> {
  const txn = transactionId.trim();
  if (!txn) return { ok: false, reason: "missing_transaction_id" };

  if (!isPaymentGatewayEnabled() || isMockProviderTransactionId(txn) || !creemApiKey()) {
    return {
      ok: true,
      mock: true,
      refund_id: `mock_creem_refund_${Date.now().toString(36)}_${txn.slice(-6)}`,
    };
  }

  try {
    const res = await fetch(`${creemApiBase()}/v1/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creemApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction_id: txn }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[creem] refund failed", res.status, body.slice(0, 200));
      return { ok: false, reason: "creem_refund_failed" };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string; refund_id?: string };
    const refundId = String(data.refund_id ?? data.id ?? "").trim();
    if (!refundId) {
      return { ok: false, reason: "creem_refund_missing_id" };
    }
    return { ok: true, mock: false, refund_id: refundId };
  } catch (error) {
    console.error("[creem] refund", error instanceof Error ? error.name : "unknown");
    return { ok: false, reason: "creem_refund_error" };
  }
}
