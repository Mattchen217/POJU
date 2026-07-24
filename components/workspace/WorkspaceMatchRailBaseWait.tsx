"use client";

/**
 * Match right-rail base-analysis wait visual (Analyzing-scene), same ritual as POJU rail BA.
 * Visual only — LLM / cache release is owned by WorkspaceMatchGeneratingStage.
 */

import { useEffect, useState } from "react";

import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";

type Props = {
  /** Slot label for a11y */
  label: string;
  enabled?: boolean;
};

export function WorkspaceMatchRailBaseWait({ label, enabled = true }: Props) {
  const [baziComplete, setBaziComplete] = useState(false);

  // Keep the Analyzing-scene looping until the parent flips status to ready.
  useEffect(() => {
    if (!enabled) {
      setBaziComplete(false);
      return;
    }
    setBaziComplete(false);
  }, [enabled]);

  const wait = useDeliveryWaitPhase({
    product: "poju",
    baziComplete,
    productComplete: false,
    baziOnly: true,
    enabled,
  });

  if (!enabled) return null;

  return (
    <div className="workspace-rail-ba workspace-match-rail-ba" aria-label={label} aria-busy>
      <DeliveryWaitFrame wait={wait} showBreath={false} />
    </div>
  );
}
