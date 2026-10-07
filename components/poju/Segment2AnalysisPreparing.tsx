"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  pollBreakthroughCoreJobUntilDone,
  type Segment2JobPollResult,
  type Segment2ProgressSnapshot,
} from "@/lib/poju/poll-segment2-xhigh-job";
import {
  pivotChatCopy,
  pivotChatSegment2StepLabel,
} from "@/lib/poju/pivot-chat-copy";
import type { Segment2CallAProgressStep } from "@/lib/poju/segment2-progress-steps";

export type Segment2AnalysisPreparingProps = {
  job_id: string;
  locale: string;
  onComplete: (result: Extract<Segment2JobPollResult, { ok: true }>) => void | Promise<void>;
  onError?: (error: string, reason?: string) => void;
  onProgress?: (snapshot: Segment2ProgressSnapshot) => void;
};

/** Stage-2 Call A wait — fixed headline (not final delivery). */
export function segment2ReportPreparingLabel(locale: string): string {
  return pivotChatCopy(locale).parallel_analysis_in_progress;
}

/** Dynamic line: what Call A is actually doing right now. */
export function segment2ReportPreparingStep(
  locale: string,
  step: Segment2CallAProgressStep,
): string {
  return pivotChatSegment2StepLabel(locale, step);
}

/**
 * @deprecated Prefer segment2ReportPreparingStep — char count is no longer the primary wait signal.
 */
export function segment2ReportPreparingProgress(
  locale: string,
  accumulatedChars: number,
  _streaming: boolean,
  step?: Segment2CallAProgressStep,
): string | null {
  if (step) return segment2ReportPreparingStep(locale, step);
  if (accumulatedChars <= 0) return segment2ReportPreparingStep(locale, "starting");
  return segment2ReportPreparingStep(locale, "dims_spine");
}

/**
 * Poll segment-2 xhigh async job — headless (UI in PojuActivityIndicator via onProgress).
 * Abort + generation token prevent StrictMode / remount double-complete from corrupting Call B.
 */
export function Segment2AnalysisPreparing({
  job_id,
  onComplete,
  onError,
  onProgress,
}: Segment2AnalysisPreparingProps) {
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onProgressRef = useRef(onProgress);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  onProgressRef.current = onProgress;

  const run = useCallback(
    async (signal: AbortSignal) => {
      console.info("[segment2] preparing poll start", { job_id });
      try {
        const result = await pollBreakthroughCoreJobUntilDone({
          job_id,
          signal,
          callbacks: {
            onProgress: (_chars, _status, snapshot) => {
              if (snapshot) onProgressRef.current?.(snapshot);
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
