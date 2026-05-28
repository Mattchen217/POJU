"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";

const STEP_COUNT = 9;

export interface ChartReadingLoaderProps {
  profile: StoredProfileData;
  currentStep: string;
  error: string | null;
  onRetry: () => void;
  onRefund: () => void;
  locale: string;
  /** e.g. Glyph full-reading wait copy */
  hintOverride?: string;
  /** 非 POJU 会话时用，例如 Syncro「返回」 */
  secondaryActionLabel?: string;
}

export function ChartReadingLoader({
  currentStep,
  error,
  onRetry,
  onRefund,
  hintOverride,
  secondaryActionLabel,
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

  if (currentStep === "error" && error) {
    return (
      <ErrorView
        error={error}
        onRetry={onRetry}
        onRefund={onRefund}
        secondaryActionLabel={secondaryActionLabel}
      />
    );
  }

  const statusLine = steps[animatedStep] ?? steps[0] ?? "";
  const hint =
    hintOverride ??
    (currentStep === "using_cache" ? t("hint_using_cache") : t("hint_first_time"));

  return (
    <PreparingStatusOverlay>
      {currentStep !== "done" ? (
        <>
          <p key={statusLine} className="preparing-spline-page__status">
            {statusLine}
          </p>
          <p className="preparing-spline-page__hint">{hint}</p>
        </>
      ) : (
        <p className="preparing-spline-page__status">{t("done_message")}</p>
      )}
    </PreparingStatusOverlay>
  );
}

function formatChartLoaderError(error: string, t: (key: string) => string): string {
  if (error === "NETWORK_LOAD_FAILED" || /load failed|failed to fetch/i.test(error)) {
    return t("error_network");
  }
  if (
    error === "BASE_ANALYSIS_CLIENT_TIMEOUT" ||
    /llm_batch_timeout|AbortError|timed?\s*out/i.test(error)
  ) {
    return t("error_timeout");
  }
  return error;
}

function ErrorView({
  error,
  onRetry,
  onRefund,
  secondaryActionLabel,
}: {
  error: string;
  onRetry: () => void;
  onRefund: () => void;
  secondaryActionLabel?: string;
}) {
  const t = useTranslations("chart_loader");
  const detail = formatChartLoaderError(error, t);

  return (
    <div className="preparing-spline-page__overlay preparing-spline-page__overlay--error" role="alert">
      <div className="chart-loader-content error-view-inline">
        <div className="error-icon" aria-hidden>
          ✕
        </div>
        <h3>{t("error_title")}</h3>
        <p>{t("error_message")}</p>
        <details className="error-details">
          <summary>{t("error_details")}</summary>
          <pre>{detail}</pre>
        </details>
        <div className="error-actions">
          <button type="button" onClick={onRetry} className="primary">
            {t("retry")}
          </button>
          <button type="button" onClick={onRefund} className="secondary">
            {secondaryActionLabel ?? t("refund_instead")}
          </button>
        </div>
      </div>
    </div>
  );
}

