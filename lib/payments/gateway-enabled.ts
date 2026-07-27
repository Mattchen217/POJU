/**
 * Flip to `true` when real product checkout (Stripe, Dodo, etc.) is live.
 * While `false`:
 * - Client treats first-time / paywall flows as free or auto-unlock on pay click
 * - `/api/payments/verify` accepts all orders as paid (mock checkout)
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
