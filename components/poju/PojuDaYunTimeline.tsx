"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { DA_YUN_THEMES } from "@/lib/poju/bazi-matrix-mappings";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";

type Props = {
  daYun: DaYunEntry[];
  currentIndex: number;
  currentAge: number;
  locale: string;
};

function ageLabel(entry: DaYunEntry, next: DaYunEntry | undefined): string {
  const end = next ? next.start_age - 1 : entry.start_age + 9;
  return `${entry.start_age}–${end}`;
}

export function PojuDaYunTimeline({ daYun, currentIndex, currentAge, locale }: Props) {
  const tc = useTranslations("poju_matrix.card");
  const zh = locale.startsWith("zh");
  const year = new Date().getFullYear();

  const phases = useMemo(() => {
    const list = daYun.slice(0, 8);
    return list.map((entry, i) => ({
      entry,
      next: list[i + 1],
      theme: DA_YUN_THEMES[i] ?? DA_YUN_THEMES[0],
      isNow: i === currentIndex,
    }));
  }, [daYun, currentIndex]);

  return (
    <div className="dayun-timeline">
      <h3 className="dayun-timeline__title">{tc("timeline_matrix")}</h3>
      <div className="dayun-timeline__list">
        {phases.map((phase, i) => (
          <div
            key={`${phase.entry.ganzhi}-${i}`}
            className={`dayun-timeline__row${phase.isNow ? " dayun-timeline__row--now" : ""}`}
          >
            <div className="dayun-timeline__main">
              {phase.isNow ? <span className="dayun-timeline__bullet" aria-hidden>◆</span> : null}
              <div className="dayun-timeline__copy">
                <div className="dayun-timeline__range">
                  {ageLabel(phase.entry, phase.next)} · {phase.theme}
                </div>
                {phase.isNow ? (
                  <div className="dayun-timeline__sub">
                    {zh ? `${currentAge}岁 · ${year}年` : `Age ${currentAge} · ${year}`}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="dayun-timeline__gz">
              <span className="dayun-timeline__ganzhi">{phase.entry.ganzhi}</span>
              {phase.isNow ? (
                <span className="dayun-timeline__here">{tc("dayun_you_are_here")}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
