"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DeliveryWaitFrame } from "@/components/wait-ritual/DeliveryWaitFrame";
import { useDeliveryWaitPhase } from "@/lib/wait-ritual/use-delivery-wait-phase";
import type { DeliveryWaitProduct } from "@/lib/wait-ritual/constants";

type Props = {
  product: Extract<DeliveryWaitProduct, "glyph" | "match">;
  /** Runs during bazi scene — e.g. matrix-narrative LLM. Completes → min 10s may still apply. */
  prepareWork: () => Promise<void>;
  onComplete: () => void;
  onBack?: () => void;
};

/**
 * Cached profile prep — bazi matrix scene until prepareWork finishes AND 10s minimum elapsed.
 */
export function CachedProfilePrepareWait({ product, prepareWork, onComplete, onBack }: Props) {
  const [baziComplete, setBaziComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const completedRef = useRef(false);
  const workStartedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  const waitFlow = useDeliveryWaitPhase({
    product,
    baziOnly: true,
    isReturningUser: true,
    baziComplete,
    productComplete: false,
    enabled: !error,
    onBaziRitualComplete: handleComplete,
  });

  useEffect(() => {
    workStartedRef.current = false;
    completedRef.current = false;
    setBaziComplete(false);
    setError(null);
  }, [retryKey]);

  useEffect(() => {
    if (error || workStartedRef.current) return;
    workStartedRef.current = true;

    void prepareWork()
      .then(() => setBaziComplete(true))
      .catch((e: unknown) => {
        workStartedRef.current = false;
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [prepareWork, error, retryKey]);

  if (error) {
    return (
      <DeliveryWaitFrame
        wait={waitFlow}
        isReturningUser
        error={error}
        onRetry={() => setRetryKey((k) => k + 1)}
        onRefund={onBack}
      />
    );
  }

  return <DeliveryWaitFrame wait={waitFlow} isReturningUser />;
}
