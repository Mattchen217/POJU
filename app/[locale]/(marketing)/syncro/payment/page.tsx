import { getTranslations } from "next-intl/server";

/**
 * Syncro paid checkout — placeholder until payment wiring (Step 5 CTA target).
 */
export default async function SyncroPaymentPage() {
  const t = await getTranslations("syncro");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 text-center text-text-body">
      <h1 className="text-xl font-semibold text-text-primary">{t("start_paid")}</h1>
      <p className="mt-4 max-w-md text-sm leading-7 text-text-secondary">{t("payment_coming_soon")}</p>
    </main>
  );
}
