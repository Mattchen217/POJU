"use client";

import { useEffect, useRef } from "react";

import { readFetchJson } from "@/lib/client/fetch-json";
import {
  SYNCRO_LLM_BATCH_COUNT,
  getSyncroBatchKeyLists,
} from "@/lib/llm/services/syncro-reading-service";
import { HOUR_ORDER } from "@/lib/syncro/hour-order";
import type { HourPeriod } from "@/lib/syncro/types";
import {
  clearSyncroLlmContext,
  loadSyncroLlmContext,
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
};

type Props = {
  sessionId: string;
  onSessionUpdate: (session: SyncroSession) => void;
  onProgress: (progress: SyncroLlmProgress) => void;
};

/**
 * Loads 12 LLM batches (one per hour period), in parallel.
 * Hour dots light in timeline order via HourProgressBar sequential logic.
 */
export function SyncroLlmBatchRunner({ sessionId, onSessionUpdate, onProgress }: Props) {
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
    ctx: NonNullable<ReturnType<typeof loadSyncroLlmContext>>,
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
    const ctx = loadSyncroLlmContext(sessionId);
    if (!ctx) {
      onProgress({ completed: 0, total: SYNCRO_LLM_BATCH_COUNT, running: false, failed: 0 });
      return;
    }

    const batchKeyLists = getSyncroBatchKeyLists(ctx.local_matrix);

    console.log("[Syncro] 开始加载 12 时辰数据");
    console.log("[Syncro] 当前 matrix 总 cell 数:", Object.keys(ctx.local_matrix).length);

    const keysByHour: Record<string, number> = {};
    for (const hour of HOUR_ORDER) {
      keysByHour[hour] = batchKeyLists[HOUR_ORDER.indexOf(hour)]?.length ?? 0;
    }
    console.log("[Syncro] 按时辰分组:", keysByHour);

    let completed = 0;
    let failed = 0;
    const total = SYNCRO_LLM_BATCH_COUNT;
    onProgress({ completed, total, running: true, failed });

    const results = await Promise.allSettled(
      HOUR_ORDER.map((hourId, hourIdx) => {
        const cellKeys = batchKeyLists[hourIdx] ?? [];
        return loadHourBatch(hourId, hourIdx, cellKeys, ctx);
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value === "ok") completed++;
      else failed++;
    }

    console.log("[Syncro] 所有 batch 完成", { completed, failed, total });
    onProgress({ completed, total, running: false, failed });
    clearSyncroLlmContext(sessionId);
  }

  return null;
}
