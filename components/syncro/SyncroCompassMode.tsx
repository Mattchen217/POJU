"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PostureHintOverlay } from "@/components/syncro/PostureHintOverlay";
import { SyncroBackgroundStreamPanel } from "@/components/syncro/SyncroBackgroundStreamPanel";
import { SyncroCenterLevel } from "@/components/syncro/SyncroCenterLevel";
import { SyncroCloudProgressPanel } from "@/components/syncro/SyncroCloudProgressPanel";
import { SyncroModeFooter } from "@/components/syncro/SyncroModeFooter";
import { SyncroRingStage } from "@/components/syncro/SyncroRingStage";
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
import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";
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

  const levelTitle = cell ? resolveLevelTitle(cell, isZh, tLevels) : "";

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
    <div className={`syncro-ar-layout ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      {receivingHeading ? <PostureHintOverlay mode="compass" beta={beta} /> : null}

      <SyncroRingStage
        highlightId={currentDirection}
        rotationDeg={alpha}
        center={
          cell ? (
            <SyncroCenterLevel
              title={levelTitle}
              color={LEVEL_COLORS[cell.current_level] || "#A0A4B8"}
            />
          ) : (
            <div style={{ color: "#8A8AA0", fontSize: 11 }}>{t("generating")}</div>
          )
        }
      />

      <SyncroModeFooter
        cell={cell}
        llmMeta={session.llm_meta}
        canOpenWhy={canOpenWhy}
        onWhyClick={() => setWhyModalOpen(true)}
        extra={
          <>
            {showClientStream && backgroundStream ? (
              <SyncroBackgroundStreamPanel stream={backgroundStream} compact />
            ) : null}
            {showCloudProgress && llmProgress ? (
              <SyncroCloudProgressPanel progress={llmProgress} compact />
            ) : null}
          </>
        }
      />

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

function resolveLevelTitle(
  cell: SyncroCombination,
  isZh: boolean,
  tLevels: (key: string) => string,
): string {
  const levelKey = getCurrentLevelI18nKey(cell.current_level);
  try {
    return tLevels(levelKey);
  } catch {
    return getCurrentLevelFallbackLabel(cell.current_level, isZh);
  }
}
