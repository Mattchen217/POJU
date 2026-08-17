"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  pollSynthesisJobUntilDone,
  type SynthesisJobPollResult,
} from "@/lib/poju/poll-synthesis-xhigh-job";
import { pivotChatReceivedChars } from "@/lib/poju/pivot-chat-copy";

export type SynthesisPreparingProps = {
  job_id: string;
  locale: string;
  onComplete: (result: Extract<SynthesisJobPollResult, { ok: true }>) => void | Promise<void>;
  onError?: (error: string, reason?: string) => void;
  onProgress?: (accumulated_chars: number) => void;
};

/** 汇总段 wait copy — unused in UI (spinner only); kept for API symmetry. */
export function synthesisPreparingLabel(_locale: string): string {
  return "";
}

export function synthesisPreparingProgress(
  locale: string,
  accumulatedChars: number,
  _streaming: boolean,
): string | null {
  if (accumulatedChars <= 0) return null;
  return pivotChatReceivedChars(locale, accumulatedChars);
}

/**
 * Poll synthesis xhigh async job — headless (UI via onProgress / activity spinner).
 */
export function SynthesisPreparing({
  job_id,
  onComplete,
  onError,
  onProgress,
}: SynthesisPreparingProps) {
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onProgressRef = useRef(onProgress);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  onProgressRef.current = onProgress;

  const run = useCallback(
    async (signal: AbortSignal) => {
      console.info("[synthesis] preparing poll start", { job_id });
      try {
        const result = await pollSynthesisJobUntilDone({
          job_id,
          signal,
          callbacks: {
            onProgress: (chars) => {
              onProgressRef.current?.(chars);
            },
          },
        });
        if (signal.aborted) return;
        if (!result.ok) {
          onErrorRef.current?.(result.error, result.reason);
          return;
        }
        await onCompleteRef.current(result);
      } catch (e) {
        if (signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "AbortError" || (e instanceof Error && e.name === "AbortError")) return;
        onErrorRef.current?.(msg);
      }
    },
    [job_id],
  );

  useEffect(() => {
    const ac = new AbortController();
    void run(ac.signal);
    return () => {
      ac.abort();
    };
  }, [job_id, run]);

  return null;
}
