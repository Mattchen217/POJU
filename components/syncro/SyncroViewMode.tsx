"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  CURRENT_LEVELS,
  DIRECTIONS,
  type DirectionId,
} from "@/lib/syncro/current-system";
import { findBestDirectionForPeriod } from "@/lib/syncro/syncro-view-helpers";
import { HOUR_PERIODS, matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

const GRID_LAYOUT: Array<{ dir: DirectionId | "CENTER"; gridArea: string }> = [
  { dir: "NW", gridArea: "nw" },
  { dir: "N", gridArea: "n" },
  { dir: "NE", gridArea: "ne" },
  { dir: "W", gridArea: "w" },
  { dir: "CENTER", gridArea: "c" },
  { dir: "E", gridArea: "e" },
  { dir: "SW", gridArea: "sw" },
  { dir: "S", gridArea: "s" },
  { dir: "SE", gridArea: "se" },
];

export type SyncroViewModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  highlightMatrixKeys?: Set<string>;
};

export function SyncroViewMode({ session, locale, hourPeriod, highlightMatrixKeys }: SyncroViewModeProps) {
  const t = useTranslations("syncro.view");
  const isZh = locale.startsWith("zh");

  const recommended = findBestDirectionForPeriod(session, hourPeriod);
  const [focusedDirection, setFocusedDirection] = useState<DirectionId>(recommended);

  const focusedCell = session.matrix[matrixKey(hourPeriod, focusedDirection)];
  const periodLabel = isZh ? HOUR_PERIODS[hourPeriod].name_zh : HOUR_PERIODS[hourPeriod].name_en;

  return (
    <div className="syncro-view-mode">
      <p className="syncro-view-mode-period">
        {periodLabel}
        <span className="syncro-view-mode-period-sub"> · {t("grid_subtitle")}</span>
      </p>

      <div className="syncro-view-grid">
        {GRID_LAYOUT.map((slot) => {
          const dir = slot.dir;
          if (dir === "CENTER") {
            const recInfo = DIRECTIONS[recommended];
            return (
              <div key="center" className="syncro-view-cell syncro-view-cell--you" style={{ gridArea: slot.gridArea }}>
                <span className="syncro-view-you-label">{t("you")}</span>
                <span className="syncro-view-you-dir">{isZh ? recInfo.name_zh : recInfo.name_en}</span>
                <span className="syncro-view-you-hint">{t("recommended")}</span>
              </div>
            );
          }

          const cell = session.matrix[matrixKey(hourPeriod, dir)];
          if (!cell) return null;

          const level = CURRENT_LEVELS[cell.current_level];
          const dirInfo = DIRECTIONS[dir];
          const isRecommended = dir === recommended;
          const isFocused = dir === focusedDirection;

          const cellKey = matrixKey(hourPeriod, dir);
          const llmUpdated = highlightMatrixKeys?.has(cellKey);

          return (
            <button
              key={dir}
              type="button"
              className={`syncro-view-cell ${isFocused ? "focused" : ""} ${isRecommended ? "recommended" : ""} ${llmUpdated ? "syncro-llm-cell-updated" : ""}`}
              style={{ gridArea: slot.gridArea, borderColor: level.color_hex }}
              onClick={() => setFocusedDirection(dir)}
            >
              <span className="syncro-view-dir">{isZh ? dirInfo.name_zh : dirInfo.name_en}</span>
              <span className="syncro-view-level" style={{ color: level.color_hex }}>
                {isZh ? level.name_zh : level.name_en}
              </span>
            </button>
          );
        })}
      </div>

      {focusedCell ? (
        <div
          className={`syncro-view-detail ${highlightMatrixKeys?.has(matrixKey(hourPeriod, focusedDirection)) ? "syncro-llm-cell-updated" : ""}`}
        >
          <p className="syncro-view-detail-advice">{focusedCell.short_advice}</p>
        </div>
      ) : null}
    </div>
  );
}
