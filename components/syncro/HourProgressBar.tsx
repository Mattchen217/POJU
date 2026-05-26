"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  resolveHourProgressState,
  type HourProgressState,
} from "@/lib/syncro/syncro-view-helpers";
import { HOUR_PERIODS, type HourPeriod } from "@/lib/syncro/types";

export type HourProgressBarProps = {
  orderedPeriods: HourPeriod[];
  livePeriod: HourPeriod;
  selectedPeriod: HourPeriod;
  onSelectPeriod: (period: HourPeriod) => void;
  locale: string;
};

export function HourProgressBar({
  orderedPeriods,
  livePeriod,
  selectedPeriod,
  onSelectPeriod,
  locale,
}: HourProgressBarProps) {
  const t = useTranslations("syncro.progress");
  const isZh = locale.startsWith("zh");
  const prevLiveRef = useRef(livePeriod);

  useEffect(() => {
    prevLiveRef.current = livePeriod;
  }, [livePeriod]);

  const liveChanged = prevLiveRef.current !== livePeriod;

  return (
    <div className="syncro-hour-progress" role="tablist" aria-label={t("aria_label")}>
      <div className="syncro-hour-progress-track">
        {orderedPeriods.map((period) => {
          const state = resolveHourProgressState({
            period,
            livePeriod,
            selectedPeriod,
            orderedPeriods,
          });
          const label = isZh ? HOUR_PERIODS[period].name_zh : HOUR_PERIODS[period].name_en;

          return (
            <button
              key={period}
              type="button"
              role="tab"
              aria-selected={period === selectedPeriod}
              className={progressClass(state, period === livePeriod && liveChanged)}
              onClick={() => onSelectPeriod(period)}
              title={stateLabel(t, state)}
            >
              <span className="syncro-hour-progress-label">{label}</span>
            </button>
          );
        })}
      </div>
      {selectedPeriod !== livePeriod ? (
        <p className="syncro-hour-progress-hint">{t("manual_selection")}</p>
      ) : null}
    </div>
  );
}

function progressClass(state: HourProgressState, pulseLive: boolean): string {
  const base = `syncro-hour-progress-item syncro-hour-progress-item--${state}`;
  return pulseLive && state === "live" ? `${base} syncro-hour-progress-item--pulse` : base;
}

function stateLabel(t: (key: string) => string, state: HourProgressState): string {
  switch (state) {
    case "past":
      return t("state_past");
    case "live":
      return t("state_live");
    case "selected":
      return t("state_selected");
    default:
      return t("state_upcoming");
  }
}
