"use client";

import { useEffect, useMemo, useRef } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const phases = useMemo(() => {
    const list = daYun.slice(0, 8);
    return list.map((entry, i) => ({
      entry,
      next: list[i + 1],
      theme: DA_YUN_THEMES[i] ?? DA_YUN_THEMES[0],
      isNow: i === currentIndex,
      isFirst: i === 0,
      isLast: i === list.length - 1,
    }));
  }, [daYun, currentIndex]);

  useEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    if (!root || !list) return;

    const syncScale = () => {
      const h = root.clientHeight;
      const row = list.querySelector<HTMLElement>(".dayun-timeline__row:not(.dayun-timeline__row--now)");
      const rowH = row?.offsetHeight ?? 28;
      const scale = Math.max(0.82, Math.min(1.28, h / 340));
      root.style.setProperty("--dayun-scale", String(scale));
      root.style.setProperty("--dayun-row-h", `${rowH}px`);
    };

    syncScale();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncScale) : null;
    ro?.observe(root);
    window.addEventListener("resize", syncScale);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", syncScale);
    };
  }, [phases.length, currentIndex]);

  return (
    <div className="dayun-timeline dayun-timeline--fill" ref={rootRef}>
      <h3 className="dayun-timeline__title">{tc("timeline_matrix")}</h3>
      <div className="dayun-timeline__viewport">
        <div className="dayun-timeline__list" ref={listRef}>
          {phases.map((phase, i) => (
            <div
              key={`${phase.entry.ganzhi}-${i}`}
              className={[
                "dayun-timeline__row",
                phase.isNow ? "dayun-timeline__row--now" : "",
                phase.isFirst ? "dayun-timeline__row--edge-first" : "",
                phase.isLast ? "dayun-timeline__row--edge-last" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="dayun-timeline__main">
                {phase.isNow ? (
                  <span className="dayun-timeline__bullet" aria-hidden>
                    ✦
                  </span>
                ) : null}
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
    </div>
  );
}
