"use client";

import { useEffect, useRef } from "react";

import { readFetchJson } from "@/lib/client/fetch-json";
import { SYNCRO_LLM_BATCH_COUNT } from "@/lib/llm/services/syncro-reading-service";
import {
  clearSyncroLlmContext,
  loadSyncroLlmContext,
} from "@/lib/syncro/syncro-llm-context-storage";
import { dispatchSyncroMatrixPatch } from "@/lib/syncro/syncro-llm-events";
import { patchSyncroSessionMatrix } from "@/lib/syncro/syncro-session";
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

export function SyncroLlmBatchRunner({ sessionId, onSessionUpdate, onProgress }: Props) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session mount
  }, [sessionId]);

  async function runBatches() {
    const ctx = loadSyncroLlmContext(sessionId);
    if (!ctx) {
      onProgress({ completed: 0, total: SYNCRO_LLM_BATCH_COUNT, running: false, failed: 0 });
      return;
    }

    const total = SYNCRO_LLM_BATCH_COUNT;
    let completed = 0;
    let failed = 0;
    onProgress({ completed, total, running: true, failed });

    for (let batch_index = 0; batch_index < total; batch_index++) {
      try {
        const response = await fetch("/api/syncro/llm_batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            batch_index,
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

        if (!response.ok || !data.success || !data.advice) {
          failed++;
          console.warn(`[syncro/llm_batch] batch ${batch_index} failed:`, data.error ?? data.message);
        } else {
          const updated = await patchSyncroSessionMatrix(sessionId, data.advice, {
            model: data.model,
            tokens_used: data.tokens_used ?? 0,
            cost_usd_delta: data.cost_usd ?? 0,
          });
          if (updated) {
            onSessionUpdate(updated);
            dispatchSyncroMatrixPatch({
              session_id: sessionId,
              batch_index,
              batch_total: total,
              updated_keys: Object.keys(data.advice),
            });
          }
          completed++;
        }
      } catch (e) {
        failed++;
        console.warn(`[syncro/llm_batch] batch ${batch_index} error:`, e);
      }

      onProgress({
        completed,
        total,
        running: batch_index + 1 < total,
        failed,
      });
    }

    onProgress({ completed, total, running: false, failed });
    clearSyncroLlmContext(sessionId);
  }

  return null;
}
