"use client";

import { useEffect, useRef } from "react";

import type { SyncroLlmProgress } from "@/components/syncro/SyncroLlmBatchRunner";
import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { rebuildSyncroLlmContext } from "@/lib/syncro/rebuild-syncro-llm-context";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import { buildSyncroLlmHoursInput } from "@/lib/syncro/syncro-llm-batch-core";
import {
  getRealtimeHourPeriodForSession,
  getSubmissionAnchorPeriod,
  getSubmissionHourSequence,
} from "@/lib/syncro/syncro-submission-schedule";
import { runStreamHoursWithRetry } from "@/lib/syncro/syncro-stream-hours-runner";
import {
  clearSyncroLlmContext,
  resolveSyncroLlmContext,
} from "@/lib/syncro/syncro-llm-context-storage";
import { patchSyncroSessionMatrix } from "@/lib/syncro/syncro-session";
import type { SyncroHourData } from "@/lib/syncro/syncro-status-kv";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import type { HourPeriod, SyncroSession } from "@/lib/syncro/types";

type StatusResponse = {
  status: {
    completed: number;
    total: number;
    current_hour: string | null;
    failed_hours: string[];
    done: boolean;
  } | null;
  hours: Record<string, SyncroHourData | null>;
  kv_configured?: boolean;
};

function countLlmReadyHours(session: SyncroSession): number {
  const sequence = getSubmissionHourSequence(session);
  let ready = 0;
  for (const hourId of sequence) {
    if (isHourPeriodLlmReady(session.matrix, hourId, session.llm_meta)) ready++;
  }
  return ready;
}

export type UseSyncroInngestJobOptions = {
  sessionId: string;
  session: SyncroSession | null;
  enabled: boolean;
  onSessionUpdate: (session: SyncroSession) => void;
  onProgress: (progress: SyncroLlmProgress) => void;
};

/**
 * 1) Stream priority hour (NOW) to IndexedDB → compass gate.
 * 2) Start Inngest for all hours; poll KV → merge.
 */
