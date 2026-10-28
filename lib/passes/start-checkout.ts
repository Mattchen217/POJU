import {
  PENDING_INTENT_KEY,
  type PendingIntent,
} from "@/lib/auth/pending-intent";
import { currentCheckoutReturnPath } from "@/lib/passes/checkout-return-path";
import { dispatchPassesCredited } from "@/lib/passes/pass-client-events";

export type StartCheckoutResult = {
  ok: boolean;
  error?: string;
  loginRequired?: boolean;
  /** Mock / gateway-off: Passes credited and payment_records written in this call. */
  credited?: boolean;
};

function planTypeForConfirm(intent: PendingIntent): "flex_pass" | "personal" | "team" {
  if (intent.plan === "personal_plan") return "personal";
  if (intent.plan === "team_plan") return "team";
  return "flex_pass";
}

/**
 * Start Pass checkout (flex buy or subscription).
 * Unauthenticated → remember intent (+ return path) and send to login.
 * Gateway-off / mock: confirm immediately as paid → write purchase records + credit.
 * Live Stripe: redirect to Checkout; webhook / return banner confirms.
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
      error?: string;
    };
    // 503 session_uncertain / network / 5xx: stay put. Only a definite
    // signed-out probe (200 + no user) sends the browser to /login.
    if (!meRes.ok || me.error === "session_uncertain") {
      return { ok: false, error: "network_error" };
    }
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
      session_id?: string;
      mocked?: boolean;
      error?: string;
    };
    if (!checkoutRes.ok || !data.ok || !data.checkout_url) {
      return { ok: false, error: data.error ?? "checkout_failed" };
    }

    // Mock / gateway placeholder: treat buy+confirm as paid — write payment_records now.
    if (data.mocked && data.session_id) {
      const plan = planTypeForConfirm(intent);
      const quantity =
        intent.plan === "flex_pass" ? Math.max(1, intent.quantity ?? 1) : 1;
      const confirmRes = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          session_id: data.session_id,
          plan,
          quantity,
          mocked: true,
        }),
      });
      const confirmData = (await confirmRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!confirmRes.ok || !confirmData.ok) {
        return { ok: false, error: confirmData.error ?? "checkout_failed" };
      }
      dispatchPassesCredited();
      return { ok: true, credited: true };
    }

    window.location.href = data.checkout_url;
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
