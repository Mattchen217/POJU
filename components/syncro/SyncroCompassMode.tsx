"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PostureHintOverlay } from "@/components/syncro/PostureHintOverlay";
import { SyncroBackgroundStreamPanel } from "@/components/syncro/SyncroBackgroundStreamPanel";
import { SyncroCellAdvice } from "@/components/syncro/SyncroCellAdvice";
import { SyncroCloudProgressPanel } from "@/components/syncro/SyncroCloudProgressPanel";
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
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { isSyncroLlmReady } from "@/lib/syncro/llm-cell-display";
import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";
import {
  SYNCRO_CENTER_INFO_WIDTH,
  SYNCRO_RING_SIZE,
} from "@/lib/syncro/syncro-ring-layout";
import type { SyncroBackgroundStreamState } from "@/lib/syncro/use-syncro-background-stream";
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
  llmProgress?: SyncroLlmProgress;
  backgroundStream?: SyncroBackgroundStreamState;
};

export function SyncroCompassMode({
  session,
  locale,
  hourPeriod,
  highlightMatrixKeys,
  llmProgress,
  backgroundStream,
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
  const hourLabel = hourPeriodDisplayName(hourPeriod, locale);
  const hourRange = HOUR_PERIOD_RANGES[hourPeriod];

  const whyReady = Boolean(cell && isSyncroLlmReady(cell, session.llm_meta));
  const whyHasRationale = Boolean(cell?.rationale?.trim());
  const canOpenWhy = whyReady || whyHasRationale;

  const showClientStream =
    backgroundStream &&
    (backgroundStream.running ||
      backgroundStream.phase === "error" ||
      (backgroundStream.streamText.length > 0 &&
        backgroundStream.phase !== "complete" &&
        backgroundStream.phase !== "idle"));

  const showCloudProgress =
    !showClientStream && llmProgress?.running && llmProgress.completed < llmProgress.total;

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
    <div className={`compass-mode-body ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      {receivingHeading ? <PostureHintOverlay mode="compass" beta={beta} /> : null}

      <div className="compass-stage">
        <div
          className="compass-area concentric-system"
          style={{
            position: "relative",
            width: SYNCRO_RING_SIZE,
            height: SYNCRO_RING_SIZE,
            margin: "0 auto",
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
            <SyncroParticleCore bare />

            <SyncroDirectionLabels
              highlightId={currentDirection}
              counterRotateDeg={alpha}
            />
          </div>

          <div
            className="compass-center-info"
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
            <div className="compass-center-meta">
              <span className="compass-center-direction">{currentDirection}</span>
              <span className="compass-center-hour">
                {hourLabel} · {hourRange}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="compass-footer">
        <SyncroCellAdvice
          cell={cell}
          llmMeta={session.llm_meta}
          className="compass-short-advice"
        />

        <div className="compass-bottom-cta">
          <button
            type="button"
            className="why-btn-prominent"
            disabled={!canOpenWhy}
            onClick={() => {
              if (canOpenWhy) setWhyModalOpen(true);
            }}
          >
            {t("why_this_current")}
          </button>
        </div>

        {showClientStream && backgroundStream ? (
          <SyncroBackgroundStreamPanel stream={backgroundStream} compact />
        ) : null}
        {showCloudProgress && llmProgress ? (
          <SyncroCloudProgressPanel progress={llmProgress} compact />
        ) : null}
      </div>

      {whyModalOpen && cell && canOpenWhy ? (
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
        fontSize: 18,
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
