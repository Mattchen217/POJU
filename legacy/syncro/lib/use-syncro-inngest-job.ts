"use client";

import { useEffect, useRef } from "react";

import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";
import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { rebuildSyncroLlmContext } from "@/lib/syncro/rebuild-syncro-llm-context";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import {
  getLivePeriodInSubmissionTimeline,
  getSubmissionAnchorPeriod,
  getSubmissionHourSequence,
  isSubmissionTimelineComplete,
} from "@/lib/syncro/syncro-submission-schedule";
import {
  clearSyncroLlmContext,
  resolveSyncroLlmContext,
} from "@/lib/syncro/syncro-llm-context-storage";
import {
  patchSyncroSessionMatrix,
  patchSyncroSessionMatrixFailure,
} from "@/lib/syncro/syncro-session";
import { isSyncroHourKvComplete } from "@/lib/syncro/syncro-hour-kv-complete";
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
    task_response?: import("@/lib/syncro/types").SyncroTaskResponse;
  } | null;
  hours: Record<string, SyncroHourData | null>;
  kv_configured?: boolean;
};

function isHourFailedInMatrix(session: SyncroSession, hourId: HourPeriod): boolean {
  const keys = Object.keys(session.matrix).filter((k) => k.startsWith(`${hourId}__`));
  if (keys.length === 0) return false;
  return keys.every((k) => session.matrix[k]?.llm_failed === true);
}

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
  /** Queue cloud batches (Inngest) + poll KV — works when user leaves the app. */
  startBackground: boolean;
  onSessionUpdate: (session: SyncroSession) => void;
  onProgress: (progress: SyncroLlmProgress) => void;
};

/**
 * 1) Fan-out Inngest batch jobs (one LLM call per invocation, avoids 300s total cap).
 * 2) Poll KV and merge advice into IndexedDB for live UI.
 */
export function useSyncroInngestJob({
  sessionId,
  session,
  enabled,
  startBackground,
  onSessionUpdate,
  onProgress,
}: UseSyncroInngestJobOptions): void {
  const backgroundStartedRef = useRef(false);
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

    const applyHourFromKv = async (hourId: string, hourData: SyncroHourData) => {
      if (!isSyncroHourKvComplete(hourData)) return;
      const base = workingSessionRef.current ?? activeSession;
      if (isHourPeriodLlmReady(base.matrix, hourId as HourPeriod, base.llm_meta)) {
        appliedHoursRef.current.add(hourId);
        return;
      }
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

    const applyFailedHourFromKv = async (hourId: string) => {
      const base = workingSessionRef.current ?? activeSession;
      if (isHourFailedInMatrix(base, hourId as HourPeriod)) return;
      const keys = Object.keys(base.matrix).filter((k) => k.startsWith(`${hourId}__`));
      if (keys.length === 0) return;
      const updated = await patchSyncroSessionMatrixFailure(sessionId, keys);
      if (!updated) return;
      workingSessionRef.current = updated;
      onSessionUpdate(updated);
    };

    const tick = async (): Promise<boolean> => {
      if (cancelled) return false;

      let completed = countLlmReadyHours(workingSessionRef.current ?? activeSession);
      let failed = 0;
      let kvUnavailable = false;

      try {
        const res = await fetch(
          `/api/syncro/status?session_id=${encodeURIComponent(sessionId)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as StatusResponse;
          if (data.kv_configured === false) kvUnavailable = true;

          if (data.status) {
            const failedHourIds = data.status.failed_hours as HourPeriod[];
            failed = failedHourIds.length;
            completed = Math.max(completed, data.status.completed);

            for (const [hourId, hourData] of Object.entries(data.hours)) {
              if (!hourData?.advice) continue;
              await applyHourFromKv(hourId, hourData);
            }

            if (data.status.task_response && !workingSessionRef.current?.task_response) {
              const withTask = await patchSyncroSessionMatrix(
                sessionId,
                {},
                { cost_usd_delta: 0 },
                data.status.task_response,
              );
              if (withTask) {
                workingSessionRef.current = withTask;
                onSessionUpdate(withTask);
              }
            }

            for (const hourId of failedHourIds) {
              const hourData = data.hours[hourId];
              if (!hourData || !isSyncroHourKvComplete(hourData)) {
                await applyFailedHourFromKv(hourId);
              }
            }

            if (data.status.done) {
              if (data.status.task_response && !workingSessionRef.current?.task_response) {
                const withTask = await patchSyncroSessionMatrix(
                  sessionId,
                  {},
                  { cost_usd_delta: 0 },
                  data.status.task_response,
                );
                if (withTask) {
                  workingSessionRef.current = withTask;
                  onSessionUpdate(withTask);
                }
              }
              onProgress({
                completed: countLlmReadyHours(workingSessionRef.current ?? activeSession),
                total: 12,
                running: false,
                failed,
                failed_hours: failedHourIds,
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
              failed_hours: failedHourIds,
              current_hour: (data.status.current_hour as HourPeriod) ?? undefined,
              kv_unavailable: kvUnavailable,
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
        running: startBackground && completed < 12,
        failed,
        kv_unavailable: kvUnavailable,
      });
      return true;
    };

    const startCloudBatches = async () => {
      if (backgroundStartedRef.current) return;

      const baseSession = workingSessionRef.current ?? activeSession;
      if (isSubmissionTimelineComplete(baseSession)) {
        backgroundStartedRef.current = true;
        return;
      }
      if (countLlmReadyHours(baseSession) >= 12) {
        backgroundStartedRef.current = true;
        onProgress({
          completed: 12,
          total: 12,
          running: false,
          failed: 0,
        });
        clearSyncroLlmContext(sessionId);
        return;
      }

      backgroundStartedRef.current = true;

      let ctx = await resolveSyncroLlmContext(sessionId);
      if (!ctx) {
        ctx = await rebuildSyncroLlmContext(workingSessionRef.current ?? activeSession);
      }
      if (!ctx) {
        console.warn("[useSyncroInngestJob] no ctx for cloud batches");
        onProgress({
          completed: countLlmReadyHours(workingSessionRef.current ?? activeSession),
          total: 12,
          running: false,
          failed: 0,
          context_missing: true,
        });
        return;
      }

      const priorityHour =
        getLivePeriodInSubmissionTimeline(workingSessionRef.current ?? activeSession) ??
        getSubmissionAnchorPeriod(workingSessionRef.current ?? activeSession);

      try {
        const res = await fetch("/api/syncro/inngest_start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            submission_anchor: getSubmissionAnchorPeriod(workingSessionRef.current ?? activeSession),
            priority_hour: priorityHour,
            hour_order: getSubmissionHourSequence(workingSessionRef.current ?? activeSession),
            llm_context: ctx,
            device_id: getPojuDeviceId(),
            remaining_only: true,
          }),
        });
        if (!res.ok) {
          console.warn("[useSyncroInngestJob] inngest_start", res.status);
        }
      } catch (e) {
        console.warn("[useSyncroInngestJob] inngest_start failed:", e);
      }
    };

    void (async () => {
      if (startBackground) {
        await startCloudBatches();
      }
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
  }, [sessionId, session, enabled, startBackground, onSessionUpdate, onProgress]);
}
