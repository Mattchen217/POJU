"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  pollBreakthroughCoreJobUntilDone,
  type Segment2JobPollResult,
} from "@/lib/poju/poll-segment2-xhigh-job";

export type Segment2AnalysisPreparingProps = {
  job_id: string;
  locale: string;
  onComplete: (result: Extract<Segment2JobPollResult, { ok: true }>) => void | Promise<void>;
  onError?: (error: string) => void;
};

/**
 * Poll segment-2 xhigh async job — mirrors BaseAnalysisStreamPreparing (status-only, no SSE).
 */
export function Segment2AnalysisPreparing({
  job_id,
  locale,
  onComplete,
  onError,
}: Segment2AnalysisPreparingProps) {
  const [accumulatedChars, setAccumulatedChars] = useState(0);
  const [status, setStatus] = useState<"pending" | "running" | "completed" | "failed">("pending");
  const startedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const run = useCallback(async () => {
    try {
      const result = await pollBreakthroughCoreJobUntilDone({
        job_id,
        callbacks: {
          onProgress: (chars, st) => {
            setAccumulatedChars(chars);
            setStatus(st);
          },
        },
      });
      if (!result.ok) {
        onErrorRef.current?.(result.error);
        return;
      }
      await onCompleteRef.current(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onErrorRef.current?.(msg);
    }
  }, [job_id]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
  }, [run]);

  const label = locale.startsWith("zh") ? "正在深度分析…" : "Running deep analysis…";

  return (
    <div className="segment2-analysis-preparing" aria-live="polite">
      <p>{label}</p>
      {accumulatedChars > 0 ? (
        <p className="segment2-analysis-preparing__progress">
          {locale.startsWith("zh")
            ? `已接收 ${accumulatedChars} 字符`
            : `${accumulatedChars} chars received`}
          {status === "running" ? " · streaming" : ""}
        </p>
      ) : null}
    </div>
  );
}
