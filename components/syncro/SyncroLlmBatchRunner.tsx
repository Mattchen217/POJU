"use client";

import { useEffect, useRef } from "react";

import { SYNCRO_LLM_BATCH_COUNT } from "@/lib/llm/services/syncro-reading-service";
import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { HOUR_ORDER } from "@/lib/syncro/hour-order";
import { rebuildSyncroLlmContext } from "@/lib/syncro/rebuild-syncro-llm-context";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import {
  clearSyncroLlmContext,
  resolveSyncroLlmContext,
} from "@/lib/syncro/syncro-llm-context-storage";
import { patchSyncroSessionMatrix } from "@/lib/syncro/syncro-session";
import type { SyncroSession } from "@/lib/syncro/types";
import type { SyncroHourData } from "@/lib/syncro/syncro-status-kv";
import { getSubmissionAnchorPeriod } from "@/lib/syncro/syncro-submission-schedule";
import type { HourPeriod } from "@/lib/syncro/types";

export type SyncroLlmProgress = {
  completed: number;
  total: number;
  running: boolean;
  failed: number;
  current_hour?: HourPeriod;
  context_missing?: boolean;
  kv_unavailable?: boolean;
  /** Client is streaming the priority (NOW) hour before compass. */
  priority_generating?: boolean;
};

type Props = {
  sessionId: string;
  session: SyncroSession;
  onSessionUpdate: (session: SyncroSession) => void;
  onProgress: (progress: SyncroLlmProgress) => void;
};

function countLlmReadyHours(session: SyncroSession): number {
  let ready = 0;
  for (const hourId of HOUR_ORDER) {
    if (isHourPeriodLlmReady(session.matrix, hourId, session.llm_meta)) ready++;
  }
  return ready;
}

type StatusResponse = {
  status: {
    completed: number;
    total: number;
    current_hour: string | null;
    failed_hours: string[];
    done: boolean;
  } | null;
  hours: Record<string, SyncroHourData | null>;
};

/**
 * Poll KV status (Inngest background) and patch IndexedDB when new hour advice arrives.
 */
export function SyncroLlmBatchRunner({ sessionId, session, onSessionUpdate, onProgress }: Props) {
  const startedRef = useRef(false);
  const appliedHoursRef = useRef<Set<string>>(new Set());
  const workingSessionRef = useRef(session);

  useEffect(() => {
    workingSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void runPollLoop();

    async function runPollLoop() {
      const total = SYNCRO_LLM_BATCH_COUNT;
      let failed = 0;

      const tick = async () => {
        let completed = countLlmReadyHours(workingSessionRef.current);

        try {
          const res = await fetch(
            `/api/syncro/status?session_id=${encodeURIComponent(sessionId)}`,
          );
          if (res.ok) {
            const data = (await res.json()) as StatusResponse;

            if (data.status) {
              failed = data.status.failed_hours.length;
              completed = Math.max(completed, data.status.completed);

              for (const [hourId, hourData] of Object.entries(data.hours)) {
                if (!hourData?.advice || appliedHoursRef.current.has(hourId)) continue;

                const updated = await patchSyncroSessionMatrix(sessionId, hourData.advice, {
                  cost_usd_delta: 0,
                });
                if (updated) {
                  appliedHoursRef.current.add(hourId);
                  workingSessionRef.current = updated;
                  onSessionUpdate(updated);
                  dispatchSyncroMatrixPatch({
                    session_id: sessionId,
                    batch_index: HOUR_ORDER.indexOf(hourId as HourPeriod),
                    batch_total: total,
                    updated_keys: Object.keys(hourData.advice),
                  });
                }
              }

              if (data.status.done) {
                onProgress({
                  completed: countLlmReadyHours(workingSessionRef.current),
                  total,
                  running: false,
                  failed,
                });
                clearSyncroLlmContext(sessionId);
                return false;
              }

              onProgress({
                completed,
                total,
                running: true,
                failed,
                current_hour: (data.status.current_hour as HourPeriod) ?? undefined,
              });
            }
          }
        } catch (e) {
          console.warn("[SyncroLlmBatchRunner] status poll failed:", e);
        }

        completed = countLlmReadyHours(workingSessionRef.current);
        if (completed >= total) {
          onProgress({ completed: total, total, running: false, failed });
          clearSyncroLlmContext(sessionId);
          return false;
        }

        onProgress({
          completed,
          total,
          running: true,
          failed,
        });
        return true;
      };

      if (!(await tick())) return;

      const interval = window.setInterval(async () => {
        const cont = await tick();
        if (!cont) window.clearInterval(interval);
      }, 4000);

      const maybeResumeBackground = async () => {
        const ready = countLlmReadyHours(workingSessionRef.current);
        if (ready >= total) return;

        const statusRes = await fetch(
          `/api/syncro/status?session_id=${encodeURIComponent(sessionId)}`,
        );
        const statusJson = statusRes.ok ? ((await statusRes.json()) as StatusResponse) : null;
        if (statusJson?.status) return;

        let ctx = await resolveSyncroLlmContext(sessionId);
        if (!ctx) ctx = await rebuildSyncroLlmContext(workingSessionRef.current);
        if (!ctx) {
          onProgress({
            completed: ready,
            total,
            running: false,
            failed: total,
            context_missing: true,
          });
          return;
        }

        await fetch("/api/syncro/trigger-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            live_period: getSubmissionAnchorPeriod(workingSessionRef.current),
            llm_context: ctx,
          }),
        });
      };

      void maybeResumeBackground();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session
  }, [sessionId]);

  return null;
}
