"use client";

import { useTranslations } from "next-intl";

import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { getCurrentHourPeriod, matrixKey, type HourPeriod, type SyncroMatrix } from "@/lib/syncro/types";
import type { DirectionId } from "@/lib/syncro/current-system";

const HOUR_SEQUENCE: HourPeriod[] = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
];

const DIRECTIONS: DirectionId[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export type HourDotStatus = "now" | "done" | "generating" | "pending";

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
  orderedPeriods,
  livePeriod,
  activeHour,
  onSelect,
  locale,
}: HourProgressBarProps) {
  const t = useTranslations("syncro.hour");

  const currentHourPeriod = livePeriod;
  const startIdx = HOUR_SEQUENCE.indexOf(currentHourPeriod);
  const sortedPeriods =
    startIdx >= 0
      ? [...HOUR_SEQUENCE.slice(startIdx), ...HOUR_SEQUENCE.slice(0, startIdx)]
      : orderedPeriods.length > 0
        ? orderedPeriods
        : HOUR_SEQUENCE;

  const activeIdx = sortedPeriods.findIndex((p) => p === activeHour);
  const active = sortedPeriods[activeIdx >= 0 ? activeIdx : 0] ?? sortedPeriods[0]!;
  const activeIsLive = active === livePeriod && activeIdx === 0;

  function getStatus(hourIdx: number): HourDotStatus {
    if (hourIdx === 0) return "now";

    const period = sortedPeriods[hourIdx];
    if (!period) return "pending";

    const cells = DIRECTIONS.map((dir) => matrix[matrixKey(period, dir)]).filter(Boolean);
    if (cells.length === 0) return "pending";

    const allDone = cells.every((cell) => cell && !cell.llm_pending);
    const someDone = cells.some((cell) => cell && !cell.llm_pending);

    if (allDone) return "done";
    if (someDone) return "generating";
    return "pending";
  }

  return (
    <div className="hour-progress-bar" role="tablist" aria-label={t("aria_label")}>
      <div className="hour-track">
        <div className="hour-line" aria-hidden />
        {sortedPeriods.map((period, idx) => {
          const status = getStatus(idx);
          const isActive = period === activeHour;

          return (
            <button
              key={period}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`hour-dot status-${status} ${isActive ? "selected" : ""}`}
              onClick={() => onSelect(period)}
              aria-label={`${hourPeriodDisplayName(period, locale)} · ${HOUR_PERIOD_RANGES[period]}`}
            />
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
    </div>
  );
}

export function getCurrentHourPeriodId(date: Date = new Date()): HourPeriod {
  return getCurrentHourPeriod(date);
}
