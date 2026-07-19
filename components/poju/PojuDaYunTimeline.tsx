"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { SoftTermHover } from "@/components/cross-product/GlossaryText";
import { getStemInfo } from "@/lib/poju/bazi-matrix-mappings";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import {
  elementToSlug,
  matrixElementSoft,
} from "@/lib/poju/matrix-term-labels";

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

export function PojuDaYunTimeline({
  daYun,
  currentIndex,
  currentAge,
  locale,
}: Props) {
  const tc = useTranslations("poju_matrix.card");
  const zh = locale.startsWith("zh");
  const year = new Date().getFullYear();

  const phases = useMemo(() => {
    const list = daYun.slice(0, 8);
    return list.map((entry, i) => ({
      entry,
      next: list[i + 1],
      isNow: i === currentIndex,
    }));
  }, [daYun, currentIndex]);

  return (
    <div className="pcm-timeline__list">
      {phases.map((phase, i) => {
        const stemEl = getStemInfo(phase.entry.ganzhi.charAt(0))?.element;
        const elSoft = stemEl ? matrixElementSoft(stemEl, locale) : "";
        const elSlug = stemEl ? elementToSlug(stemEl) : null;
        const elNode =
          elSlug && elSoft ? (
            <SoftTermHover slug={elSlug} locale={locale} fallback={elSoft} />
          ) : (
            elSoft
          );

        if (phase.isNow) {
          return (
            <div
              key={`${phase.entry.ganzhi}-${i}`}
              className="pcm-timeline-row pcm-timeline-row--now"
            >
              <div className="pcm-timeline-row__range">
                {ageLabel(phase.entry, phase.next)}
                {phase.entry.start_year ? ` · ${phase.entry.start_year}` : ""}
              </div>
              <div className="pcm-timeline-row__meta">
                <span className="pcm-timeline-row__meta-left">
                  {zh
                    ? `${currentAge}岁 · ${year}年 ${tc("dayun_you_are_here")}`
                    : `Age ${currentAge} · ${year} · ${tc("dayun_you_are_here")}`}
                </span>
                {elNode ? (
                  <span className="pcm-timeline-row__el">{elNode}</span>
                ) : null}
              </div>
            </div>
          );
        }

        return (
          <div
            key={`${phase.entry.ganzhi}-${i}`}
            className={`pcm-timeline-row${i < currentIndex ? " pcm-timeline-row--mute" : ""}`}
          >
            <span className="pcm-timeline-row__range">
              {ageLabel(phase.entry, phase.next)}
              {phase.entry.start_year ? ` · ${phase.entry.start_year}` : ""}
            </span>
            {elNode ? (
              <span className="pcm-timeline-row__el">{elNode}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
