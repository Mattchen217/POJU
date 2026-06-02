import { HOUR_ORDER, sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";
import type { HourPeriod } from "@/lib/syncro/types";

export const SYNCRO_LLM_PAIR_COUNT = 6;
export const SYNCRO_HOURS_PER_LLM_CALL = 2;

export function getNextHourPeriod(hourId: HourPeriod): HourPeriod {
  const idx = HOUR_ORDER.indexOf(hourId);
  if (idx < 0) return "zi";
  return HOUR_ORDER[(idx + 1) % HOUR_ORDER.length]!;
}

/** Six pairs of two hours each, starting from live hour (live+next is pair 0). */
export function buildHourPairsFromLive(livePeriod: HourPeriod): [HourPeriod, HourPeriod][] {
  const sequence = sortedHourPeriodsFromLive(livePeriod);
  const pairs: [HourPeriod, HourPeriod][] = [];
  for (let i = 0; i < sequence.length; i += SYNCRO_HOURS_PER_LLM_CALL) {
    const a = sequence[i]!;
    const b = sequence[i + 1] ?? sequence[0]!;
    pairs.push([a, b]);
  }
  return pairs;
}

export function pairLabel(hourIds: HourPeriod[]): string {
  return hourIds.join("+");
}
