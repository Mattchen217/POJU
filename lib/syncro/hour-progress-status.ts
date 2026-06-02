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

function isHourFailed(
  matrix: SyncroMatrix,
  hourId: HourPeriod,
  failedHourIds?: HourPeriod[],
): boolean {
  if (failedHourIds?.includes(hourId)) return true;
  const cells = cellsForHour(matrix, hourId);
  if (cells.length === 0) return false;
  return cells.every((c) => c.llm_failed);
}

/**
 * Per-hour dot status from matrix + optional KV failed_hours (not blocked by earlier hours).
 */
export function getHourDotStatus(
  hourId: HourPeriod,
  livePeriod: HourPeriod,
  matrix: SyncroMatrix,
  sortedPeriods?: HourPeriod[],
  llmMeta?: SyncroSession["llm_meta"],
  failedHourIds?: HourPeriod[],
): HourDotStatus {
  const order = sortedPeriods ?? sortedHourPeriodsFromLive(livePeriod);
  if (order.indexOf(hourId) < 0) return "pending";

  if (hourId === livePeriod) return "now";
  if (isHourFailed(matrix, hourId, failedHourIds)) return "failed";
  if (isHourPeriodLlmReady(matrix, hourId, llmMeta)) return "done";
  return "pending";
}
