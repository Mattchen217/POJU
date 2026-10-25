export const MATCH_PENDING_ACTION_KEY = "match_pending_action";
export const MATCH_PENDING_PREVIEW_KEY = "match_pending_preview_id";
export const MATCH_PENDING_ORDER_KEY = "match_pending_order_id";

/** Paywall inline — unlock match preview session after payment. */
export async function redirectToMatchUnlockPayment(input: {
  previewId: string;
  locale: string;
  pendingQuestion: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  sessionStorage.setItem(MATCH_PENDING_ACTION_KEY, "unlock");
  sessionStorage.setItem(MATCH_PENDING_PREVIEW_KEY, input.previewId);
  sessionStorage.setItem("match_pending_question", input.pendingQuestion);

  const returnUrl = `${window.location.origin}/${input.locale}/match/payment-success?action=unlock`;
  const pay = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product: "match", locale: input.locale, return_url: returnUrl }),
  });
  const p = (await pay.json()) as {
    checkout_url?: string;
    payment_url?: string;
    order_id?: string;
  };
  const target = p.payment_url ?? p.checkout_url;
  if (!target) return false;

  if (p.order_id) sessionStorage.setItem(MATCH_PENDING_ORDER_KEY, p.order_id);
  window.location.href = target;
  return true;
}

export function clearMatchPendingPaymentStorage(): void {
  sessionStorage.removeItem(MATCH_PENDING_ACTION_KEY);
  sessionStorage.removeItem(MATCH_PENDING_PREVIEW_KEY);
  sessionStorage.removeItem(MATCH_PENDING_ORDER_KEY);
  sessionStorage.removeItem("match_pending_question");
}
