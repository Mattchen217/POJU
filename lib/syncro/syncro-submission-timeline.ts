import type { DirectionId } from "@/lib/syncro/current-system";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";

const SAMPLE_DIRECTION: DirectionId = "N";

export type SubmissionTimelineState = {
  orderedPeriods: HourPeriod[];
  /** Active slot on the submission timeline, or null after the last slot ends. */
  livePeriod: HourPeriod | null;
  liveIndex: number;
  isComplete: boolean;
};

/** ISO time range for one hour slot (from any direction cell). */
export function getPeriodTimeRange(
  session: SyncroSession,
  period: HourPeriod,
): { startMs: number; endMs: number } | null {
  const direct = session.matrix[matrixKey(period, SAMPLE_DIRECTION)];
  if (direct?.hour_start_iso && direct.hour_end_iso) {
    return {
      startMs: new Date(direct.hour_start_iso).getTime(),
      endMs: new Date(direct.hour_end_iso).getTime(),
    };
  }

  for (const key of Object.keys(session.matrix)) {
    const cell = session.matrix[key];
    if (cell?.hour_period !== period) continue;
    if (!cell.hour_start_iso || !cell.hour_end_iso) continue;
    return {
      startMs: new Date(cell.hour_start_iso).getTime(),
      endMs: new Date(cell.hour_end_iso).getTime(),
    };
  }

  return null;
}

/** First / last instant of the fixed 12-slot submission window. */
export function getSubmissionTimelineBounds(session: SyncroSession): {
  startMs: number;
  endMs: number;
} | null {
  const ordered = getOrderedHourPeriodsFromSession(session);
  if (ordered.length === 0) return null;

  const first = getPeriodTimeRange(session, ordered[0]!);
  const last = getPeriodTimeRange(session, ordered[ordered.length - 1]!);
  if (!first || !last) return null;

  return { startMs: first.startMs, endMs: last.endMs };
}

export function isSubmissionTimelineComplete(
  session: SyncroSession,
  date: Date = new Date(),
): boolean {
  const bounds = getSubmissionTimelineBounds(session);
  if (!bounds) return false;
  return date.getTime() >= bounds.endMs;
}

/**
 * Which submission slot is active now (by hour_start / hour_end), not wall-clock rotation.
 * Returns null once the last slot has ended.
 */
export function getLivePeriodInSubmissionTimeline(
  session: SyncroSession,
  date: Date = new Date(),
): HourPeriod | null {
  const ordered = getOrderedHourPeriodsFromSession(session);
  if (ordered.length === 0) return null;

  const now = date.getTime();
  const bounds = getSubmissionTimelineBounds(session);
  if (bounds && now >= bounds.endMs) return null;

  for (const period of ordered) {
    const range = getPeriodTimeRange(session, period);
    if (!range) continue;
    if (now >= range.startMs && now < range.endMs) return period;
  }

  if (bounds && now < bounds.startMs) {
    return ordered[0] ?? null;
  }

  return null;
}

export function getSubmissionTimelineState(
  session: SyncroSession,
  date: Date = new Date(),
): SubmissionTimelineState {
  const orderedPeriods = getOrderedHourPeriodsFromSession(session);
  const isComplete = isSubmissionTimelineComplete(session, date);
  const livePeriod = isComplete ? null : getLivePeriodInSubmissionTimeline(session, date);
  const liveIndex = livePeriod ? orderedPeriods.indexOf(livePeriod) : isComplete ? orderedPeriods.length : -1;

  return {
    orderedPeriods,
    livePeriod,
    liveIndex,
    isComplete,
  };
}

/** Session expiry = end of the 12th submission slot (fallback: +24h). */
export function computeSyncroSessionExpiresAt(
  matrix: SyncroSession["matrix"],
  fallbackFrom: Date = new Date(),
): Date {
  let endMs = 0;
  for (const key of Object.keys(matrix)) {
    const end = new Date(matrix[key]!.hour_end_iso).getTime();
    if (Number.isFinite(end) && end > endMs) endMs = end;
  }

  if (endMs <= 0) {
    return new Date(fallbackFrom.getTime() + 24 * 60 * 60 * 1000);
  }

  return new Date(endMs);
}
