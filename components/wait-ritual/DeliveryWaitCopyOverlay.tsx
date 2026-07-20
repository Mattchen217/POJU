"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import type { DeliveryWaitPhaseState } from "@/lib/wait-ritual/use-delivery-wait-phase";

type Props = {
  copyPhase: DeliveryWaitPhaseState["copyPhase"];
  phase: DeliveryWaitPhaseState["phase"];
  stepIndex: number;
  isReturningUser?: boolean;
  /** Live SSE progress stage — replaces rotating steps when set. */
  liveProgressStage?: string | null;
  error?: string | null;
  onRetry?: () => void;
  onRefund?: () => void;
  secondaryActionLabel?: string;
};

const STEP_COUNTS: Record<string, number> = {
  bazi: 5,
  glyph: 4,
  match: 5,
  syncro: 4,
};

export function DeliveryWaitCopyOverlay({
  copyPhase,
  phase,
  stepIndex,
  isReturningUser = false,
  liveProgressStage = null,
  error,
  onRetry,
  onRefund,
  secondaryActionLabel,
}: Props) {
  const t = useTranslations("wait_ritual");
  const tChart = useTranslations("chart_loader");
  const [valueShown, setValueShown] = useState(false);

  useEffect(() => {
    if (phase === "bazi" || phase === "product") {
      setValueShown(true);
    }
  }, [phase]);

  const steps = useMemo(() => {
    const count = STEP_COUNTS[copyPhase === "bridge" ? "bazi" : copyPhase] ?? 4;
    const ns =
      copyPhase === "bazi"
        ? "bazi"
        : copyPhase === "glyph"
          ? "glyph"
          : copyPhase === "match"
            ? "match"
            : "syncro";
    return Array.from({ length: count }, (_, i) => `${ns}.steps.${i}`);
  }, [copyPhase]);

  if (error) {
    return (
      <div className="preparing-spline-page__overlay preparing-spline-page__overlay--error" role="alert">
        <div className="chart-loader-content error-view-inline">
          <div className="error-icon" aria-hidden>
            ✕
          </div>
          <h3>{tChart("error_title")}</h3>
          <p>{tChart("error_message")}</p>
          <details className="error-details">
            <summary>{tChart("error_details")}</summary>
            <pre>{error}</pre>
          </details>
          <div className="error-actions">
            <button type="button" onClick={onRetry} className="primary">
              {tChart("retry")}
            </button>
            <button type="button" onClick={onRefund} className="secondary">
              {secondaryActionLabel ?? tChart("refund_instead")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "bridge") {
    const bridgeKey = copyPhase === "match" ? "bridge.match" : "bridge.glyph";
    return (
      <PreparingStatusOverlay>
        <p className="delivery-wait-copy__bridge">{t(bridgeKey)}</p>
      </PreparingStatusOverlay>
    );
  }

  if (phase === "finishing") {
    const finishNs =
      copyPhase === "bazi"
        ? "bazi"
        : copyPhase === "glyph"
          ? "glyph"
          : copyPhase === "match"
            ? "match"
            : "syncro";
    return (
      <PreparingStatusOverlay>
        <p className="delivery-wait-copy__finish">{t(`${finishNs}.finish` as "glyph.finish")}</p>
      </PreparingStatusOverlay>
    );
  }

  if (phase === "converge" || phase === "exit") {
    return null;
  }

  const valueKey =
    copyPhase === "bazi" ? "bazi.value" : `${copyPhase}.value`;
  const subtitleKey =
    copyPhase === "bazi" && isReturningUser ? "bazi.subtitle_cached" : `${copyPhase}.subtitle`;
  const statusLine = liveProgressStage
    ? t(`progress.${liveProgressStage}` as "progress.chart_ready")
    : t(steps[stepIndex % steps.length] as "bazi.steps.0");

  // 底座 bazi 等待：去掉上方长段开场，只留实时状态 + 底部小字提示
  const showValue = copyPhase !== "bazi" && valueShown;

  return (
    <PreparingStatusOverlay>
      {showValue ? <p className="delivery-wait-copy__value">{t(valueKey)}</p> : null}
      <p
        key={statusLine}
        className="delivery-wait-copy__status delivery-wait-copy__status--breathe"
      >
        {statusLine}
      </p>
      <p className="delivery-wait-copy__subtitle">{t(subtitleKey)}</p>
    </PreparingStatusOverlay>
  );
}
