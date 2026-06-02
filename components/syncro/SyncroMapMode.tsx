"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { SyncroModeFooter } from "@/components/syncro/SyncroModeFooter";
import { SyncroRingStage } from "@/components/syncro/SyncroRingStage";
import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import {
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import type { CurrentLevel, DirectionId } from "@/lib/syncro/current-system";
import { isSyncroLlmReady } from "@/lib/syncro/llm-cell-display";
import {
  SYNCRO_CENTER_INFO_WIDTH,
  SYNCRO_MAP_POINT_RADIUS,
  SYNCRO_MAP_POINT_SIZE,
} from "@/lib/syncro/syncro-ring-layout";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-compass.css";

const DIRECTIONS = [
  { id: "N", angle: 0 },
  { id: "NE", angle: 45 },
  { id: "E", angle: 90 },
  { id: "SE", angle: 135 },
  { id: "S", angle: 180 },
  { id: "SW", angle: 225 },
  { id: "W", angle: 270 },
  { id: "NW", angle: 315 },
] as const;

const POINT_COLORS: Record<CurrentLevel, string> = {
  open_current: "#00D9B8",
  following_current: "#4ECDC4",
  stillwater: "#8A8AA0",
  crosscurrent: "#E89F4D",
  undertow: "#C85A5A",
};

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
  activeDirection: selectedDir,
  onSelectDirection: setSelectedDir,
  highlightMatrixKeys,
}: SyncroMapModeProps) {
  const t = useTranslations("syncro");
  const tLevels = useTranslations("syncro.levels");
  const isZh = locale.startsWith("zh");
  const [whyOpen, setWhyOpen] = useState(false);

  const cellKey = matrixKey(hourPeriod, selectedDir);
  const cell = session.matrix[cellKey];
  const llmHighlight = highlightMatrixKeys?.has(cellKey);

  const whyReady = Boolean(cell && isSyncroLlmReady(cell, session.llm_meta));
  const whyHasRationale = Boolean(cell?.rationale?.trim());
  const canOpenWhy = whyReady || whyHasRationale;

  const levelKey = cell ? getCurrentLevelI18nKey(cell.current_level) : null;
  let levelTitle = "";
  if (cell && levelKey) {
    try {
      levelTitle = tLevels(levelKey);
    } catch {
      levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
    }
  }

  const mapPoints = (
    <>
      {DIRECTIONS.map((dir) => {
        const rad = ((dir.angle - 90) * Math.PI) / 180;
        const x = Math.cos(rad) * SYNCRO_MAP_POINT_RADIUS;
        const y = Math.sin(rad) * SYNCRO_MAP_POINT_RADIUS;
        const dirCell = session.matrix[matrixKey(hourPeriod, dir.id as DirectionId)];
        const color = POINT_COLORS[dirCell?.current_level ?? "stillwater"];
        const isSelected = dir.id === selectedDir;

        return (
          <button
            key={dir.id}
            type="button"
            onClick={() => setSelectedDir(dir.id as DirectionId)}
            className={`syncro-map-point ${isSelected ? "is-selected" : ""}`}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: isSelected ? SYNCRO_MAP_POINT_SIZE + 4 : SYNCRO_MAP_POINT_SIZE,
              height: isSelected ? SYNCRO_MAP_POINT_SIZE + 4 : SYNCRO_MAP_POINT_SIZE,
              borderRadius: "50%",
              background: isSelected ? "#D4A574" : color,
              border: "none",
              cursor: "pointer",
              padding: 0,
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              boxShadow: isSelected
                ? "0 0 20px rgba(212, 165, 116, 0.5)"
                : `0 0 8px ${color}`,
              transition: "all 200ms ease",
              zIndex: 4,
            }}
            aria-label={dir.id}
          />
        );
      })}
    </>
  );

  return (
    <div className={`compass-mode-body map-mode-body ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      <SyncroRingStage
        highlightId={selectedDir}
        enableRotation={false}
        particleOpacity={0.5}
        ringOverlay={mapPoints}
        center={
          <div style={{ width: SYNCRO_CENTER_INFO_WIDTH }}>
            <div className="compass-center-direction">{selectedDir}</div>
            {cell ? (
              <div
                className="compass-center-level"
                style={{ color: POINT_COLORS[cell.current_level], marginTop: 4 }}
              >
                {levelTitle}
              </div>
            ) : null}
          </div>
        }
      />

      <SyncroModeFooter
        cell={cell}
        llmMeta={session.llm_meta}
        canOpenWhy={canOpenWhy}
        onWhyClick={() => setWhyOpen(true)}
        hint={<p className="syncro-map-hint">{t("map.tap_hint")}</p>}
      />

      {whyOpen && cell && canOpenWhy ? (
        <WhyThisCurrentModal
          cell={cell}
          direction={selectedDir}
          hourId={hourPeriod}
          onClose={() => setWhyOpen(false)}
        />
      ) : null}
    </div>
  );
}
