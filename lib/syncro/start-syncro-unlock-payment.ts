export const SYNCRO_PENDING_ACTION_KEY = "syncro_pending_action";
export const SYNCRO_PENDING_PREVIEW_KEY = "syncro_pending_preview_id";
export const SYNCRO_PENDING_ORDER_KEY = "syncro_pending_order_id";

/** Paywall inline — unlock syncro preview session after payment. */
export async function redirectToSyncroUnlockPayment(input: {
  previewId: string;
  locale: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  sessionStorage.setItem(SYNCRO_PENDING_ACTION_KEY, "unlock");
  sessionStorage.setItem(SYNCRO_PENDING_PREVIEW_KEY, input.previewId);

  const returnUrl = `${window.location.origin}/${input.locale}/syncro/payment-success?action=unlock`;
  const pay = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product: "syncro_ar", locale: input.locale, return_url: returnUrl }),
  });
  const p = (await pay.json()) as {
    checkout_url?: string;
    payment_url?: string;
    order_id?: string;
  };
  const target = p.payment_url ?? p.checkout_url;
  if (!target) return false;

  if (p.order_id) sessionStorage.setItem(SYNCRO_PENDING_ORDER_KEY, p.order_id);
  window.location.href = target;
  return true;
}

export function clearSyncroPendingPaymentStorage(): void {
  sessionStorage.removeItem(SYNCRO_PENDING_ACTION_KEY);
  sessionStorage.removeItem(SYNCRO_PENDING_PREVIEW_KEY);
  sessionStorage.removeItem(SYNCRO_PENDING_ORDER_KEY);
}
