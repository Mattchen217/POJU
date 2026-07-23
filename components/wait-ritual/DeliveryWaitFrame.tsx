"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

import { DeliveryWaitCopyOverlay } from "@/components/wait-ritual/DeliveryWaitCopyOverlay";
import { WaitArtifactDocs } from "@/components/wait-ritual/WaitArtifactDocs";
import { WaitFxLayer } from "@/components/wait-ritual/WaitFxLayer";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import type { BaseAnalysisArtifactKind } from "@/lib/base-analysis/progress-stages";
import type { DeliveryWaitPhaseState } from "@/lib/wait-ritual/use-delivery-wait-phase";

import "@/styles/wait-ritual.css";

type Props = {
  wait: DeliveryWaitPhaseState;
  isReturningUser?: boolean;
  /** Live SSE progress stage for status line (bazi wait). */
  liveProgressStage?: string | null;
  /** Completed phase documents for the wait ritual (zh=3, non-zh=4). */
  completedArtifacts?: BaseAnalysisArtifactKind[];
  /** Show translate artifact slot (false for zh). */
  includeTranslateArtifact?: boolean;
  /** Soft purple inset vignette — off in workspace (transparent Spline). */
  showBreath?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefund?: () => void;
  secondaryActionLabel?: string;
  /** Crossfade wrapper owns exit opacity; skip duplicate exit animation on shell. */
  exitAnimationExternal?: boolean;
  hiddenWork?: ReactNode;
  children?: ReactNode;
};

/** Unified delivery wait: one Spline shell, FX layer, copy overlay, optional hidden LLM work. */
export function DeliveryWaitFrame({
  wait,
  isReturningUser,
  liveProgressStage = null,
  completedArtifacts = [],
  includeTranslateArtifact = false,
  showBreath = true,
  error,
  onRetry,
  onRefund,
  secondaryActionLabel,
  exitAnimationExternal = false,
  hiddenWork,
  children,
}: Props) {
  const showArtifacts =
    !error &&
    (wait.phase === "bazi" || wait.phase === "product") &&
    completedArtifacts.length > 0;

  return (
    <PreparingSplineShell
      blockInteraction
      scene={wait.scene}
      className={clsx(
        "delivery-wait-page",
        wait.exiting && !exitAnimationExternal && "delivery-wait-page--exit",
      )}
    >
      <WaitFxLayer
        glowColor={wait.glowColor}
        showBreath={showBreath}
        showFlash={wait.showFlash}
        showConverge={wait.showConverge}
      />
      {showArtifacts ? (
        <WaitArtifactDocs
          artifacts={completedArtifacts}
          includeTranslate={includeTranslateArtifact}
        />
      ) : null}
      <DeliveryWaitCopyOverlay
        copyPhase={wait.copyPhase}
        phase={wait.phase}
        stepIndex={wait.stepIndex}
        isReturningUser={isReturningUser}
        liveProgressStage={liveProgressStage}
        error={error}
        onRetry={onRetry}
        onRefund={onRefund}
        secondaryActionLabel={secondaryActionLabel}
      />
      {hiddenWork}
      {children}
    </PreparingSplineShell>
  );
}
