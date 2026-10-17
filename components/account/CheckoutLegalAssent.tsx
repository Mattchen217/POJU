"use client";

import { Link } from "@/i18n/navigation";

import "@/styles/checkout-legal-assent.css";

type Props = {
  /** flex = Buy Pass one-time; subscription = personal plan */
  mode: "flex" | "subscription";
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Disable continue until checked — parent should also gate CTA */
  id?: string;
};

/**
 * Checkout C assent (MICROCOPY AgeGate-Checkout EN 2026-10-16 PUBLIC C).
 * Shown on Buy Pass / Subscribe confirm layer before redirect to hosted checkout.
 * Landing-style glass; no Stripe/Dodo vendor names; no hardcoded dollar amounts.
 */
export function CheckoutLegalAssent({
  mode,
  checked,
  onCheckedChange,
  id = "checkout-legal-assent",
}: Props) {
  return (
    <div className="checkout-legal-assent" data-mode={mode}>
      <label className="checkout-legal-assent__check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span>
          By completing this purchase, you agree to the{" "}
          <Link href="/terms">Terms of Service</Link>,{" "}
          <Link href="/refund">Refund Policy</Link>, and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>

      {mode === "subscription" ? (
        <p className="checkout-legal-assent__note">
          Subscription renews automatically until you cancel. Cancel anytime via the billing
          portal or support. Unused PASS from the current billing period expire when that period
          ends.
        </p>
      ) : (
        <p className="checkout-legal-assent__note">
          Buy Pass is valid until used. Unused one-time PASS may be refundable anytime while unused
          under the Refund Policy. Other refunds follow the payment provider&apos;s rules as shown
          at checkout and on your receipt.
        </p>
      )}

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
