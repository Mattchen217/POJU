"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { StoredProfileData } from "@/lib/db/poju-db";
import {
  currentPhaseFromBaseAnalysis,
  getElementLabel,
  profileBirthInfo,
  splitPillar,
  strengthFromBaseAnalysis,
} from "@/lib/poju/chart-loader-display";

const STEP_COUNT = 9;

export interface ChartReadingLoaderProps {
  profile: StoredProfileData;
  currentStep: string;
  error: string | null;
  onRetry: () => void;
  onRefund: () => void;
  locale: string;
}

export function ChartReadingLoader({
  profile,
  currentStep,
  error,
  onRetry,
  onRefund,
  locale,
}: ChartReadingLoaderProps) {
  const t = useTranslations("chart_loader");
  const steps = useMemo(
    () => Array.from({ length: STEP_COUNT }, (_, i) => t(`step_${i}` as "step_0")),
    [t],
  );
  const [animatedStep, setAnimatedStep] = useState(0);

  useEffect(() => {
    if (currentStep === "error" || currentStep === "done") return;

    const interval = setInterval(() => {
      setAnimatedStep((prev) => {
        if (currentStep === "analyzing" || currentStep === "loading") {
          return (prev + 1) % steps.length;
        }
        if (currentStep === "using_cache") {
          return Math.min(prev + 1, steps.length - 1);
        }
        return prev;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [currentStep, steps.length]);

  return (
    <div className="chart-loader-page">
      <div className="chart-loader-content">
        <BaziChartDisplay profile={profile} locale={locale} />

        <div className="loader-status-section">
          {currentStep === "error" && error ? (
            <ErrorView error={error} onRetry={onRetry} onRefund={onRefund} />
          ) : currentStep === "done" ? (
            <DoneView />
          ) : (
            <StreamingView
              currentText={steps[animatedStep] ?? steps[0] ?? ""}
              isUsingCache={currentStep === "using_cache"}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BaziChartDisplay({ profile, locale }: { profile: StoredProfileData; locale: string }) {
  const t = useTranslations("chart_loader");
  const bazi = profile.user_profile.bazi;
  const birth = profileBirthInfo(profile);
  const strength = strengthFromBaseAnalysis(profile, locale);
  const currentPhase = currentPhaseFromBaseAnalysis(profile);
  const dayMaster = profile.user_profile.diagnosis.dayMaster;
  const favorable = profile.user_profile.diagnosis.favorableElements[0];

  const pillars = [
    { label: t("pillar_year"), ganzhi: bazi.yearPillar, isDayMaster: false },
    { label: t("pillar_month"), ganzhi: bazi.monthPillar, isDayMaster: false },
    { label: t("pillar_day"), ganzhi: bazi.dayPillar, isDayMaster: true },
    { label: t("pillar_hour"), ganzhi: bazi.hourPillar, isDayMaster: false },
  ];

  return (
    <div className="bazi-chart-display">
      <div className="chart-header">
        <h3>{t("your_chart_title")}</h3>
        <p className="birth-info-line">
          {birth.year}.{String(birth.month).padStart(2, "0")}.{String(birth.day).padStart(2, "0")}
          {" · "}
          {birth.gender === "M" ? t("male") : t("female")}
          {" · "}
          {birth.timezone}
        </p>
      </div>

      <div className="four-pillars">
        {pillars.map((p) => {
          const { stem, branch } = splitPillar(p.ganzhi);
          return (
            <PillarColumn
              key={p.label}
              label={p.label}
              stem={stem}
              branch={branch}
              isDayMaster={p.isDayMaster}
            />
          );
        })}
      </div>

      <div className="chart-meta">
        <div className="meta-row">
          <span className="meta-label">{t("day_master_label")}:</span>
          <span className="meta-value gold">
            {dayMaster}
            {favorable ? ` (${getElementLabel(favorable, locale)})` : ""}
          </span>
        </div>
        {strength ? (
          <div className="meta-row">
            <span className="meta-label">{t("strength_label")}:</span>
            <span className="meta-value">{strength}</span>
          </div>
        ) : null}
        {currentPhase ? (
          <div className="meta-row">
            <span className="meta-label">{t("current_phase_label")}:</span>
            <span className="meta-value">{currentPhase}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PillarColumn({
  label,
  stem,
  branch,
  isDayMaster,
}: {
  label: string;
  stem: string;
  branch: string;
  isDayMaster?: boolean;
}) {
  return (
    <div className={`pillar-column ${isDayMaster ? "day-master" : ""}`}>
      <div className="pillar-label">{label}</div>
      <div className="pillar-stem">{stem}</div>
      <div className="pillar-branch">{branch}</div>
    </div>
  );
}

function StreamingView({
  currentText,
  isUsingCache,
}: {
  currentText: string;
  isUsingCache: boolean;
}) {
  const t = useTranslations("chart_loader");

  return (
    <div className="streaming-view">
      <div className="streaming-spinner-container">
        <div className="streaming-spinner" aria-hidden />
      </div>
      <div className="streaming-text-area">
        <p key={currentText} className="streaming-current-line">
          {currentText}
        </p>
      </div>
      <p className="streaming-hint">
        {isUsingCache ? t("hint_using_cache") : t("hint_first_time")}
      </p>
    </div>
  );
}

function DoneView() {
  const t = useTranslations("chart_loader");
  return (
    <div className="done-view">
      <div className="done-icon" aria-hidden>
        ✓
      </div>
      <p>{t("done_message")}</p>
    </div>
  );
}

function ErrorView({
  error,
  onRetry,
  onRefund,
}: {
  error: string;
  onRetry: () => void;
  onRefund: () => void;
}) {
  const t = useTranslations("chart_loader");

  return (
    <div className="error-view">
      <div className="error-icon" aria-hidden>
        ✕
      </div>
      <h3>{t("error_title")}</h3>
      <p>{t("error_message")}</p>
      <details className="error-details">
        <summary>{t("error_details")}</summary>
        <pre>{error}</pre>
      </details>
      <div className="error-actions">
        <button type="button" onClick={onRetry} className="primary">
          {t("retry")}
        </button>
        <button type="button" onClick={onRefund} className="secondary">
          {t("refund_instead")}
        </button>
      </div>
    </div>
  );
}
