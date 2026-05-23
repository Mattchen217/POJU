"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { SessionPreparation } from "@/components/poju/SessionPreparation";
import { useRouter } from "@/i18n/navigation";
import { listStoredProfiles, type StoredProfileSummary } from "@/lib/profile/stored-profiles-service";

import "@/styles/match.css";
import "@/styles/session-prep.css";

export function MatchSelectBPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("match");

  const [aProfileId, setAProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void init();
  }, [router]);

  async function init() {
    const aId = sessionStorage.getItem("match_a_profile_id");
    if (!aId) {
      router.replace("/match/select-a");
      return;
    }

    setAProfileId(aId);

    try {
      const list = await listStoredProfiles();
      setProfiles(list.filter((p) => p.profile_id !== aId));
    } catch (e) {
      console.error("[match/select-b]", e);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectB(profileId: string) {
    if (profileId === aProfileId) {
      alert(t("cannot_match_self"));
      return;
    }

    sessionStorage.setItem("match_b_profile_id", profileId);
    router.push("/match/relationship");
  }

  function handleCancel() {
    router.push("/match/select-a");
  }

  if (loading || !aProfileId) {
    return (
      <main className="match-select-page match-select-page--loading">
        <p>{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="match-select-page">
      <header className="match-select-header">
        <span className="match-step-indicator">{t("step_indicator", { step: 2, total: 3 })}</span>
        <h1>{t("select_b_title")}</h1>
        <p>{t("select_b_subtitle")}</p>
      </header>

      <SessionPreparation
        sessionId="match-b-temp"
        originalQuestion=""
        existingProfiles={profiles}
        onProfileSelected={handleSelectB}
        onRefund={handleCancel}
        locale={locale}
        productType="match"
        matchPerson="b"
        customLabel={t("select_b_label")}
        refundLabel={t("back_to_select_a")}
      />
    </main>
  );
}
