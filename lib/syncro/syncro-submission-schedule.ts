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

/** Wall-clock 时辰 in the user's session timezone. */
export function getRealtimeHourPeriodForSession(
  session: SyncroSession,
  date: Date = new Date(),
): HourPeriod {
  const tz = session.user_location?.timezone?.trim();
  if (tz) return getCurrentHourPeriodInTimezone(tz, date);
  return getCurrentHourPeriod(date);
}

/** Compass entry: real-time hour (user TZ) has full LLM copy. */
export function isSyncroCompassGateReady(session: SyncroSession): boolean {
  const realtime = getRealtimeHourPeriodForSession(session);
  return isHourPeriodLlmReady(session.matrix, realtime, session.llm_meta);
}
