"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { HOUR_PERIODS, secondsToNextHourPeriod, type HourPeriod } from "@/lib/syncro/types";

export type SyncroTimerBarProps = {
  currentHourPeriod: HourPeriod;
  locale: string;
};

function formatPeriodRange(period: HourPeriod): string {
  const info = HOUR_PERIODS[period];
  if (period === "zi") {
    return "23:00 – 01:00";
  }
  return `${String(info.start_hour).padStart(2, "0")}:00 – ${String(info.end_hour).padStart(2, "0")}:00`;
}

export function SyncroTimerBar({ currentHourPeriod, locale }: SyncroTimerBarProps) {
  const t = useTranslations("syncro.timer");
  const [secondsLeft, setSecondsLeft] = useState(secondsToNextHourPeriod());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft(secondsToNextHourPeriod());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const periodInfo = HOUR_PERIODS[currentHourPeriod];
  const isZh = locale.startsWith("zh");

  const hours = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);

  return (
    <div className="syncro-timer-bar">
      <div className="timer-line-1">
        <span className="dot-live" aria-hidden />
        {t("live_label")} · {t("current_window_only")}
      </div>

      <div className="timer-line-2">
        <span className="period-name">{isZh ? periodInfo.name_zh : periodInfo.name_en}</span>
        <span className="period-time">({formatPeriodRange(currentHourPeriod)})</span>
      </div>

      <div className="timer-line-3">
        {t("next_update_in")} {hours > 0 ? `${hours}h ` : ""}
        {mins}min
      </div>

      <p className="timer-philosophy">{t("philosophy_line")}</p>
    </div>
  );
}
