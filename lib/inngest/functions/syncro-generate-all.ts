import { inngest } from "@/lib/inngest/client";
import {
  buildSyncroLlmHoursInput,
  generateSyncroHoursAdvice,
} from "@/lib/syncro/syncro-llm-batch-core";
import { buildSyncroGenerationSteps } from "@/lib/syncro/syncro-generation-plan";
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

export type SyncroGenerateAllEvent = {
  name: "syncro/generate-all";
  data: {
    session_id: string;
    hour_order: HourPeriod[];
    priority_hour: HourPeriod;
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

export const syncroGenerateAll = inngest.createFunction(
  {
    id: "syncro-generate-all",
    retries: 1,
    concurrency: { limit: 1, key: "event.data.session_id" },
    triggers: [{ event: "syncro/generate-all" }],
  },
  async ({ event, step }) => {
    const { session_id, hour_order, priority_hour } = event.data;
    const steps = buildSyncroGenerationSteps(hour_order, priority_hour);

    await step.run("load-ctx", async () => {
      const c = await getSyncroLlmContextKv(session_id);
      if (!c) throw new Error("syncro_llm_context_missing");
      return { ok: true };
    });

    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const hourIds = steps[stepIndex]!;
      const label = hourIds.join("+");

      await step.run(`gen-${stepIndex}-${label}`, async () => {
        const status = await getSyncroStatus(session_id);
        if (status?.done) return { skipped: true, reason: "done" };

        let skip = true;
        for (const h of hourIds) {
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
            current_hour: hourIds[hourIds.length - 1] ?? null,
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
          current_hour: hourIds[0] ?? null,
          failed_hours: status?.failed_hours ?? [],
          hour_order,
          started_at: status?.started_at ?? Date.now(),
          updated_at: Date.now(),
          done: false,
        });

        const ctx = await getSyncroLlmContextKv(session_id);
        if (!ctx) throw new Error("syncro_llm_context_missing");

        try {
          const input = buildSyncroLlmHoursInput(session_id, hourIds, ctx);
          const result = await generateSyncroHoursAdvice(input);
          const now = Date.now();

          for (const hourId of hourIds) {
            const n = await persistHourAdvice(session_id, hourId, result.advice, now);
            console.log(`[inngest] ${session_id} ${hourId} cells=${n}`);
          }

          const completed = await countCompletedInKv(session_id, hour_order);
          const nextStatus = await getSyncroStatus(session_id);
          await setSyncroStatus(session_id, {
            total: 12,
            completed,
            current_hour:
              stepIndex < steps.length - 1
                ? steps[stepIndex + 1]![0] ?? null
                : null,
            failed_hours: nextStatus?.failed_hours ?? [],
            hour_order,
            started_at: nextStatus?.started_at ?? Date.now(),
            updated_at: Date.now(),
            done: completed >= 12,
          });
          await touchSyncroJob(session_id);

          return {
            ok: true,
            hours: hourIds,
            cells: Object.keys(result.advice).length,
            completed,
          };
        } catch (e) {
          console.error(`[inngest] step ${stepIndex} (${label}) failed:`, e);
          for (const h of hourIds) {
            await markSyncroHourFailed(session_id, h);
          }
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

    return { session_id, steps: steps.length, priority_hour };
  },
);
