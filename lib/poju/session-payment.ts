/** POJU session list price (USD) — matches payment create route. */
export const POJU_SESSION_PRICE_USD = 9.99;

export function isMockPaymentId(paymentId: string): boolean {
  const id = paymentId.trim();
  return id.startsWith("mockpoju_") || id.startsWith("mock-");
}
