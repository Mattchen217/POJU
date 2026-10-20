/**
 * Flip to `true` when real Stripe / Creem Checkout is live.
 * While `false`:
 * - Pricing checkout returns mock session URLs (gateway placeholder)
 * - `/api/checkout/confirm` still credits Passes as if paid
 * - Pass refund Confirm completes locally (debit flex + mark payment_records) without provider HTTP
 * - Product unlocks require Pass balance (buy/subscribe first) — not free auto-unlock
 */
export const PAYMENT_GATEWAY_ENABLED = false;

export function isPaymentGatewayEnabled(): boolean {
  return PAYMENT_GATEWAY_ENABLED;
}

/** Dev/mock checkout ids from `/api/payments/create` until the real gateway is wired. */
export function isMockOrderId(orderId: string): boolean {
  return (
    orderId.startsWith("mockpoju_") ||
    orderId.startsWith("mockglyph_") ||
    orderId.startsWith("mockmatch_") ||
    orderId.startsWith("mocksyncro_") ||
    orderId.startsWith("mock_cs_") ||
    orderId.startsWith("mock-") ||
    orderId.startsWith("mock_")
  );
}
