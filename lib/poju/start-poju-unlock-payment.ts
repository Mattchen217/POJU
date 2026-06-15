import {
  POJU_PENDING_ACTION_KEY,
  POJU_PENDING_ORDER_KEY,
} from "@/lib/poju/start-poju-session-payment";
import { POJU_PENDING_UNLOCK_SESSION_KEY } from "@/lib/poju/preview-unlock";

/** Paywall inline — unlock existing preview session after payment. */
export async function redirectToPojuUnlockPayment(input: {
  sessionId: string;
  locale: string;
  pendingQuestion: string;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  sessionStorage.setItem(POJU_PENDING_ACTION_KEY, "unlock");
  sessionStorage.setItem(POJU_PENDING_UNLOCK_SESSION_KEY, input.sessionId);
  sessionStorage.setItem("poju_pending_question", input.pendingQuestion);

  const returnUrl = `${window.location.origin}/${input.locale}/poju/payment-success?action=unlock`;
  const pay = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product: "poju", locale: input.locale, return_url: returnUrl }),
  });
  const p = (await pay.json()) as {
    checkout_url?: string;
    payment_url?: string;
    order_id?: string;
  };
  const target = p.payment_url ?? p.checkout_url;
  if (!target) return false;

  if (p.order_id) sessionStorage.setItem(POJU_PENDING_ORDER_KEY, p.order_id);
  window.location.href = target;
  return true;
}
