"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { SyncroCellAdvice } from "@/components/syncro/SyncroCellAdvice";
import {
  SYNCRO_DIRECTION_RING_RADIUS_PCT,
  SyncroDirectionRing,
} from "@/components/syncro/SyncroDirectionRing";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import { isSyncroLlmReady } from "@/lib/syncro/llm-cell-display";
import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import {
  currentLevelMapPointStatusClass,
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import { currentLevelCssClass, type DirectionId } from "@/lib/syncro/current-system";
import { findBestDirectionForPeriod } from "@/lib/syncro/syncro-view-helpers";
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-compass.css";
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

export type SyncroMapModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  activeDirection: DirectionId;
  onSelectDirection: (dir: DirectionId) => void;
  highlightMatrixKeys?: Set<string>;
};

function MapDirectionPoints({
  session,
  hourPeriod,
  activeDirection,
  onSelectDirection,
}: {
  session: SyncroSession;
  hourPeriod: HourPeriod;
  activeDirection: DirectionId;
  onSelectDirection: (dir: DirectionId) => void;
}) {
  return (
    <>
      {DIRECTIONS_ON_CIRCLE.map((dir) => {
        const cell = session.matrix[matrixKey(hourPeriod, dir.id)];
        const isActive = dir.id === activeDirection;
        const statusClass = currentLevelMapPointStatusClass(cell?.current_level ?? "stillwater");
        const rad = ((dir.angle - 90) * Math.PI) / 180;
        const r = SYNCRO_DIRECTION_RING_RADIUS_PCT - 4;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;

        return (
          <button
            key={dir.id}
            type="button"
            className={`map-point status-${statusClass} ${isActive ? "active" : ""}`}
            style={{
              transform: `translate(calc(-50% + ${x}%), calc(-50% + ${y}%))`,
            }}
            onClick={() => onSelectDirection(dir.id)}
            aria-label={dir.id}
            aria-pressed={isActive}
          />
        );
      })}
    </>
  );
}

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
      <div className="map-mode-body">
        <div className="concentric-system map-larger">
          <SyncroParticleCore />
          <SyncroDirectionRing activeDirection={activeDirection} />

          <div className="map-center-layer">
            <MapDirectionPoints
              session={session}
              hourPeriod={hourPeriod}
              activeDirection={activeDirection}
              onSelectDirection={onSelectDirection}
            />

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

        {activeCell ? (
          <SyncroCellAdvice cell={activeCell} llmMeta={session.llm_meta} />
        ) : null}

        <div className="map-hint">{t("map.tap_hint")}</div>

        {activeCell ? (
          <div className="compass-bottom-cta">
            <button
              type="button"
              className="why-btn-prominent"
              disabled={!isSyncroLlmReady(activeCell, session.llm_meta)}
              onClick={() => setWhyModalOpen(true)}
            >
              {t("why_this_current")}
            </button>
          </div>
        ) : null}
      </div>

      {whyModalOpen && activeCell && isSyncroLlmReady(activeCell, session.llm_meta) ? (
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
