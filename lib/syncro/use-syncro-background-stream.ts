"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getOpenRouterDefaultModel } from "@/lib/llm/openrouter-shared";
import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";
import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { rebuildSyncroLlmContext } from "@/lib/syncro/rebuild-syncro-llm-context";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import { getPendingSyncroGenerationSteps } from "@/lib/syncro/syncro-pending-generation-steps";
import { getSubmissionHourSequence } from "@/lib/syncro/syncro-submission-schedule";
import { buildSyncroLlmHoursInput } from "@/lib/syncro/syncro-llm-batch-core";
import { resolveSyncroLlmContext, clearSyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import { patchSyncroSessionMatrix } from "@/lib/syncro/syncro-session";
import { runStreamHoursWithRetry } from "@/lib/syncro/syncro-stream-hours-runner";
import type { HourPeriod, SyncroSession } from "@/lib/syncro/types";

export type BackgroundStreamPhase =
  | "idle"
  | "connecting"
  | "reasoning"
  | "writing"
  | "done"
  | "error"
  | "complete";

export type UseSyncroBackgroundStreamOptions = {
  sessionId: string;
  session: SyncroSession | null;
  locale: string;
  enabled: boolean;
  onSessionUpdate: (session: SyncroSession) => void;
  onProgress: (progress: SyncroLlmProgress) => void;
};

function countReadyHours(session: SyncroSession): number {
  const sequence = getSubmissionHourSequence(session);
  let ready = 0;
  for (const hourId of sequence) {
    if (isHourPeriodLlmReady(session.matrix, hourId, session.llm_meta)) ready++;
  }
  return ready;
}

export type SyncroBackgroundStreamState = {
  phase: BackgroundStreamPhase;
  streamText: string;
  stepLabel: string | null;
  stepIndex: number;
  stepTotal: number;
  error: string | null;
  running: boolean;
  retry: () => void;
};

/**
 * Serial SSE on compass page — one `/api/syncro/stream_hours` per batch (avoids Inngest 300s wall).
 */
export function useSyncroBackgroundStream({
  sessionId,
  session,
  locale,
  enabled,
  onSessionUpdate,
  onProgress,
}: UseSyncroBackgroundStreamOptions): SyncroBackgroundStreamState {
  const [phase, setPhase] = useState<BackgroundStreamPhase>("idle");
  const [streamText, setStreamText] = useState("");
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepTotal, setStepTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const workingRef = useRef(session);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    workingRef.current = session;
  }, [session]);

  const updateProgress = useCallback(
    (failed = 0) => {
      const s = workingRef.current;
      if (!s) return;
      const completed = countReadyHours(s);
      onProgress({
        completed,
        total: 12,
        running: completed < 12,
        failed,
      });
    },
    [onProgress],
  );

  const retry = useCallback(() => {
    abortRef.current?.abort();
    startedRef.current = false;
    setError(null);
    setStreamText("");
    setPhase("idle");
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const active = workingRef.current ?? session;
    if (!enabled || !sessionId || !active) return;

    if (startedRef.current) return;
    const pending = getPendingSyncroGenerationSteps(active, { skipPriority: true });
    if (pending.length === 0) {
      updateProgress();
      setPhase("complete");
      setRunning(false);
      return;
    }

    startedRef.current = true;
    const abort = new AbortController();
    abortRef.current = abort;

    void (async () => {
      setRunning(true);
      setStepTotal(pending.length);
      let failedBatches = 0;

      let ctx = await resolveSyncroLlmContext(sessionId);
      if (!ctx) ctx = await rebuildSyncroLlmContext(active);
      if (!ctx) {
        setPhase("error");
        setError("context_missing");
        setRunning(false);
        onProgress({ completed: countReadyHours(active), total: 12, running: false, failed: 0, context_missing: true });
        return;
      }

      for (let i = 0; i < pending.length; i++) {
        if (abort.signal.aborted) return;

        const hourIds = pending[i]!;
        const label = hourIds
          .map((h) => hourPeriodDisplayName(h, locale))
          .join(" + ");
        setStepIndex(i + 1);
        setStepLabel(label);
        setStreamText("");
        setPhase("connecting");
        updateProgress(failedBatches);

        const input = buildSyncroLlmHoursInput(sessionId, hourIds, ctx);
        const result = await runStreamHoursWithRetry(
          input,
          {
            onProgress: (p) => setPhase(p),
            onReasoningChunk: () => setPhase((prev) => (prev === "writing" ? prev : "reasoning")),
            onContentChunk: (text) => setStreamText((prev) => prev + text),
            onError: (err) => {
              setPhase("error");
              setError(err.detail ?? err.error);
            },
          },
          { signal: abort.signal },
        );

        if (abort.signal.aborted) return;

        if (result.success && result.advice) {
          const updated = await patchSyncroSessionMatrix(sessionId, result.advice, {
            model: getOpenRouterDefaultModel(),
            tokens_used: 1,
            cost_usd_delta: 0,
          });
          if (updated) {
            workingRef.current = updated;
            onSessionUpdate(updated);
            const seq = getSubmissionHourSequence(updated);
            dispatchSyncroMatrixPatch({
              session_id: sessionId,
              batch_index: seq.indexOf(hourIds[0]!),
              batch_total: 12,
              updated_keys: Object.keys(result.advice),
            });
          }
          setPhase("done");
        } else {
          if (result.lastError === "aborted") return;
          failedBatches++;
          setPhase("error");
          setError(result.lastError ?? "batch_failed");
          updateProgress(failedBatches);
          // continue with next batch after brief pause
          await new Promise((r) => setTimeout(r, 2000));
          if (abort.signal.aborted) return;
          setPhase("connecting");
          setError(null);
        }
      }

      const finalSession = workingRef.current ?? active;
      const completed = countReadyHours(finalSession);
      setRunning(false);
      if (completed >= 12) {
        setPhase("complete");
        clearSyncroLlmContext(sessionId);
        onProgress({ completed: 12, total: 12, running: false, failed: failedBatches });
      } else {
        setPhase(failedBatches > 0 ? "error" : "complete");
        onProgress({
          completed,
          total: 12,
          running: false,
          failed: failedBatches,
        });
      }
    })();

    return () => {
      abort.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- session updates flow through workingRef; avoid aborting mid-stream
  }, [sessionId, locale, enabled, retryKey]);

  return {
    phase,
    streamText,
    stepLabel,
    stepIndex,
    stepTotal,
    error,
    running,
    retry,
  };
}
