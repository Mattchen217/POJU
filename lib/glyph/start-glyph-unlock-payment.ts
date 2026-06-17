export const GLYPH_PENDING_ACTION_KEY = "glyph_pending_action";
export const GLYPH_PENDING_READING_KEY = "glyph_pending_reading_id";
export const GLYPH_PENDING_ORDER_KEY = "glyph_pending_order_id";

/** Paywall inline — unlock glyph reading after payment. */
export async function redirectToGlyphUnlockPayment(input: {
  readingId: string;
  locale: string;
  pendingQuestion: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  sessionStorage.setItem(GLYPH_PENDING_ACTION_KEY, "unlock");
  sessionStorage.setItem(GLYPH_PENDING_READING_KEY, input.readingId);
  sessionStorage.setItem("glyph_pending_question", input.pendingQuestion);

  const returnUrl = `${window.location.origin}/${input.locale}/glyph/payment-success?action=unlock`;
  const pay = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product: "glyph", locale: input.locale, return_url: returnUrl }),
  });
  const p = (await pay.json()) as {
    checkout_url?: string;
    payment_url?: string;
    order_id?: string;
  };
  const target = p.payment_url ?? p.checkout_url;
  if (!target) return false;

  if (p.order_id) sessionStorage.setItem(GLYPH_PENDING_ORDER_KEY, p.order_id);
  window.location.href = target;
  return true;
}

export function clearGlyphPendingPaymentStorage(): void {
  sessionStorage.removeItem(GLYPH_PENDING_ACTION_KEY);
  sessionStorage.removeItem(GLYPH_PENDING_READING_KEY);
  sessionStorage.removeItem(GLYPH_PENDING_ORDER_KEY);
  sessionStorage.removeItem("glyph_pending_question");
}
