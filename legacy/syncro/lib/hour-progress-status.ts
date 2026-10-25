import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import { matrixKey, type HourPeriod, type SyncroMatrix, type SyncroSession } from "@/lib/syncro/types";
import type { DirectionId } from "@/lib/syncro/current-system";

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
 * Per-hour dot status on the fixed submission timeline (not wall-clock rotation).
 */
export function getHourDotStatus(
  hourId: HourPeriod,
  livePeriod: HourPeriod | null,
  matrix: SyncroMatrix,
  orderedPeriods: HourPeriod[],
  llmMeta?: SyncroSession["llm_meta"],
  failedHourIds?: HourPeriod[],
): HourDotStatus {
  const idx = orderedPeriods.indexOf(hourId);
  if (idx < 0) return "pending";

  if (livePeriod && hourId === livePeriod) return "now";

  const liveIdx =
    livePeriod !== null ? orderedPeriods.indexOf(livePeriod) : orderedPeriods.length;

  if (isHourFailed(matrix, hourId, failedHourIds)) return "failed";
  if (isHourPeriodLlmReady(matrix, hourId, llmMeta)) return "done";
  if (liveIdx >= 0 && idx < liveIdx) return "pending";
  return "pending";
}
