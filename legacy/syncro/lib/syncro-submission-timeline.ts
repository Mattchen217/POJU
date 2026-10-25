import type { DirectionId } from "@/lib/syncro/current-system";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";
import {
  getCurrentHourPeriod,
  getCurrentHourPeriodInTimezone,
} from "@/lib/syncro/types";

import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";

const SAMPLE_DIRECTION: DirectionId = "N";
const SLOT_MS = 2 * 60 * 60 * 1000;

function getWallClockPeriod(session: SyncroSession, date: Date): HourPeriod {
  const tz = session.user_location?.timezone?.trim();
  if (tz) return getCurrentHourPeriodInTimezone(tz, date);
  return getCurrentHourPeriod(date);
}

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

function getTimelineEndMs(session: SyncroSession): number {
  const bounds = getSubmissionTimelineBounds(session);
  const expiresMs = session.expires_at.getTime();
  return Math.max(bounds?.endMs ?? 0, expiresMs);
}

export function isSubmissionTimelineComplete(
  session: SyncroSession,
  date: Date = new Date(),
): boolean {
  const endMs = getTimelineEndMs(session);
  if (endMs <= 0) return false;
  return date.getTime() >= endMs;
}

/**
 * Which submission slot is active now — uses device clock (`Date.now`) vs slot boundaries.
 * Falls back to wall-clock 时辰 + elapsed slots (fixes legacy matrix timestamps from UTC server).
 */
export function getLivePeriodInSubmissionTimeline(
  session: SyncroSession,
  date: Date = new Date(),
): HourPeriod | null {
  const ordered = getOrderedHourPeriodsFromSession(session);
  if (ordered.length === 0) return null;

  const now = date.getTime();
  const bounds = getSubmissionTimelineBounds(session);
  const timelineEndMs = getTimelineEndMs(session);
  if (timelineEndMs > 0 && now >= timelineEndMs) return null;
  if (bounds && now < bounds.startMs) return ordered[0] ?? null;

  let rangeIdx = -1;
  for (let i = 0; i < ordered.length; i++) {
    const period = ordered[i]!;
    const range = getPeriodTimeRange(session, period);
    if (!range) continue;
    if (now >= range.startMs && now < range.endMs) {
      rangeIdx = i;
      break;
    }
  }

  const minIdx = Math.max(0, Math.floor((now - session.created_at.getTime()) / SLOT_MS));
  const wallIdx = ordered.indexOf(getWallClockPeriod(session, date));

  if (rangeIdx >= 0) {
    if (rangeIdx >= minIdx) return ordered[rangeIdx] ?? null;
    if (wallIdx >= minIdx && wallIdx >= 0) return ordered[wallIdx] ?? null;
    return ordered[Math.min(Math.max(rangeIdx, minIdx), ordered.length - 1)] ?? null;
  }

  if (wallIdx >= minIdx && wallIdx >= 0) return ordered[wallIdx] ?? null;

  if (bounds && now >= bounds.startMs && now < bounds.endMs) {
    const idx = Math.min(Math.floor((now - bounds.startMs) / SLOT_MS), ordered.length - 1);
    return ordered[Math.max(minIdx, idx)] ?? null;
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
