"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  pollSynthesisJobUntilDone,
  type SynthesisJobPollResult,
} from "@/lib/poju/poll-synthesis-xhigh-job";

export type SynthesisPreparingProps = {
  job_id: string;
  locale: string;
  onComplete: (result: Extract<SynthesisJobPollResult, { ok: true }>) => void | Promise<void>;
  onError?: (error: string, reason?: string) => void;
  onProgress?: (accumulated_chars: number) => void;
};

/** 汇总段 wait copy — mirrored into the chat activity spinner row. */
export function synthesisPreparingLabel(locale: string): string {
  return locale.startsWith("zh")
    ? "正在汇总方案，为你收敛破局方向…请稍后。"
    : "Synthesizing your plan — converging breakthrough directions… please wait.";
}

export function synthesisPreparingProgress(
  locale: string,
  accumulatedChars: number,
  streaming: boolean,
): string | null {
  if (accumulatedChars <= 0) return null;
  const base = locale.startsWith("zh")
    ? `已接收 ${accumulatedChars} 字符`
    : `${accumulatedChars} chars received`;
  return streaming ? `${base} · streaming` : base;
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
