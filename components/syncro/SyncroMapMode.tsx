"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import {
  currentLevelMapPointStatusClass,
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import {
  currentLevelCssClass,
  DIRECTIONS,
  type DirectionId,
} from "@/lib/syncro/current-system";
import { findBestDirectionForPeriod } from "@/lib/syncro/syncro-view-helpers";
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-map.css";

const DIRECTIONS_ON_CIRCLE: Array<{ id: DirectionId; angle: number }> = [
  { id: "N", angle: 0 },
  { id: "NE", angle: 45 },
  { id: "E", angle: 90 },
  { id: "SE", angle: 135 },
  { id: "S", angle: 180 },
  { id: "SW", angle: 225 },
  { id: "W", angle: 270 },
  { id: "NW", angle: 315 },
];

const MAP_RADIUS = 110;
const MAP_LABEL_OFFSET = 24;

export type SyncroMapModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  activeDirection: DirectionId;
  onSelectDirection: (dir: DirectionId) => void;
  highlightMatrixKeys?: Set<string>;
};

export function SyncroMapMode({
  session,
  locale,
  hourPeriod,
  activeDirection,
  onSelectDirection,
  highlightMatrixKeys,
}: SyncroMapModeProps) {
  const t = useTranslations("syncro");
  const tLevels = useTranslations("syncro.levels");
  const resolvedLocale = useLocale();
  const isZh = locale.startsWith("zh");

  const [whyModalOpen, setWhyModalOpen] = useState(false);

  const recommended = findBestDirectionForPeriod(session, hourPeriod);
  const activeCell = session.matrix[matrixKey(hourPeriod, activeDirection)];
  const activeKey = matrixKey(hourPeriod, activeDirection);
  const llmHighlight = highlightMatrixKeys?.has(activeKey);

  useEffect(() => {
    if (!session.matrix[matrixKey(hourPeriod, activeDirection)]) {
      onSelectDirection(recommended);
    }
  }, [hourPeriod, activeDirection, recommended, session.matrix, onSelectDirection]);

  function directionLabel(dir: DirectionId): string {
    const info = DIRECTIONS[dir];
    return isZh ? info.name_zh : info.name_en;
  }

  let levelTitle = "";
  if (activeCell) {
    const levelKey = getCurrentLevelI18nKey(activeCell.current_level);
    try {
      levelTitle = tLevels(levelKey);
    } catch {
      levelTitle = getCurrentLevelFallbackLabel(activeCell.current_level, isZh);
    }
  }

  const hourMeta = `${hourPeriodDisplayName(hourPeriod, resolvedLocale)} · ${HOUR_PERIOD_RANGES[hourPeriod]}`;

  return (
    <div className={`map-mode ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      <div className="map-container">
        <div className="map-circle">
          <div className="map-ring" aria-hidden />

          {DIRECTIONS_ON_CIRCLE.map((dir) => {
            const cell = session.matrix[matrixKey(hourPeriod, dir.id)];
            const rad = (dir.angle * Math.PI) / 180;
            const x = Math.sin(rad) * MAP_RADIUS;
            const y = -Math.cos(rad) * MAP_RADIUS;
            const isActive = dir.id === activeDirection;
            const statusClass = currentLevelMapPointStatusClass(cell?.current_level ?? "stillwater");

            return (
              <button
                key={dir.id}
                type="button"
                className={`map-point status-${statusClass} ${isActive ? "active" : ""}`}
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
                onClick={() => onSelectDirection(dir.id)}
                aria-label={directionLabel(dir.id)}
                aria-pressed={isActive}
              />
            );
          })}

          {DIRECTIONS_ON_CIRCLE.map((dir) => {
            const rad = (dir.angle * Math.PI) / 180;
            const labelRadius = MAP_RADIUS + MAP_LABEL_OFFSET;
            const x = Math.sin(rad) * labelRadius;
            const y = -Math.cos(rad) * labelRadius;
            const isActive = dir.id === activeDirection;

            return (
              <span
                key={`label-${dir.id}`}
                className={`map-dir-label ${isActive ? "active" : ""}`}
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
              >
                {directionLabel(dir.id)}
              </span>
            );
          })}

          <div className="map-center-card">
            <div className="map-center-direction">{activeDirection}</div>
            {activeCell ? (
              <>
                <div className={`map-center-level ${currentLevelCssClass(activeCell.current_level)}`}>
                  {levelTitle}
                </div>
                <div className="map-center-meta">{hourMeta}</div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="map-footer">
        {activeCell ? (
          <>
            <p className="short-advice">{activeCell.short_advice}</p>
            <button type="button" className="why-btn" onClick={() => setWhyModalOpen(true)}>
              {t("why_this_current")}
            </button>
          </>
        ) : null}
        <div className="map-hint">{t("map.tap_hint")}</div>
      </div>

      {whyModalOpen && activeCell ? (
        <WhyThisCurrentModal
          cell={activeCell}
          direction={activeDirection}
          hourId={hourPeriod}
          onClose={() => setWhyModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
