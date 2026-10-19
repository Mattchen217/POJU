"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import "@/styles/checkout-legal-assent.css";

type Props = {
  /** flex | subscription | both — retained for callers; renew disclosure lives beside Subscribe CTA */
  mode: "flex" | "subscription" | "both";
  id?: string;
};

/**
 * Non-gating checkout footnotes (Payments lock 2026-10-19).
 * Link row only: Terms · Refund · Privacy · Cookies.
 * No checkbox — first-login DisclaimerModal covers must-agree.
 * Subscribe auto-renew one-liner is beside the Subscribe CTA (UnifiedPricingPanel), not here.
 */
export function CheckoutLegalFootnotes({ mode, id = "checkout-legal-footnotes" }: Props) {
  const t = useTranslations("passPurchase");

  return (
    <div className="checkout-legal-assent checkout-legal-footnotes" id={id} data-mode={mode}>
      <p className="checkout-legal-assent__links">
        <Link href="/terms">{t("legalLinkTerms")}</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/refund">{t("legalLinkRefund")}</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/privacy">{t("legalLinkPrivacy")}</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/cookies">{t("legalLinkCookies")}</Link>
      </p>
    </div>
  );
}