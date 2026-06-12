/**
 * Flip to `true` when real product checkout (Stripe, etc.) is live.
 * Until then, all products behave as first-time free on the client.
 */
export const PAYMENT_GATEWAY_ENABLED = false;

export function isPaymentGatewayEnabled(): boolean {
  return PAYMENT_GATEWAY_ENABLED;
}
