import { inngest } from "@/lib/inngest/client";
import {
  buildSyncroLlmHoursInput,
  generateSyncroHoursAdvice,
} from "@/lib/syncro/syncro-llm-batch-core";
import { isSyncroHourKvComplete } from "@/lib/syncro/syncro-hour-kv-complete";
import { getSyncroLlmContextKv } from "@/lib/syncro/syncro-llm-context-kv";
import { touchSyncroJob } from "@/lib/syncro/syncro-job-kv";
import { countCompletedInKv } from "@/lib/syncro/syncro-status-helpers";
import {
  getSyncroHour,
  getSyncroStatus,
  markSyncroHourFailed,
  setSyncroHour,
  setSyncroStatus,
} from "@/lib/syncro/syncro-status-kv";
import type { HourPeriod } from "@/lib/syncro/types";

export type SyncroGenerateBatchEvent = {
  name: "syncro/generate-batch";
  data: {
    session_id: string;
    hour_order: HourPeriod[];
    hour_ids: HourPeriod[];
    step_index: number;
    step_total: number;
  };
};

async function persistHourAdvice(
  sessionId: string,
  hourId: HourPeriod,
  advice: Record<string, import("@/lib/syncro/syncro-llm-core").SyncroHourAdviceCell>,
  completedAt: number,
): Promise<number> {
  const hourAdvice: Record<string, (typeof advice)[string]> = {};
  for (const [key, val] of Object.entries(advice)) {
    if (key.startsWith(`${hourId}__`)) hourAdvice[key] = val;
  }
  if (Object.keys(hourAdvice).length > 0) {
    await setSyncroHour(sessionId, hourId, {
      advice: hourAdvice,
      completed_at: completedAt,
    });
  }
  return Object.keys(hourAdvice).length;
}

/**
 * One LLM call per Inngest invocation (≤ Vercel 300s each).
 * Fan-out from inngest_start so work continues when the user leaves the app.
 */
export const syncroGenerateBatch = inngest.createFunction(
  {
    id: "syncro-generate-batch",
    retries: 2,
    concurrency: { limit: 1, key: "event.data.session_id" },
    triggers: [{ event: "syncro/generate-batch" }],
  },
  async ({ event, step }) => {
    const { session_id, hour_order, hour_ids, step_index, step_total } = event.data;
    const label = hour_ids.join("+");

    return await step.run(`batch-${step_index}-${label}`, async () => {
      const status = await getSyncroStatus(session_id);
      if (status?.done) return { skipped: true, reason: "done" };

      let skip = true;
      for (const h of hour_ids) {
        const data = await getSyncroHour(session_id, h);
        if (!isSyncroHourKvComplete(data)) {
          skip = false;
          break;
        }
      }
      if (skip) {
        const completed = await countCompletedInKv(session_id, hour_order);
        await setSyncroStatus(session_id, {
          total: 12,
          completed,
          current_hour: hour_ids[hour_ids.length - 1] ?? null,
          failed_hours: status?.failed_hours ?? [],
          hour_order,
          started_at: status?.started_at ?? Date.now(),
          updated_at: Date.now(),
          done: completed >= 12,
        });
        return { skipped: true, reason: "already_in_kv" };
      }

      await setSyncroStatus(session_id, {
        total: 12,
        completed: status?.completed ?? (await countCompletedInKv(session_id, hour_order)),
        current_hour: hour_ids[0] ?? null,
        failed_hours: status?.failed_hours ?? [],
        hour_order,
        started_at: status?.started_at ?? Date.now(),
        updated_at: Date.now(),
        done: false,
      });

      const ctx = await getSyncroLlmContextKv(session_id);
      if (!ctx) throw new Error("syncro_llm_context_missing");

      try {
        const input = buildSyncroLlmHoursInput(session_id, hour_ids, ctx);
        const result = await generateSyncroHoursAdvice(input);
        const now = Date.now();

        for (const hourId of hour_ids) {
          const n = await persistHourAdvice(session_id, hourId, result.advice, now);
          console.log(`[inngest/batch] ${session_id} ${hourId} cells=${n} step=${step_index + 1}/${step_total}`);
        }

        const completed = await countCompletedInKv(session_id, hour_order);
        const nextStatus = await getSyncroStatus(session_id);
        await setSyncroStatus(session_id, {
          total: 12,
          completed,
          current_hour: null,
          failed_hours: nextStatus?.failed_hours ?? [],
          hour_order,
          started_at: nextStatus?.started_at ?? Date.now(),
          updated_at: Date.now(),
          done: completed >= 12,
        });
        await touchSyncroJob(session_id);

        return {
          ok: true,
          hours: hour_ids,
          cells: Object.keys(result.advice).length,
          completed,
          step_index,
          step_total,
        };
      } catch (e) {
        console.error(`[inngest/batch] ${session_id} ${label} failed:`, e);
        for (const h of hour_ids) {
          await markSyncroHourFailed(session_id, h);
        }
        throw e;
      }
    });
  },
);
