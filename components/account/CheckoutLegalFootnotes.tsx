"use client";

import { Link } from "@/i18n/navigation";

import "@/styles/checkout-legal-assent.css";

type Props = {
  /** flex = Buy Pass one-time; subscription = personal plan (shows auto-renew footnote) */
  mode: "flex" | "subscription" | "both";
  id?: string;
};

/**
 * Non-gating checkout footnotes (Payments lock 2026-10-19).
 * No checkbox — first-login DisclaimerModal already covers 18+/Disclaimer/Terms/Privacy/Refund/Cookies.
 * CTAs must stay enabled; this is informational only.
 */
export function CheckoutLegalFootnotes({ mode, id = "checkout-legal-footnotes" }: Props) {
  const showFlex = mode === "flex" || mode === "both";
  const showSub = mode === "subscription" || mode === "both";

  return (
    <div className="checkout-legal-assent checkout-legal-footnotes" id={id} data-mode={mode}>
      <p className="checkout-legal-assent__note">
        By completing this purchase, you agree to the{" "}
        <Link href="/terms">Terms of Service</Link>,{" "}
        <Link href="/refund">Refund Policy</Link>, and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      {showFlex ? (
        <p className="checkout-legal-assent__note">
          Buy Pass is valid until used. Unused one-time PASS may be refundable anytime while unused
          under the Refund Policy. Other refunds follow the payment provider&apos;s rules as shown
          at checkout and on your receipt.
        </p>
      ) : null}

      {showSub ? (
        <p className="checkout-legal-assent__note" data-footnote="subscribe-renew">
          Subscription renews automatically until you cancel. Cancel anytime via the billing
          portal or support. Unused PASS from the current billing period expire when that period
          ends.
        </p>
      ) : null}

      <p className="checkout-legal-assent__note checkout-legal-assent__note--muted">
        Your receipt email confirms billing. It is not a backup of your chat or deliverables.
        Refunds follow our Refund Policy and the payment provider&apos;s rules. We do not promise a
        one-click refund unless that feature is shown for your purchase.
      </p>

      <p className="checkout-legal-assent__links">
        <Link href="/terms">Terms</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/refund">Refund</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/cookies">Cookies</Link>
      </p>
    </div>
  );
}
