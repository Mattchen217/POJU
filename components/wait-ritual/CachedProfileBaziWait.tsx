"use client";

import { useCallback, useRef } from "react";

import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";
import type { DeliveryWaitProduct } from "@/lib/wait-ritual/constants";

type Props = {
  product: Extract<DeliveryWaitProduct, "glyph" | "match">;
  onComplete: () => void;
};

/** Cached profile prep — bazi matrix scene, min 10s, no bridge/product dongxiao. */
export function CachedProfileBaziWait({ product, onComplete }: Props) {
  const completedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  const waitFlow = useDeliveryWaitPhase({
    product,
    baziOnly: true,
    isReturningUser: true,
    baziComplete: true,
    productComplete: false,
    enabled: true,
    onBaziRitualComplete: handleComplete,
  });

  return <DeliveryWaitFrame wait={waitFlow} isReturningUser />;
}
