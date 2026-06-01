"use client";

import { useEffect, useRef } from "react";

import { generateSyncroHourWithRetry } from "@/lib/syncro/generate-syncro-hour-with-retry";
import { SYNCRO_LLM_BATCH_COUNT } from "@/lib/llm/services/syncro-reading-service";
import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { HOUR_ORDER, sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";
import { rebuildSyncroLlmContext } from "@/lib/syncro/rebuild-syncro-llm-context";
import { getCurrentHourPeriod, type HourPeriod } from "@/lib/syncro/types";
import {
  clearSyncroLlmContext,
  resolveSyncroLlmContext,
  type SyncroLlmContext,
} from "@/lib/syncro/syncro-llm-context-storage";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import {
  patchSyncroSessionMatrix,
  patchSyncroSessionMatrixFailure,
} from "@/lib/syncro/syncro-session";
import type { SyncroSession } from "@/lib/syncro/types";

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

/**
 * Loads 12 LLM hours sequentially (live hour first), with per-hour retry.
 */
export function SyncroLlmBatchRunner({ sessionId, session, onSessionUpdate, onProgress }: Props) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session mount
  }, [sessionId]);

  async function applyHourResult(
    hourId: HourPeriod,
    hourIdx: number,
    ctx: SyncroLlmContext,
    result: Awaited<ReturnType<typeof generateSyncroHourWithRetry>>,
  ): Promise<"ok" | "fail"> {
    const cellKeys = Object.keys(ctx.local_matrix).filter((k) => k.startsWith(`${hourId}__`));

    if (result.success && result.advice) {
      const updated = await patchSyncroSessionMatrix(sessionId, result.advice, {
        model: result.model,
        tokens_used: result.tokens_used ?? 0,
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
      }
      return "ok";
    }

    const updated = await patchSyncroSessionMatrixFailure(sessionId, cellKeys);
    if (updated) onSessionUpdate(updated);
    return "fail";
  }

  async function runBatches() {
    const total = SYNCRO_LLM_BATCH_COUNT;
    const alreadyReady = countLlmReadyHours(session);
    if (alreadyReady >= total) {
      console.log("[Syncro] 12 时辰 LLM 已完成，跳过 batch");
      onProgress({ completed: total, total, running: false, failed: 0 });
      return;
    }

    let ctx = await resolveSyncroLlmContext(sessionId);
    if (!ctx) {
      console.warn("[Syncro] sessionStorage/IndexedDB 无 ctx，尝试 rebuild…");
      ctx = await rebuildSyncroLlmContext(session);
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

    const livePeriod = getCurrentHourPeriod();
    const hourSequence = sortedHourPeriodsFromLive(livePeriod);

    console.log("[Syncro] 串行生成顺序:", hourSequence);

    let completed = 0;
    let failed = 0;
    onProgress({ completed, total, running: true, failed, current_hour: hourSequence[0] });

    for (const hourId of hourSequence) {
      const hourIdx = HOUR_ORDER.indexOf(hourId);
      onProgress({ completed, total, running: true, failed, current_hour: hourId });

      console.log(`[Syncro] [${hourIdx + 1}/${total}] ${hourId} 时辰开始`);
      const result = await generateSyncroHourWithRetry(hourId, ctx);
      const status = await applyHourResult(hourId, hourIdx, ctx, result);
      if (status === "ok") completed++;
      else failed++;

      onProgress({ completed, total, running: true, failed, current_hour: hourId });
    }

    console.log("[Syncro] 所有 batch 完成", { completed, failed, total });
    onProgress({ completed, total, running: false, failed });
    clearSyncroLlmContext(sessionId);
  }

  return null;
}
