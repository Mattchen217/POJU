"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";

import { MatchPreparePage } from "@/components/match/MatchPreparePage";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";

function MatchPrepareFallback() {
  const t = useTranslations("session_prep");
  return (
    <PreparingStatusOverlay>
      <p className="preparing-spline-page__status">{t("preparing")}</p>
    </PreparingStatusOverlay>
  );
}

function MatchPrepareInner() {
  const params = useParams();
  const profileId = typeof params.profileId === "string" ? params.profileId : "";
  if (!profileId) return null;
  return <MatchPreparePage profileId={profileId} />;
}

export default function MatchPrepareRoutePage() {
  return (
    <Suspense fallback={<MatchPrepareFallback />}>
      <MatchPrepareInner />
    </Suspense>
  );
}
