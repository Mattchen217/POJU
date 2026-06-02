"use client";

import { useEffect, useRef } from "react";

import { SYNCRO_LLM_BATCH_COUNT } from "@/lib/llm/services/syncro-reading-service";
import { cellsForHourFromContext } from "@/lib/syncro/generate-syncro-hour-with-retry";
import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { HOUR_ORDER, sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";
import { hourPeriodDisplayName, HOUR_PERIOD_RANGES } from "@/lib/syncro/hour-period-ranges";
import { rebuildSyncroLlmContext } from "@/lib/syncro/rebuild-syncro-llm-context";
import {
  runStreamHourWithRetry,
  type RunWithRetryResult,
} from "@/lib/syncro/syncro-stream-hour-runner";
import type { StreamHourBody } from "@/lib/syncro/streaming-runner";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import {
  clearSyncroLlmContext,
  resolveSyncroLlmContext,
  type SyncroLlmContext,
} from "@/lib/syncro/syncro-llm-context-storage";
import {
  patchSyncroSessionMatrix,
  patchSyncroSessionMatrixFailure,
} from "@/lib/syncro/syncro-session";
import { getCurrentHourPeriod, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

export type SyncroLlmProgress = {
  completed: number;
  total: number;
  running: boolean;
  failed: number;
  current_hour?: HourPeriod;
  context_missing?: boolean;
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

function buildProfileSummary(ctx: SyncroLlmContext): string {
  const ba = ctx.base_analysis;
  if (typeof ba === "string") return ba.slice(0, 4000);
  try {
    return JSON.stringify(ba).slice(0, 4000);
  } catch {
    return ctx.task_description;
  }
}

function buildStreamBody(
  sessionId: string,
  hourId: HourPeriod,
  locale: string,
  ctx: SyncroLlmContext,
): StreamHourBody {
  const cells: StreamHourBody["cells"] = cellsForHourFromContext(ctx, hourId).map((cell) => {
    const local = ctx.local_matrix[cell.key];
    const hints = local?._internal?.key_factors;
    return {
      ...cell,
      key_hints: hints?.length ? hints : undefined,
    };
  });

  return {
    session_id: sessionId,
    hour_id: hourId,
    hour_label: hourPeriodDisplayName(hourId, locale),
    hour_range: HOUR_PERIOD_RANGES[hourId],
    cells,
    task_description: ctx.task_description,
    profile_summary: buildProfileSummary(ctx),
    locale,
  };
}

function isHourCompleteInSession(session: SyncroSession, hourId: HourPeriod): boolean {
  return isHourPeriodLlmReady(session.matrix, hourId, session.llm_meta);
}

/**
 * Loads remaining LLM hours sequentially (skips live hour — PreparingLiveHour handles it).
 */
export function SyncroLlmBatchRunner({ sessionId, session, onSessionUpdate, onProgress }: Props) {
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const abort = new AbortController();
    abortRef.current = abort;
    void runBatches(abort.signal);

    return () => {
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session mount
  }, [sessionId]);

  async function applyHourResult(
    hourId: HourPeriod,
    hourIdx: number,
    ctx: SyncroLlmContext,
    result: RunWithRetryResult,
  ): Promise<{ status: "ok" | "fail"; session?: SyncroSession }> {
    const cellKeys = Object.keys(ctx.local_matrix).filter((k) => k.startsWith(`${hourId}__`));

    if (result.success && result.advice) {
      const updated = await patchSyncroSessionMatrix(sessionId, result.advice, {
        cost_usd_delta: 0,
      });
      if (updated) {
        onSessionUpdate(updated);
        dispatchSyncroMatrixPatch({
          session_id: sessionId,
          batch_index: hourIdx,
          batch_total: SYNCRO_LLM_BATCH_COUNT,
          updated_keys: Object.keys(result.advice),
        });
        return { status: "ok", session: updated };
      }
      return { status: "fail" };
    }

    const updated = await patchSyncroSessionMatrixFailure(sessionId, cellKeys);
    if (updated) onSessionUpdate(updated);
    return { status: "fail", session: updated ?? undefined };
  }

  async function runBatches(signal: AbortSignal) {
    const total = SYNCRO_LLM_BATCH_COUNT;
    let workingSession = session;
    const alreadyReady = countLlmReadyHours(workingSession);
    if (alreadyReady >= total) {
      console.log("[Syncro] 12 时辰 LLM 已完成，跳过 batch");
      onProgress({ completed: total, total, running: false, failed: 0 });
      return;
    }

    let ctx = await resolveSyncroLlmContext(sessionId);
    if (!ctx) {
      console.warn("[Syncro] sessionStorage/IndexedDB 无 ctx，尝试 rebuild…");
      ctx = await rebuildSyncroLlmContext(workingSession);
    }

    if (!ctx) {
      console.error("[Syncro] 无法获取 LLM batch 上下文，batch 未启动");
      onProgress({
        completed: 0,
        total,
        running: false,
        failed: total,
        context_missing: true,
      });
      return;
    }

    const locale = ctx.locale;
    const currentHourId = getCurrentHourPeriod();
    const hourSequence = sortedHourPeriodsFromLive(currentHourId);

    console.log("[Syncro] 串行生成顺序:", hourSequence, "skip live:", currentHourId);

    let completed = countLlmReadyHours(workingSession);
    let failed = 0;
    onProgress({ completed, total, running: true, failed, current_hour: hourSequence[0] });

    for (const hourId of hourSequence) {
      if (signal.aborted) {
        console.log("[Syncro] batch aborted");
        break;
      }

      const hourIdx = HOUR_ORDER.indexOf(hourId);

      if (hourId === currentHourId) {
        console.log(`[BatchRunner] ${hourId} is live hour, skip (PreparingLiveHour)`);
        onProgress({ completed, total, running: true, failed, current_hour: hourId });
        continue;
      }

      if (isHourCompleteInSession(workingSession, hourId)) {
        console.log(`[BatchRunner] ${hourId} already done in IDB, skip`);
        onProgress({ completed, total, running: true, failed, current_hour: hourId });
        continue;
      }

      onProgress({ completed, total, running: true, failed, current_hour: hourId });

      console.log(`[Syncro] [${hourIdx + 1}/${total}] ${hourId} 时辰开始`);
      const body = buildStreamBody(sessionId, hourId, locale, ctx);
      const result = await runStreamHourWithRetry(
        body,
        {
          onContentChunk: () => {},
        },
        { signal },
      );

      if (signal.aborted) break;

      const applied = await applyHourResult(hourId, hourIdx, ctx, result);
      if (applied.session) workingSession = applied.session;
      if (applied.status === "ok") completed++;
      else failed++;

      onProgress({ completed, total, running: true, failed, current_hour: hourId });
    }

    console.log("[Syncro] 所有 batch 完成", { completed, failed, total });
    onProgress({ completed, total, running: false, failed });
    clearSyncroLlmContext(sessionId);
  }

  return null;
}
