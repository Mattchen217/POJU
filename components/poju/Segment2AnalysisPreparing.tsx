"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  pollBreakthroughCoreJobUntilDone,
  type Segment2JobPollResult,
} from "@/lib/poju/poll-segment2-xhigh-job";
import { pivotChatCopy, pivotChatReceivedChars } from "@/lib/poju/pivot-chat-copy";

export type Segment2AnalysisPreparingProps = {
  job_id: string;
  locale: string;
  onComplete: (result: Extract<Segment2JobPollResult, { ok: true }>) => void | Promise<void>;
  onError?: (error: string, reason?: string) => void;
  onProgress?: (accumulated_chars: number) => void;
};

/** Stage-2 Call A wait copy — mirrored into the chat activity spinner row. */
export function segment2ReportPreparingLabel(locale: string): string {
  return pivotChatCopy(locale).parallel_analysis_in_progress;
}

export function segment2ReportPreparingProgress(
  locale: string,
  accumulatedChars: number,
  _streaming: boolean,
): string | null {
  if (accumulatedChars <= 0) return null;
  return pivotChatReceivedChars(locale, accumulatedChars);
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
