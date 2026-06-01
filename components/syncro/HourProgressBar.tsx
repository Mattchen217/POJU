"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";
import {
  getHourDotStatus,
  type HourDotStatus,
} from "@/lib/syncro/hour-progress-status";
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { getCurrentHourPeriod, type HourPeriod, type SyncroMatrix } from "@/lib/syncro/types";

export type { HourDotStatus };

export type HourProgressBarProps = {
  matrix: SyncroMatrix;
  orderedPeriods: HourPeriod[];
  livePeriod: HourPeriod;
  activeHour: HourPeriod;
  onSelect: (hourId: HourPeriod) => void;
  locale: string;
  progress?: {
    completed_batches: number;
    total_batches: number;
  };
};

export function HourProgressBar({
  matrix,
  livePeriod,
  activeHour,
  onSelect,
  locale,
}: HourProgressBarProps) {
  const t = useTranslations("syncro.hour");
  const currentRef = useRef<HTMLButtonElement>(null);

  const sortedPeriods = sortedHourPeriodsFromLive(livePeriod);

  const activeIdx = sortedPeriods.findIndex((p) => p === activeHour);
  const active = sortedPeriods[activeIdx >= 0 ? activeIdx : 0] ?? sortedPeriods[0]!;
  const activeIsLive = active === livePeriod && activeIdx === 0;

  useEffect(() => {
    currentRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [livePeriod]);

  return (
    <div className="hour-progress-bar" role="tablist" aria-label={t("aria_label")}>
      <div className="hour-track">
        <div className="hour-line" aria-hidden />
        {sortedPeriods.map((period) => {
          const status = getHourDotStatus(period, livePeriod, matrix, sortedPeriods);
          const isSelected = period === activeHour;
          const canClick = status === "done" || status === "now";
          const shortName = hourPeriodDisplayName(period, locale);

          return (
            <button
              key={period}
              ref={period === livePeriod ? currentRef : undefined}
              type="button"
              role="tab"
              aria-selected={isSelected}
              disabled={!canClick}
              className={`hour-dot status-${status} ${isSelected ? "selected" : ""}`}
              onClick={() => {
                if (canClick) onSelect(period);
              }}
              aria-label={`${shortName} · ${HOUR_PERIOD_RANGES[period]}`}
            >
              <span className="hour-dot-label">{shortName}</span>
            </button>
          );
        })}
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
