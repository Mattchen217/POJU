/** Until a real gateway is wired, quick-start seeds the same sessionStorage keys as the question dialog flow. */
export const POJU_MOCK_PENDING_QUESTION = "I'd like to begin a POJU session.";

export async function redirectToPojuPayment(locale: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  sessionStorage.setItem("poju_pending_question", POJU_MOCK_PENDING_QUESTION);
  const returnUrl = `${window.location.origin}/${locale}/poju/payment-success`;
  const pay = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product: "poju", locale, return_url: returnUrl }),
  });
  const p = (await pay.json()) as {
    checkout_url?: string;
    payment_url?: string;
    order_id?: string;
  };
  const target = p.payment_url ?? p.checkout_url;
  if (!target) return false;

  if (p.order_id) sessionStorage.setItem("poju_pending_order_id", p.order_id);
  window.location.href = target;
  return true;
}
