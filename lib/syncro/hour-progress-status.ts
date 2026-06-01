import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { matrixKey, type HourPeriod, type SyncroMatrix, type SyncroSession } from "@/lib/syncro/types";
import type { DirectionId } from "@/lib/syncro/current-system";

import { sortedHourPeriodsFromLive } from "@/lib/syncro/hour-order";

export { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";

const DIRECTIONS: DirectionId[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export type HourDotStatus = "now" | "done" | "pending" | "failed";

function cellsForHour(matrix: SyncroMatrix, hourId: HourPeriod) {
  return DIRECTIONS.map((dir) => matrix[matrixKey(hourId, dir)]).filter(Boolean);
}

function isHourFailed(matrix: SyncroMatrix, hourId: HourPeriod): boolean {
  const cells = cellsForHour(matrix, hourId);
  if (cells.length === 0) return false;
  return cells.every((c) => c.llm_failed);
}

/**
 * Sequential hour-dot status: later hours stay pending until earlier ones finish LLM.
 */
export function getHourDotStatus(
  hourId: HourPeriod,
  livePeriod: HourPeriod,
  matrix: SyncroMatrix,
  sortedPeriods?: HourPeriod[],
  llmMeta?: SyncroSession["llm_meta"],
): HourDotStatus {
  const order = sortedPeriods ?? sortedHourPeriodsFromLive(livePeriod);

  if (hourId === livePeriod) return "now";

  const idx = order.indexOf(hourId);
  if (idx < 0) return "pending";

  for (let i = 0; i < idx; i++) {
    const prev = order[i]!;
    if (!isHourPeriodLlmReady(matrix, prev, llmMeta) && !isHourFailed(matrix, prev)) {
      return "pending";
    }
  }

  if (isHourFailed(matrix, hourId)) return "failed";
  if (isHourPeriodLlmReady(matrix, hourId, llmMeta)) return "done";
  return "pending";
}
