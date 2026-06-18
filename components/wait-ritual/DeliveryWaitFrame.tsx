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
  error?: string | null;
  onRetry?: () => void;
  onRefund?: () => void;
  secondaryActionLabel?: string;
  ritualPanel?: ReactNode;
  hiddenWork?: ReactNode;
  children?: ReactNode;
};

/** Unified delivery wait: one Spline shell, FX layer, copy overlay, optional ritual + hidden LLM work. */
export function DeliveryWaitFrame({
  wait,
  isReturningUser,
  error,
  onRetry,
  onRefund,
  secondaryActionLabel,
  ritualPanel,
  hiddenWork,
  children,
}: Props) {
  return (
    <PreparingSplineShell
      blockInteraction
      scene={wait.scene}
      className={clsx("delivery-wait-page", wait.exiting && "delivery-wait-page--exit")}
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
        error={error}
        onRetry={onRetry}
        onRefund={onRefund}
        secondaryActionLabel={secondaryActionLabel}
      />
      {hiddenWork}
      {ritualPanel}
      {children}
    </PreparingSplineShell>
  );
}
