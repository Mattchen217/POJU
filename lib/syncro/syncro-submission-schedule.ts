import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import {
  buildHourPairsFromSequence,
  type SyncroHourPair,
} from "@/lib/syncro/syncro-hour-pairs";
import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";
import {
  getCurrentHourPeriod,
  getCurrentHourPeriodInTimezone,
  type HourPeriod,
  type SyncroSession,
} from "@/lib/syncro/types";

/** 12-hour timeline anchored at user submission (matrix slot order). */
export function getSubmissionHourSequence(session: SyncroSession): HourPeriod[] {
  return getOrderedHourPeriodsFromSession(session);
}

export function getSubmissionAnchorPeriod(session: SyncroSession): HourPeriod {
  const sequence = getSubmissionHourSequence(session);
  return sequence[0] ?? getCurrentHourPeriod();
}

/** Six LLM pairs (2 hours each) along the submission timeline. */
export function buildHourPairsFromSubmission(session: SyncroSession): SyncroHourPair[] {
  return buildHourPairsFromSequence(getSubmissionHourSequence(session));
}

export function getFirstSubmissionBatchPair(session: SyncroSession): SyncroHourPair {
  const pairs = buildHourPairsFromSubmission(session);
  return pairs[0] ?? [getSubmissionAnchorPeriod(session), getSubmissionAnchorPeriod(session)];
}

/** Wall-clock 时辰 in the user's session timezone. */
export function getRealtimeHourPeriodForSession(
  session: SyncroSession,
  date: Date = new Date(),
): HourPeriod {
  const tz = session.user_location?.timezone?.trim();
  if (tz) return getCurrentHourPeriodInTimezone(tz, date);
  return getCurrentHourPeriod(date);
}

export type SyncroCompassGateOptions = {
  /** Hours in the in-flight LLM request (prompt). OR gate while first batch is streaming. */
  activeLlmHours?: HourPeriod[];
};

/**
 * Compass entry:
 * - Primary: real-time hour (user TZ) has LLM copy.
 * - OR: every hour named in the current LLM prompt is ready (first-batch wait).
 */
export function isSyncroCompassGateReady(
  session: SyncroSession,
  options?: SyncroCompassGateOptions,
): boolean {
  const realtime = getRealtimeHourPeriodForSession(session);
  if (isHourPeriodLlmReady(session.matrix, realtime, session.llm_meta)) {
    return true;
  }

  const active = options?.activeLlmHours;
  if (!active?.length) return false;
  return active.every((h) =>
    isHourPeriodLlmReady(session.matrix, h, session.llm_meta),
  );
}
