"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";

/**
 * Paid checkout placeholder — payment gateway not wired yet.
 * Sends users into the real Syncro v5 flow (task → prepare → location → compute).
 */
export function SyncroPaymentPage() {
  const router = useRouter();
  const t = useTranslations("syncro");

  useEffect(() => {
    router.replace("/syncro/prepare?type=paid");
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 text-center text-text-body">
      <p className="text-sm text-text-secondary">{t("loading")}</p>
      <p className="mt-4 max-w-md text-sm leading-7 text-text-secondary">{t("payment_coming_soon")}</p>
      <Link href="/syncro/prepare?type=paid" className="mt-6 text-sm text-cyan-200 underline">
        {t("payment_continue_without_checkout")}
      </Link>
    </main>
  );
}
