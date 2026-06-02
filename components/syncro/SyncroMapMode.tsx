"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { SyncroCellAdvice } from "@/components/syncro/SyncroCellAdvice";
import { SyncroDirectionLabels } from "@/components/syncro/SyncroDirectionLabels";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
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
  SYNCRO_RING_MARGIN_TOP,
  SYNCRO_RING_SIZE,
  SYNCRO_WHY_BUTTON_MARGIN_TOP,
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

  const levelKey = cell ? getCurrentLevelI18nKey(cell.current_level) : null;
  let levelTitle = "";
  if (cell && levelKey) {
    try {
      levelTitle = tLevels(levelKey);
    } catch {
      levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
    }
  }

  return (
    <div className={`compass-page ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      <div
        style={{
          position: "relative",
          width: SYNCRO_RING_SIZE,
          height: SYNCRO_RING_SIZE,
          margin: `${SYNCRO_RING_MARGIN_TOP}px auto 0`,
          overflow: "visible",
        }}
      >
        <SyncroParticleCore bare opacity={0.5} />

        <SyncroDirectionLabels highlightId={selectedDir} />

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

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: SYNCRO_CENTER_INFO_WIDTH,
            textAlign: "center",
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 10, color: "#D4A574", letterSpacing: 2, marginBottom: 6 }}>
            {selectedDir}
          </div>
          {cell ? (
            <div style={{ fontSize: 18, fontWeight: 500, color: POINT_COLORS[cell.current_level] }}>
              {levelTitle}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 10, color: "#8A8AA0", marginTop: 16 }}>
        {t("map.tap_hint")}
      </div>

      {cell ? (
        <div style={{ maxWidth: 320, margin: "16px auto 0", padding: "0 20px" }}>
          <SyncroCellAdvice cell={cell} llmMeta={session.llm_meta} />
        </div>
      ) : null}

      <div style={{ textAlign: "center", marginTop: SYNCRO_WHY_BUTTON_MARGIN_TOP }}>
        <button
          type="button"
          className="why-btn-prominent"
          disabled={!cell || !isSyncroLlmReady(cell, session.llm_meta)}
          onClick={() => setWhyOpen(true)}
          style={{
            padding: "8px 18px",
            background: "rgba(212, 165, 116, 0.12)",
            color: "#D4A574",
            fontSize: 11,
            border: "none",
            borderRadius: 20,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {t("why_this_current")}
        </button>
      </div>

      {whyOpen && cell && isSyncroLlmReady(cell, session.llm_meta) ? (
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
