"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PostureHintOverlay } from "@/components/syncro/PostureHintOverlay";
import { SyncroCellAdvice } from "@/components/syncro/SyncroCellAdvice";
import { SyncroDirectionLabels } from "@/components/syncro/SyncroDirectionLabels";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import {
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import {
  compassDegreeToDirection,
  type CurrentLevel,
} from "@/lib/syncro/current-system";
import { isSyncroLlmReady } from "@/lib/syncro/llm-cell-display";
import {
  SYNCRO_CENTER_INFO_WIDTH,
  SYNCRO_PARTICLE_SIZE,
  SYNCRO_RING_MARGIN_TOP,
  SYNCRO_RING_SIZE,
  SYNCRO_WHY_BUTTON_MARGIN_TOP,
} from "@/lib/syncro/syncro-ring-layout";
import { matrixKey, type HourPeriod, type SyncroCombination, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-compass.css";

const LEVEL_COLORS: Record<CurrentLevel, string> = {
  open_current: "#00D9B8",
  following_current: "#4ECDC4",
  stillwater: "#8A8AA0",
  crosscurrent: "#E89F4D",
  undertow: "#C85A5A",
};

export type SyncroCompassModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  highlightMatrixKeys?: Set<string>;
};

export function SyncroCompassMode({
  session,
  locale,
  hourPeriod,
  highlightMatrixKeys,
}: SyncroCompassModeProps) {
  const t = useTranslations("syncro");
  const tLevels = useTranslations("syncro.levels");
  const isZh = locale.startsWith("zh");

  const { compassDegree: alpha, deviceTiltBeta: beta, receivingHeading, isSupported } =
    useOrientation();
  const [whyModalOpen, setWhyModalOpen] = useState(false);

  const currentDirection = compassDegreeToDirection(alpha);
  const cellKey = matrixKey(hourPeriod, currentDirection);
  const cell = session.matrix[cellKey];
  const llmHighlight = highlightMatrixKeys?.has(cellKey);

  if (!isSupported) {
    return (
      <div className="compass-page">
        <p style={{ textAlign: "center", color: "#8A8AA0", marginTop: 80 }}>
          {t("main.not_supported")}
        </p>
      </div>
    );
  }

  return (
    <div className={`compass-page ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      {receivingHeading ? <PostureHintOverlay mode="compass" beta={beta} /> : null}

      <div
        className="compass-area"
        style={{
          position: "relative",
          width: SYNCRO_RING_SIZE,
          height: SYNCRO_RING_SIZE,
          margin: `${SYNCRO_RING_MARGIN_TOP}px auto 0`,
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            transform: `rotate(${-alpha}deg)`,
            transformOrigin: "center center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: SYNCRO_PARTICLE_SIZE,
              height: SYNCRO_PARTICLE_SIZE,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            <SyncroParticleCore bare />
          </div>

          <SyncroDirectionLabels
            highlightId={currentDirection}
            counterRotateDeg={alpha}
          />
        </div>

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
          {cell ? (
            <CurrentDisplay cell={cell} isZh={isZh} tLevels={tLevels} />
          ) : (
            <div style={{ color: "#8A8AA0", fontSize: 11 }}>{t("generating")}</div>
          )}
        </div>
      </div>

      {cell ? (
        <div style={{ maxWidth: 320, margin: "24px auto 0", padding: "0 20px" }}>
          <SyncroCellAdvice cell={cell} llmMeta={session.llm_meta} />
        </div>
      ) : null}

      <div style={{ textAlign: "center", marginTop: SYNCRO_WHY_BUTTON_MARGIN_TOP }}>
        <button
          type="button"
          className="why-btn-prominent"
          disabled={!cell || !isSyncroLlmReady(cell, session.llm_meta)}
          onClick={() => setWhyModalOpen(true)}
          style={{
            padding: "8px 18px",
            background: "rgba(212, 165, 116, 0.12)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            color: "#D4A574",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.3,
            border: "none",
            borderRadius: 20,
            boxShadow: "inset 0 0 0 0.5px rgba(212, 165, 116, 0.3)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {t("why_this_current")}
        </button>
      </div>

      {whyModalOpen && cell && isSyncroLlmReady(cell, session.llm_meta) ? (
        <WhyThisCurrentModal
          cell={cell}
          direction={currentDirection}
          hourId={hourPeriod}
          onClose={() => setWhyModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CurrentDisplay({
  cell,
  isZh,
  tLevels,
}: {
  cell: SyncroCombination;
  isZh: boolean;
  tLevels: (key: string) => string;
}) {
  const levelKey = getCurrentLevelI18nKey(cell.current_level);
  let levelTitle = "";
  try {
    levelTitle = tLevels(levelKey);
  } catch {
    levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
  }

  return (
    <div
      style={{
        fontSize: 20,
        fontWeight: 500,
        color: LEVEL_COLORS[cell.current_level] || "#A0A4B8",
        letterSpacing: 0.5,
        lineHeight: 1.2,
      }}
    >
      {levelTitle}
    </div>
  );
}
