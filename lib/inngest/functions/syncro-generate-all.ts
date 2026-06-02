import { inngest } from "@/lib/inngest/client";
import {
  buildSyncroLlmHoursInput,
  generateSyncroHoursAdvice,
} from "@/lib/syncro/syncro-llm-batch-core";
import { isSyncroHourKvComplete } from "@/lib/syncro/syncro-hour-kv-complete";
import { buildHourPairsFromSequence } from "@/lib/syncro/syncro-hour-pairs";
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

export type SyncroGenerateAllEvent = {
  name: "syncro/generate-all";
  data: {
    session_id: string;
    hour_order: HourPeriod[];
  };
};

export const syncroGenerateAll = inngest.createFunction(
  {
    id: "syncro-generate-all",
    retries: 1,
    concurrency: { limit: 1, key: "event.data.session_id" },
    triggers: [{ event: "syncro/generate-all" }],
  },
  async ({ event, step }) => {
    const { session_id, hour_order } = event.data;
    const pairs = buildHourPairsFromSequence(hour_order);

    await step.run("load-ctx", async () => {
      const c = await getSyncroLlmContextKv(session_id);
      if (!c) throw new Error("syncro_llm_context_missing");
      return { ok: true };
    });

    for (let pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
      const [h1, h2] = pairs[pairIndex]!;

      await step.run(`pair-${pairIndex}-${h1}-${h2}`, async () => {
        const status = await getSyncroStatus(session_id);
        if (status?.done) return { skipped: true, reason: "done" };

        const existing1 = await getSyncroHour(session_id, h1);
        const existing2 = await getSyncroHour(session_id, h2);
        if (isSyncroHourKvComplete(existing1) && isSyncroHourKvComplete(existing2)) {
          const completed = await countCompletedInKv(session_id, hour_order);
          await setSyncroStatus(session_id, {
            total: 12,
            completed,
            current_hour: h2,
            failed_hours: status?.failed_hours ?? [],
            hour_order,
            started_at: status?.started_at ?? Date.now(),
            updated_at: Date.now(),
            done: completed >= 12,
          });
          await touchSyncroJob(session_id);
          return { skipped: true, reason: "already_in_kv" };
        }

        await setSyncroStatus(session_id, {
          total: 12,
          completed: status?.completed ?? (await countCompletedInKv(session_id, hour_order)),
          current_hour: h1,
          failed_hours: status?.failed_hours ?? [],
          hour_order,
          started_at: status?.started_at ?? Date.now(),
          updated_at: Date.now(),
          done: false,
        });

        const ctx = await getSyncroLlmContextKv(session_id);
        if (!ctx) throw new Error("syncro_llm_context_missing");

        try {
          const input = buildSyncroLlmHoursInput(session_id, [h1, h2], ctx);
          const result = await generateSyncroHoursAdvice(input);

          const now = Date.now();
          for (const hourId of [h1, h2]) {
            const hourAdvice: Record<string, (typeof result.advice)[string]> = {};
            for (const [key, val] of Object.entries(result.advice)) {
              if (key.startsWith(`${hourId}__`)) hourAdvice[key] = val;
            }
            if (Object.keys(hourAdvice).length > 0) {
              await setSyncroHour(session_id, hourId, {
                advice: hourAdvice,
                completed_at: now,
              });
            }
          }

          const completed = await countCompletedInKv(session_id, hour_order);
          const nextStatus = await getSyncroStatus(session_id);
          await setSyncroStatus(session_id, {
            total: 12,
            completed,
            current_hour:
              pairIndex < pairs.length - 1 ? pairs[pairIndex + 1]![0] : null,
            failed_hours: nextStatus?.failed_hours ?? [],
            hour_order,
            started_at: nextStatus?.started_at ?? Date.now(),
            updated_at: Date.now(),
            done: completed >= 12,
          });
          await touchSyncroJob(session_id);

          return { ok: true, cells: Object.keys(result.advice).length, completed };
        } catch (e) {
          console.error(`[inngest] pair ${pairIndex} failed:`, e);
          await markSyncroHourFailed(session_id, h1);
          await markSyncroHourFailed(session_id, h2);
          throw e;
        }
      });
    }

    await step.run("finalize", async () => {
      const completed = await countCompletedInKv(session_id, hour_order);
      const status = await getSyncroStatus(session_id);
      await setSyncroStatus(session_id, {
        total: 12,
        completed,
        current_hour: null,
        failed_hours: status?.failed_hours ?? [],
        hour_order,
        started_at: status?.started_at ?? Date.now(),
        updated_at: Date.now(),
        done: completed >= 12,
      });
      await touchSyncroJob(session_id);
    });

    return { session_id, pairs: pairs.length };
  },
);
