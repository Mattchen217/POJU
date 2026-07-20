"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

import { DeliveryWaitCopyOverlay } from "@/components/wait-ritual/DeliveryWaitCopyOverlay";
import { WaitFxLayer } from "@/components/wait-ritual/WaitFxLayer";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import type { DeliveryWaitPhaseState } from "@/lib/wait-ritual/use-delivery-wait-phase";

import "@/styles/wait-ritual.css";

type Props = {
  wait: DeliveryWaitPhaseState;
  isReturningUser?: boolean;
  /** Live SSE progress stage for status line (bazi wait). */
  liveProgressStage?: string | null;
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
  error,
  onRetry,
  onRefund,
  secondaryActionLabel,
  exitAnimationExternal = false,
  hiddenWork,
  children,
}: Props) {
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
        showFlash={wait.showFlash}
        showConverge={wait.showConverge}
      />
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
