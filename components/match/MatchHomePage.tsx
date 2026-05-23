"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { useRouter } from "@/i18n/navigation";
import { isFirstTimeFree } from "@/lib/syncro/device-usage";

import "@/styles/match.css";

type FeatureTitleKey =
  | "feature_two_charts"
  | "feature_relationship"
  | "feature_report";

type FeatureDescKey =
  | "feature_two_charts_desc"
  | "feature_relationship_desc"
  | "feature_report_desc";

function FeatureRow({
  icon,
  titleKey,
  descKey,
}: {
  icon: string;
  titleKey: FeatureTitleKey;
  descKey: FeatureDescKey;
}) {
  const t = useTranslations("match");
  return (
    <article className="match-feature-row">
      <span className="match-feature-icon" aria-hidden>
        {icon}
      </span>
      <div className="match-feature-text">
        <h3>{t(titleKey)}</h3>
        <p>{t(descKey)}</p>
      </div>
    </article>
  );
}

export function MatchHomePage() {
  const router = useRouter();
  const t = useTranslations("match");

  const [canFree, setCanFree] = useState<boolean | null>(null);

  useEffect(() => {
    void checkAccess();
  }, []);

  async function checkAccess() {
    const free = await isFirstTimeFree("match");
    setCanFree(free);
  }

  function handleStart() {
    if (canFree === null) return;

    if (canFree) {
      sessionStorage.setItem("match_session_type", "free");
      router.push("/match/select-a");
    } else {
      sessionStorage.setItem("match_session_type", "paid");
      router.push("/match/payment");
    }
  }

  if (canFree === null) {
    return (
      <main className="match-home match-home--loading">
        <p>{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="match-home">
      <div className="match-home-inner">
        <ArchiveReturnBanner />

        <header className="match-hero">
          <h1 className="match-title">MATCH</h1>
          <p className="match-subtitle">{t("subtitle")}</p>
          <p className="match-description">{t("description")}</p>
        </header>

        <div className="match-features">
          <FeatureRow icon="👥" titleKey="feature_two_charts" descKey="feature_two_charts_desc" />
          <FeatureRow icon="🔮" titleKey="feature_relationship" descKey="feature_relationship_desc" />
          <FeatureRow icon="📊" titleKey="feature_report" descKey="feature_report_desc" />
        </div>

        <section className="match-use-cases">
          <h2>{t("use_cases_title")}</h2>
          <ul>
            <li>{t("use_case_1")}</li>
            <li>{t("use_case_2")}</li>
            <li>{t("use_case_3")}</li>
            <li>{t("use_case_4")}</li>
          </ul>
        </section>

        <div className="match-cta">
          <button type="button" onClick={handleStart} className="match-primary-btn">
            {canFree ? t("start_free") : t("start_paid")}
          </button>
          <p className="match-cta-note">{canFree ? t("free_note") : t("paid_note")}</p>
        </div>
      </div>
    </main>
  );
}
