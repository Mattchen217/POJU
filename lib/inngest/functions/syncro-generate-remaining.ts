import { inngest } from "@/lib/inngest/client";
import {
  buildSyncroLlmHoursInput,
  generateSyncroHoursAdvice,
} from "@/lib/syncro/syncro-llm-batch-core";
import { buildHourPairsFromLive } from "@/lib/syncro/syncro-hour-pairs";
import { getSyncroLlmContextKv } from "@/lib/syncro/syncro-llm-context-kv";
import {
  getSyncroStatus,
  markSyncroHourFailed,
  setSyncroHour,
  setSyncroStatus,
} from "@/lib/syncro/syncro-status-kv";
import type { HourPeriod } from "@/lib/syncro/types";

export type SyncroGenerateRemainingEvent = {
  name: "syncro/generate-remaining";
  data: {
    session_id: string;
    live_period: HourPeriod;
  };
};

export const syncroGenerateRemaining = inngest.createFunction(
  {
    id: "syncro-generate-remaining",
    retries: 1,
    triggers: [{ event: "syncro/generate-remaining" }],
  },
  async ({ event, step }) => {
    const { session_id, live_period } = event.data;

    await step.run("load-ctx", async () => {
      const c = await getSyncroLlmContextKv(session_id);
      if (!c) throw new Error("syncro_llm_context_missing");
      return { ok: true };
    });

    const pairs = buildHourPairsFromLive(live_period);

    for (let pairIndex = 1; pairIndex < pairs.length; pairIndex++) {
      const [h1, h2] = pairs[pairIndex]!;

      await step.run(`pair-${pairIndex}-${h1}-${h2}`, async () => {
        const ctx = await getSyncroLlmContextKv(session_id);
        if (!ctx) throw new Error("syncro_llm_context_missing");

        const status = await getSyncroStatus(session_id);
        if (status?.done) return { skipped: true };

        await setSyncroStatus(session_id, {
          total: 12,
          completed: status?.completed ?? pairIndex * 2,
          current_hour: h1,
          failed_hours: status?.failed_hours ?? [],
          hour_order: pairs.flatMap((p) => [p[0], p[1]]),
          started_at: status?.started_at ?? Date.now(),
          updated_at: Date.now(),
          done: false,
        });

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

          const nextStatus = await getSyncroStatus(session_id);
          const completed = Math.min(12, (nextStatus?.completed ?? 0) + 2);
          await setSyncroStatus(session_id, {
            total: 12,
            completed,
            current_hour: pairIndex < pairs.length - 1 ? pairs[pairIndex + 1]![0] : null,
            failed_hours: nextStatus?.failed_hours ?? [],
            hour_order: pairs.flatMap((p) => [p[0], p[1]]),
            started_at: nextStatus?.started_at ?? Date.now(),
            updated_at: Date.now(),
            done: completed >= 12,
          });

          return { ok: true, cells: Object.keys(result.advice).length };
        } catch (e) {
          console.error(`[inngest] pair ${pairIndex} failed:`, e);
          await markSyncroHourFailed(session_id, h1);
          await markSyncroHourFailed(session_id, h2);
          throw e;
        }
      });
    }

    await step.run("finalize", async () => {
      const status = await getSyncroStatus(session_id);
      await setSyncroStatus(session_id, {
        total: 12,
        completed: status?.completed ?? 12,
        current_hour: null,
        failed_hours: status?.failed_hours ?? [],
        hour_order: pairs.flatMap((p) => [p[0], p[1]]),
        started_at: status?.started_at ?? Date.now(),
        updated_at: Date.now(),
        done: true,
      });
    });

    return { session_id, pairs: pairs.length };
  },
);
