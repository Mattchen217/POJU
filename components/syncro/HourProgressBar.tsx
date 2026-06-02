"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";
import {
  getHourDotStatus,
  type HourDotStatus,
} from "@/lib/syncro/hour-progress-status";
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import {
  getCurrentHourPeriod,
  type HourPeriod,
  type SyncroMatrix,
  type SyncroSession,
} from "@/lib/syncro/types";

export type { HourDotStatus };

/** Fixed width per hour slot on the scroll rail (px). */
const HOUR_SLOT_WIDTH_PX = 44;

export type HourProgressBarProps = {
  matrix: SyncroMatrix;
  llmMeta: SyncroSession["llm_meta"];
  orderedPeriods: HourPeriod[];
  livePeriod: HourPeriod;
  activeHour: HourPeriod;
  onSelect: (hourId: HourPeriod) => void;
  onRetryHour?: (hourId: HourPeriod) => void;
  retryingHour?: HourPeriod | null;
  locale: string;
  progress?: {
    completed_batches: number;
    total_batches: number;
  };
  failedHourIds?: HourPeriod[];
};

export function HourProgressBar({
  matrix,
  llmMeta,
  livePeriod,
  activeHour,
  onSelect,
  onRetryHour,
  retryingHour = null,
  locale,
  failedHourIds = [],
}: HourProgressBarProps) {
  const t = useTranslations("syncro.hour");
  const viewportRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Partial<Record<HourPeriod, HTMLDivElement>>>({});

  const sortedPeriods = sortedHourPeriodsFromLive(livePeriod);

  const activeIdx = sortedPeriods.findIndex((p) => p === activeHour);
  const active = sortedPeriods[activeIdx >= 0 ? activeIdx : 0] ?? sortedPeriods[0]!;
  const activeIsLive = active === livePeriod && activeIdx === 0;

  function scrollHourToCenter(period: HourPeriod, behavior: ScrollBehavior = "smooth") {
    const viewport = viewportRef.current;
    const slot = slotRefs.current[period];
    if (!viewport || !slot) return;
    const target =
      slot.offsetLeft + slot.offsetWidth / 2 - viewport.clientWidth / 2;
    viewport.scrollTo({ left: Math.max(0, target), behavior });
  }

  useEffect(() => {
    scrollHourToCenter(livePeriod, "smooth");
  }, [livePeriod]);

  useEffect(() => {
    if (activeHour !== livePeriod) {
      scrollHourToCenter(activeHour, "smooth");
    }
  }, [activeHour, livePeriod]);

  return (
    <div className="hour-progress-bar" role="tablist" aria-label={t("aria_label")}>
      <div
        ref={viewportRef}
        className="hour-track-viewport"
        style={{ ["--hour-slot-width" as string]: `${HOUR_SLOT_WIDTH_PX}px` }}
      >
        <div className="hour-track-rail">
          <div className="hour-line" aria-hidden />
          {sortedPeriods.map((period) => {
            const status = getHourDotStatus(
              period,
              livePeriod,
              matrix,
              sortedPeriods,
              llmMeta,
              failedHourIds,
            );
            const isSelected = period === activeHour;
            const canSelect = status === "done" || status === "now";
            const canRetry = status === "failed" && Boolean(onRetryHour);
            const canClick = canSelect || canRetry;
            const isRetrying = retryingHour === period;
            const shortName = hourPeriodDisplayName(period, locale);

            return (
              <div
                key={period}
                ref={(el) => {
                  if (el) slotRefs.current[period] = el;
                  else delete slotRefs.current[period];
                }}
                className="hour-dot-slot"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  disabled={!canClick || isRetrying}
                  className={`hour-dot status-${status} ${isSelected ? "selected" : ""} ${isRetrying ? "is-retrying" : ""}`}
                  title={canRetry ? t("retry_failed") : undefined}
                  onClick={() => {
                    if (canRetry && onRetryHour) onRetryHour(period);
                    else if (canSelect) onSelect(period);
                  }}
                  aria-label={`${shortName} · ${HOUR_PERIOD_RANGES[period]}`}
                >
                  <span className="hour-dot-core" aria-hidden />
                </button>
                <span className={`hour-dot-label ${status === "now" ? "is-now" : ""}`}>
                  {shortName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hour-display">
        <span className={`hour-name ${activeIsLive ? "is-now" : ""}`}>
          {hourPeriodDisplayName(active, locale)}
        </span>
        <span className="hour-divider">·</span>
        <span className={`hour-range ${activeIsLive ? "is-now" : ""}`}>
          {HOUR_PERIOD_RANGES[active]}
        </span>
        {activeIsLive ? (
          <>
            <span className="hour-divider is-now">·</span>
            <span className="hour-now-tag">{t("now")}</span>
          </>
        ) : null}
      </div>

      <div className="hour-legend" aria-hidden>
        <span className="legend-item">
          <span className="legend-dot status-now" />
          {t("legend.now")}
        </span>
        <span className="legend-item">
          <span className="legend-dot status-done" />
          {t("legend.done")}
        </span>
        <span className="legend-item">
          <span className="legend-dot status-pending" />
          {t("legend.pending")}
        </span>
        <span className="legend-item">
          <span className="legend-dot status-failed" />
          {t("legend.failed")}
        </span>
      </div>
    </div>
  );
}

export function getCurrentHourPeriodId(date: Date = new Date()): HourPeriod {
  return getCurrentHourPeriod(date);
}
