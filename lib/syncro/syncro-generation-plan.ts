import { buildHourPairsFromSequence } from "@/lib/syncro/syncro-hour-pairs";
import type { HourPeriod } from "@/lib/syncro/types";

/** One Inngest LLM call: 1 or 2 hour periods. */
export type SyncroGenerationStep = HourPeriod[];

/**
 * 1) Priority hour (wall-clock NOW) — unlock compass (skipped when `skipPriority`).
 * 2) Remaining hours along submission timeline (pairs, skipping already scheduled).
 */
export function buildSyncroGenerationSteps(
  hourOrder: HourPeriod[],
  priorityHour: HourPeriod,
  options?: { skipPriority?: boolean },
): SyncroGenerationStep[] {
  const steps: SyncroGenerationStep[] = options?.skipPriority ? [] : [[priorityHour]];
  // When client already streamed priority, still mark it scheduled so pairs stay 2-by-2 on the rest.
  const scheduled = new Set<HourPeriod>([priorityHour]);

  for (const [a, b] of buildHourPairsFromSequence(hourOrder)) {
    const batch: HourPeriod[] = [];
    if (!scheduled.has(a)) {
      batch.push(a);
      scheduled.add(a);
    }
    if (!scheduled.has(b)) {
      batch.push(b);
      scheduled.add(b);
    }
    if (batch.length > 0) steps.push(batch);
  }

  return steps;
}