export function useSyncroInngestJob({
  sessionId,
  session,
  enabled,
  onSessionUpdate,
  onProgress,
}: UseSyncroInngestJobOptions): void {
  const startedRef = useRef(false);
  const priorityStartedRef = useRef(false);
  const appliedHoursRef = useRef<Set<string>>(new Set());
  const workingSessionRef = useRef(session);

  useEffect(() => {
    workingSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const activeSession = session;
    if (!enabled || !sessionId || !activeSession) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const priorityHour = getRealtimeHourPeriodForSession(activeSession);

    const applyHourFromKv = async (hourId: string, hourData: SyncroHourData) => {
      if (appliedHoursRef.current.has(hourId)) return;
      const updated = await patchSyncroSessionMatrix(sessionId, hourData.advice, {
        cost_usd_delta: 0,
      });
      if (!updated) return;
      appliedHoursRef.current.add(hourId);
      workingSessionRef.current = updated;
      onSessionUpdate(updated);
      dispatchSyncroMatrixPatch({
        session_id: sessionId,
        batch_index: getSubmissionHourSequence(activeSession).indexOf(hourId as HourPeriod),
        batch_total: 12,
        updated_keys: Object.keys(hourData.advice),
      });
    };

    const tick = async (): Promise<boolean> => {
      if (cancelled) return false;

      const base = workingSessionRef.current ?? activeSession;
      let completed = countLlmReadyHours(base);
      let failed = 0;
      let kvUnavailable = false;

      try {
        const res = await fetch(
          `/api/syncro/status?session_id=${encodeURIComponent(sessionId)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as StatusResponse;

          if (data.kv_configured === false) {
            kvUnavailable = true;
          }

          if (data.status) {
            failed = data.status.failed_hours.length;
            completed = Math.max(completed, data.status.completed);

            for (const [hourId, hourData] of Object.entries(data.hours)) {
              if (!hourData?.advice) continue;
              await applyHourFromKv(hourId, hourData);
            }

            if (data.status.done) {
              onProgress({
                completed: countLlmReadyHours(workingSessionRef.current ?? activeSession),
                total: 12,
                running: false,
                failed,
                current_hour: (data.status.current_hour as HourPeriod) ?? undefined,
                kv_unavailable: kvUnavailable,
              });
              clearSyncroLlmContext(sessionId);
              return false;
            }

            onProgress({
              completed,
              total: 12,
              running: true,
              failed,
              current_hour: (data.status.current_hour as HourPeriod) ?? undefined,
              kv_unavailable: kvUnavailable,
            });
          } else if (kvUnavailable) {
            onProgress({
              completed,
              total: 12,
              running: true,
              failed,
              kv_unavailable: true,
            });
          }
        }
      } catch (e) {
        console.warn("[useSyncroInngestJob] poll failed:", e);
      }

      completed = countLlmReadyHours(workingSessionRef.current ?? activeSession);
      if (completed >= 12) {
        onProgress({ completed: 12, total: 12, running: false, failed, kv_unavailable: kvUnavailable });
        clearSyncroLlmContext(sessionId);
        return false;
      }

      onProgress({
        completed,
        total: 12,
        running: true,
        failed,
        kv_unavailable: kvUnavailable,
      });
      return true;
    };

    const runPriorityStream = async (ctx: NonNullable<Awaited<ReturnType<typeof resolveSyncroLlmContext>>>) => {
      if (priorityStartedRef.current) return;
      if (isHourPeriodLlmReady(activeSession.matrix, priorityHour, activeSession.llm_meta)) {
        return;
      }
      priorityStartedRef.current = true;

      onProgress({
        completed: countLlmReadyHours(workingSessionRef.current ?? activeSession),
        total: 12,
        running: true,
        failed: 0,
        priority_generating: true,
        current_hour: priorityHour,
      });

      const hoursInput = buildSyncroLlmHoursInput(sessionId, [priorityHour], ctx);
      const result = await runStreamHoursWithRetry(hoursInput, {}, { maxAttempts: 2 });

      if (cancelled) return;

      if (result.success && result.advice) {
        const updated = await patchSyncroSessionMatrix(sessionId, result.advice, {
          cost_usd_delta: 0,
        });
        if (updated) {
          appliedHoursRef.current.add(priorityHour);
          workingSessionRef.current = updated;
          onSessionUpdate(updated);
          dispatchSyncroMatrixPatch({
            session_id: sessionId,
            batch_index: getSubmissionHourSequence(activeSession).indexOf(priorityHour),
            batch_total: 12,
            updated_keys: Object.keys(result.advice),
          });
        }
      } else {
        console.warn("[useSyncroInngestJob] priority stream failed:", result.lastError);
      }
    };

    const ensureStarted = async () => {
      if (startedRef.current) return;
      startedRef.current = true;

      let ctx = await resolveSyncroLlmContext(sessionId);
      if (!ctx) {
        ctx = await rebuildSyncroLlmContext(workingSessionRef.current ?? activeSession);
      }
      if (!ctx) {
        onProgress({
          completed: countLlmReadyHours(workingSessionRef.current ?? activeSession),
          total: 12,
          running: false,
          failed: 0,
          context_missing: true,
        });
        return;
      }

      void runPriorityStream(ctx);

      const submission_anchor = getSubmissionAnchorPeriod(workingSessionRef.current ?? activeSession);
      const hour_order = getSubmissionHourSequence(workingSessionRef.current ?? activeSession);

      try {
        const res = await fetch("/api/syncro/inngest_start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            submission_anchor,
            priority_hour: priorityHour,
            hour_order,
            llm_context: ctx,
            device_id: getPojuDeviceId(),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (body.error === "kv_not_configured") {
            onProgress({
              completed: countLlmReadyHours(workingSessionRef.current ?? activeSession),
              total: 12,
              running: true,
              failed: 0,
              kv_unavailable: true,
              priority_generating: !isHourPeriodLlmReady(
                workingSessionRef.current?.matrix ?? activeSession.matrix,
                priorityHour,
                activeSession.llm_meta,
              ),
            });
          }
          console.warn("[useSyncroInngestJob] inngest_start http", res.status, body);
        }
      } catch (e) {
        console.warn("[useSyncroInngestJob] inngest_start failed:", e);
      }
    };

    void (async () => {
      await ensureStarted();
      if (cancelled) return;
      if (!(await tick())) return;
      intervalId = setInterval(async () => {
        const cont = await tick();
        if (!cont && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 4000);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [sessionId, session, enabled, onSessionUpdate, onProgress]);
}
