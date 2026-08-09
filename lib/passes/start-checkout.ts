import {
  PENDING_INTENT_KEY,
  type PendingIntent,
} from "@/lib/auth/pending-intent";
import { currentCheckoutReturnPath } from "@/lib/passes/checkout-return-path";

export type StartCheckoutResult = {
  ok: boolean;
  error?: string;
  loginRequired?: boolean;
};

/**
 * Start Pass checkout (flex buy or subscription).
 * Unauthenticated → remember intent (+ return path) and send to login.
 * After payment, Stripe/mock returns to `returnPath` (defaults to current page).
 */
export async function startPassCheckout(
  intent: PendingIntent,
  locale: string,
  returnPath?: string,
): Promise<StartCheckoutResult> {
  const resumePath = returnPath?.trim() || currentCheckoutReturnPath(locale);
  const intentWithReturn: PendingIntent = {
    ...intent,
    return_path: resumePath,
  };

  try {
    const meRes = await fetch("/api/auth/me", { credentials: "same-origin" });
    const me = (await meRes.json().catch(() => ({}))) as {
      user?: { id?: string } | null;
    };
    if (!me.user?.id) {
      try {
        window.localStorage.setItem(PENDING_INTENT_KEY, JSON.stringify(intentWithReturn));
      } catch {
        /* ignore */
      }
      const next = encodeURIComponent(resumePath);
      window.location.href = `/${locale}/login?next=${next}`;
      return { ok: false, error: "login_required", loginRequired: true };
    }

    const checkoutRes = await fetch("/api/checkout/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        intent: intentWithReturn,
        locale,
        return_path: resumePath,
      }),
    });
    const data = (await checkoutRes.json().catch(() => ({}))) as {
      ok?: boolean;
      checkout_url?: string;
      error?: string;
    };
    if (!checkoutRes.ok || !data.ok || !data.checkout_url) {
      return { ok: false, error: data.error ?? "checkout_failed" };
    }
    window.location.href = data.checkout_url;
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
