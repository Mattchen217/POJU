"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { SessionPreparation } from "@/components/poju/SessionPreparation";
import { useRouter } from "@/i18n/navigation";
import { listStoredProfiles, type StoredProfileSummary } from "@/lib/profile/stored-profiles-service";

import "@/styles/match.css";
import "@/styles/session-prep.css";

export function MatchSelectAPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("match");

  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionType = sessionStorage.getItem("match_session_type");
    if (!sessionType) {
      router.replace("/match");
      return;
    }

    void (async () => {
      try {
        const list = await listStoredProfiles();
        setProfiles(list);
      } catch (e) {
        console.error("[match/select-a]", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function handleSelectA(profileId: string) {
    sessionStorage.setItem("match_a_profile_id", profileId);
    router.push("/match/select-b");
  }

  function handleCancel() {
    router.push("/match");
  }

  if (loading) {
    return (
      <main className="match-select-page match-select-page--loading">
        <p>{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="match-select-page">
      <header className="match-select-header">
        <span className="match-step-indicator">{t("step_indicator", { step: 1, total: 3 })}</span>
        <h1>{t("select_a_title")}</h1>
        <p>{t("select_a_subtitle")}</p>
      </header>

      <SessionPreparation
        sessionId="match-a-temp"
        originalQuestion=""
        existingProfiles={profiles}
        onProfileSelected={handleSelectA}
        onRefund={handleCancel}
        locale={locale}
        productType="match"
        customLabel={t("select_a_label")}
      />
    </main>
  );
}
