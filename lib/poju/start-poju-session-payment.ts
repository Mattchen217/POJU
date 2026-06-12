export const POJU_PENDING_ACTION_KEY = "poju_pending_action";
export const POJU_PENDING_EXTEND_SESSION_KEY = "poju_pending_extend_session_id";
export const POJU_PENDING_RESTORE_SESSION_KEY = "poju_pending_restore_session_id";
export const POJU_PENDING_SNOOZE_KEY = "poju_pending_expiry_snooze";
export const POJU_PENDING_ORDER_KEY = "poju_pending_order_id";

export type PojuPendingPaymentAction = "extend" | "restore";

export async function redirectToPojuSessionPayment(input: {
  action: PojuPendingPaymentAction;
  sessionId: string;
  locale: string;
  snoozeReminder?: boolean;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;

  sessionStorage.setItem(POJU_PENDING_ACTION_KEY, input.action);
  sessionStorage.removeItem("poju_pending_question");
  if (input.action === "extend") {
    sessionStorage.setItem(POJU_PENDING_EXTEND_SESSION_KEY, input.sessionId);
    sessionStorage.removeItem(POJU_PENDING_RESTORE_SESSION_KEY);
  } else {
    sessionStorage.setItem(POJU_PENDING_RESTORE_SESSION_KEY, input.sessionId);
    sessionStorage.removeItem(POJU_PENDING_EXTEND_SESSION_KEY);
  }

  if (input.snoozeReminder) {
    sessionStorage.setItem(POJU_PENDING_SNOOZE_KEY, "1");
  } else {
    sessionStorage.removeItem(POJU_PENDING_SNOOZE_KEY);
  }

  const returnUrl = `${window.location.origin}/${input.locale}/poju/payment-success?action=${input.action}`;
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

export function clearPojuPendingPaymentStorage(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(POJU_PENDING_ACTION_KEY);
  sessionStorage.removeItem(POJU_PENDING_EXTEND_SESSION_KEY);
  sessionStorage.removeItem(POJU_PENDING_RESTORE_SESSION_KEY);
  sessionStorage.removeItem(POJU_PENDING_SNOOZE_KEY);
  sessionStorage.removeItem(POJU_PENDING_ORDER_KEY);
}

export function readPendingPaymentSnoozeFlag(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(POJU_PENDING_SNOOZE_KEY) === "1";
}
