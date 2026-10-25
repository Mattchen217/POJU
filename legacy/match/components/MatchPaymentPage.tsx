"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

/**
 * Paid checkout — redirects into the free Match flow until payment gateway is wired.
 */
export function MatchPaymentPage() {
  const router = useRouter();
  const t = useTranslations("match");

  useEffect(() => {
    if (!isPaymentGatewayEnabled()) {
      sessionStorage.setItem("match_session_type", "free");
      router.replace("/match/select-a");
    }
  }, [router]);

  if (!isPaymentGatewayEnabled()) {
    return (
      <main className="match-payment-page">
        <p className="match-payment-message">{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="match-payment-page">
      <h1 className="match-payment-title">{t("start_paid")}</h1>
      <p className="match-payment-message">{t("payment_coming_soon")}</p>
      <Link href="/match" className="match-payment-back">
        {t("back_to_home")}
      </Link>
    </main>
  );
}
