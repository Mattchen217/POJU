import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import "@/styles/match.css";

/**
 * Match paid checkout — placeholder until payment wiring (Step 2 CTA target).
 */
export default async function MatchPaymentPage() {
  const t = await getTranslations("match");
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
