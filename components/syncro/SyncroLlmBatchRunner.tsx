"use client";

import { useEffect, useRef } from "react";

import { readFetchJson } from "@/lib/client/fetch-json";
import {
  SYNCRO_LLM_BATCH_COUNT,
  getSyncroBatchKeyLists,
} from "@/lib/llm/services/syncro-reading-service";
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
  /** Hour currently being generated (timeline order from live period). */
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
 * Loads 12 LLM batches sequentially (live hour first), one hour at a time.
 */
export function SyncroLlmBatchRunner({ sessionId, session, onSessionUpdate, onProgress }: Props) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session mount
  }, [sessionId]);

  async function loadHourBatch(
    hourId: HourPeriod,
    hourIdx: number,
    cellKeys: string[],
    ctx: SyncroLlmContext,
  ): Promise<"ok" | "fail"> {
    if (cellKeys.length === 0) {
      console.warn(`[Syncro] ⚠️ ${hourId} 时辰没有 cells`);
      return "fail";
    }

    console.log(
      `[Syncro] [${hourIdx + 1}/${SYNCRO_LLM_BATCH_COUNT}] ${hourId} 时辰开始 LLM 调用, cells: ${cellKeys.length}`,
    );
    const startTime = Date.now();

    try {
      const response = await fetch("/api/syncro/llm_batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          batch_index: hourIdx,
          hour_id: hourId,
          profile_id: ctx.profile_id,
          task_description: ctx.task_description,
          user_location: ctx.user_location,
          locale: ctx.locale,
          user_profile: ctx.user_profile,
          base_analysis: ctx.base_analysis,
          local_matrix: ctx.local_matrix,
          compute_started_at: ctx.compute_started_at,
          true_solar_meta: ctx.true_solar,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(
          `[Syncro] ❌ ${hourId} 时辰 batch 失败:`,
          response.status,
          errText.slice(0, 200),
        );
        const updated = await patchSyncroSessionMatrixFailure(sessionId, cellKeys);
        if (updated) onSessionUpdate(updated);
        return "fail";
      }

      const data = await readFetchJson<{
        success?: boolean;
        advice?: Record<
          string,
          { short_advice: string; detailed_advice: string; rationale: string }
        >;
        model?: string;
        tokens_used?: number;
        cost_usd?: number;
        error?: string;
        message?: string;
      }>(response);

      if (!data.success || !data.advice) {
        console.error(`[Syncro] ❌ ${hourId} 时辰 batch 无 advice:`, data.error ?? data.message);
        const updated = await patchSyncroSessionMatrixFailure(sessionId, cellKeys);
        if (updated) onSessionUpdate(updated);
        return "fail";
      }

      const elapsed = Date.now() - startTime;
      console.log(
        `[Syncro] ✅ ${hourId} 时辰完成, 耗时 ${elapsed}ms, cells: ${Object.keys(data.advice).length}`,
      );

      const updated = await patchSyncroSessionMatrix(sessionId, data.advice, {
        model: data.model,
        tokens_used: data.tokens_used ?? 0,
        cost_usd_delta: data.cost_usd ?? 0,
      });
      if (updated) {
        onSessionUpdate(updated);
        dispatchSyncroMatrixPatch({
          session_id: sessionId,
          batch_index: hourIdx,
          batch_total: SYNCRO_LLM_BATCH_COUNT,
          updated_keys: Object.keys(data.advice),
        });
      }
      return "ok";
    } catch (e) {
      console.error(`[Syncro] ❌ ${hourId} 时辰异常:`, e);
      const updated = await patchSyncroSessionMatrixFailure(sessionId, cellKeys);
      if (updated) onSessionUpdate(updated);
      return "fail";
    }
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

    const batchKeyLists = getSyncroBatchKeyLists(ctx.local_matrix);
    const livePeriod = getCurrentHourPeriod();
    const hourSequence = sortedHourPeriodsFromLive(livePeriod);

    console.log("[Syncro] 开始按序加载 12 时辰 (从当前时辰起):", hourSequence);

    let completed = 0;
    let failed = 0;
    onProgress({ completed, total, running: true, failed, current_hour: hourSequence[0] });

    for (const hourId of hourSequence) {
      const hourIdx = HOUR_ORDER.indexOf(hourId);
      const cellKeys = batchKeyLists[hourIdx] ?? [];

      onProgress({ completed, total, running: true, failed, current_hour: hourId });

      const result = await loadHourBatch(hourId, hourIdx, cellKeys, ctx);
      if (result === "ok") completed++;
      else failed++;

      onProgress({ completed, total, running: true, failed, current_hour: hourId });
    }

    console.log("[Syncro] 所有 batch 完成", { completed, failed, total });
    onProgress({ completed, total, running: false, failed });
    clearSyncroLlmContext(sessionId);
  }

  return null;
}
