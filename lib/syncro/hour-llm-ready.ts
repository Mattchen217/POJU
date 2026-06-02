import { isSyncroLlmReady } from "@/lib/syncro/llm-cell-display";
import { HOUR_ORDER } from "@/lib/syncro/hour-order";
import { matrixKey, type HourPeriod, type SyncroMatrix, type SyncroSession } from "@/lib/syncro/types";
import type { DirectionId } from "@/lib/syncro/current-system";

const DIRECTIONS: DirectionId[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** True when every direction cell for this hour has real LLM copy. */
export function isHourPeriodLlmReady(
  matrix: SyncroMatrix,
  hourId: HourPeriod,
  llmMeta?: SyncroSession["llm_meta"],
): boolean {
  const cells = DIRECTIONS.map((dir) => matrix[matrixKey(hourId, dir)]).filter(Boolean);
  if (cells.length === 0) return false;
  return cells.every((c) => isSyncroLlmReady(c, llmMeta));
}

export function isLiveHourPeriodLlmReady(
  session: SyncroSession,
  livePeriod: HourPeriod,
): boolean {
  return isHourPeriodLlmReady(session.matrix, livePeriod, session.llm_meta);
}

/** Compass gate: first LLM pair (live hour + next hour) both ready. */
export function isInitialSyncroGateReady(
  session: SyncroSession,
  livePeriod: HourPeriod,
): boolean {
  const idx = HOUR_ORDER.indexOf(livePeriod);
  const next = idx >= 0 ? HOUR_ORDER[(idx + 1) % HOUR_ORDER.length]! : livePeriod;
  return (
    isHourPeriodLlmReady(session.matrix, livePeriod, session.llm_meta) &&
    isHourPeriodLlmReady(session.matrix, next, session.llm_meta)
  );
}
