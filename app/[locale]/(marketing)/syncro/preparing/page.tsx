"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";

import { SyncroPreparingPage } from "@/components/syncro/SyncroPreparingPage";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";

function SyncroPreparingFallback() {
  const t = useTranslations("session_prep");
  return (
    <PreparingStatusOverlay>
      <p className="preparing-spline-page__status">{t("preparing")}</p>
    </PreparingStatusOverlay>
  );
}

export default function SyncroPreparingRoutePage() {
  return (
    <Suspense fallback={<SyncroPreparingFallback />}>
      <SyncroPreparingPage />
    </Suspense>
  );
}
