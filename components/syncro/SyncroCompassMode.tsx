"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PostureHintOverlay } from "@/components/syncro/PostureHintOverlay";
import { SyncroBackgroundStreamPanel } from "@/components/syncro/SyncroBackgroundStreamPanel";
import { SyncroCellAdvice } from "@/components/syncro/SyncroCellAdvice";
import { SyncroCloudProgressPanel } from "@/components/syncro/SyncroCloudProgressPanel";
import { SyncroDirectionLabels } from "@/components/syncro/SyncroDirectionLabels";
import { SyncroLevelHub } from "@/components/syncro/SyncroLevelHub";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import {
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import { compassDegreeToDirection, type CurrentLevel } from "@/lib/syncro/current-system";
import { isSyncroLlmReady } from "@/lib/syncro/llm-cell-display";
import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";
import {
  SYNCRO_AR_CAMERA_SIZE,
  SYNCRO_RING_MARGIN_TOP,
  SYNCRO_RING_SIZE,
  SYNCRO_WHY_BUTTON_MARGIN_TOP,
} from "@/lib/syncro/syncro-ring-layout";
import type { SyncroBackgroundStreamState } from "@/lib/syncro/use-syncro-background-stream";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

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
  /** Marketing phone preview — skip device checks. */
  marketingPreview?: boolean;
};

/** Same page shell as AR (compass-page): ring + advice below, not overlaid on particles. */
export function SyncroCompassMode({
  session,
  locale,
  hourPeriod,
  highlightMatrixKeys,
  llmProgress,
  backgroundStream,
  marketingPreview = false,
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

  let levelTitle = "";
  if (cell) {
    const levelKey = getCurrentLevelI18nKey(cell.current_level);
    try {
      levelTitle = tLevels(levelKey);
    } catch {
      levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
    }
  }

  if (!isSupported && !marketingPreview) {
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
        className={marketingPreview ? "syncro-marketing-ring-shell" : undefined}
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
          <SyncroParticleCore bare />
          <SyncroDirectionLabels highlightId={currentDirection} counterRotateDeg={alpha} />
        </div>

        {cell ? (
          <SyncroLevelHub
            title={levelTitle}
            color={LEVEL_COLORS[cell.current_level] || "#A0A4B8"}
            sizePx={SYNCRO_AR_CAMERA_SIZE}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "#8A8AA0",
              fontSize: 11,
              zIndex: 5,
            }}
          >
            {t("generating")}
          </div>
        )}
      </div>

      {cell ? (
        <div
          className={marketingPreview ? "syncro-marketing-advice-block" : undefined}
          style={{ maxWidth: 320, margin: "24px auto 0", padding: "0 20px" }}
        >
          <SyncroCellAdvice cell={cell} llmMeta={session.llm_meta} className="compass-short-advice" />
        </div>
      ) : null}

      <div
        className={marketingPreview ? "syncro-marketing-why-block" : undefined}
        style={{ textAlign: "center", marginTop: SYNCRO_WHY_BUTTON_MARGIN_TOP }}
      >
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
        <div style={{ maxWidth: 320, margin: "8px auto 0", padding: "0 20px" }}>
          <SyncroBackgroundStreamPanel stream={backgroundStream} compact />
        </div>
      ) : null}
      {showCloudProgress && llmProgress ? (
        <div style={{ maxWidth: 320, margin: "8px auto 0", padding: "0 20px" }}>
          <SyncroCloudProgressPanel progress={llmProgress} compact />
        </div>
      ) : null}

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
