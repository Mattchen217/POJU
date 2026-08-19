"use client";

import { useEffect, useRef } from "react";

import { ensureLayer1ForProfile } from "@/lib/profile/ensure-layer1";

type Props = {
  profileId: string;
  locale?: string;
  preWork?: () => Promise<void>;
  /** Signature matches BaseAnalysisStreamPreparing.onComplete (display text unused). */
  onComplete: (displayText: string) => void | Promise<void>;
  onError: (error: string) => void;
};

/** Hidden prepare: persist Layer-1 natal facts, no narrative report stream. */
export function Layer1PrepareWork({
  profileId,
  locale,
  preWork,
  onComplete,
  onError,
}: Props) {
  const preWorkRef = useRef(preWork);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  preWorkRef.current = preWork;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await preWorkRef.current?.();
        await ensureLayer1ForProfile(profileId, locale);
        if (!cancelled) await onCompleteRef.current("");
      } catch (e) {
        if (!cancelled) {
          onErrorRef.current(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, locale]);

  return null;
}
