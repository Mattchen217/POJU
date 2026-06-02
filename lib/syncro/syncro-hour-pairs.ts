import { HOUR_ORDER, sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";
import type { HourPeriod } from "@/lib/syncro/types";

export const SYNCRO_LLM_PAIR_COUNT = 6;
export const SYNCRO_HOURS_PER_LLM_CALL = 2;

export type SyncroHourPair = [HourPeriod, HourPeriod];

export function getNextHourPeriod(hourId: HourPeriod): HourPeriod {
  const idx = HOUR_ORDER.indexOf(hourId);
  if (idx < 0) return "zi";
  return HOUR_ORDER[(idx + 1) % HOUR_ORDER.length]!;
}

/** Six pairs along a fixed 12-hour sequence (submission timeline or rotated from live). */
export function buildHourPairsFromSequence(sequence: HourPeriod[]): SyncroHourPair[] {
  const pairs: SyncroHourPair[] = [];
  for (let i = 0; i < sequence.length; i += SYNCRO_HOURS_PER_LLM_CALL) {
    const a = sequence[i]!;
    const b = sequence[i + 1] ?? sequence[0]!;
    pairs.push([a, b]);
  }
  return pairs.slice(0, SYNCRO_LLM_PAIR_COUNT);
}

/** Same as submission sequence when anchor equals submission start hour. */
export function buildHourPairsFromLive(livePeriod: HourPeriod): SyncroHourPair[] {
  return buildHourPairsFromSequence(sortedHourPeriodsFromLive(livePeriod));
}

export function pairLabel(hourIds: HourPeriod[]): string {
  return hourIds.join("+");
}
