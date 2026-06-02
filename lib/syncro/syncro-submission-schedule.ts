import { isHourPeriodLlmReady } from "@/lib/syncro/hour-llm-ready";
import {
  buildHourPairsFromSequence,
  type SyncroHourPair,
} from "@/lib/syncro/syncro-hour-pairs";
import {
  getLivePeriodInSubmissionTimeline,
  isSubmissionTimelineComplete,
} from "@/lib/syncro/syncro-submission-timeline";
import { getOrderedHourPeriodsFromSession } from "@/lib/syncro/syncro-view-helpers";
import {
  getCurrentHourPeriod,
  getCurrentHourPeriodInTimezone,
  type HourPeriod,
  type SyncroSession,
} from "@/lib/syncro/types";

export {
  computeSyncroSessionExpiresAt,
  getLivePeriodInSubmissionTimeline,
  getPeriodTimeRange,
  getSubmissionTimelineBounds,
  getSubmissionTimelineState,
  isSubmissionTimelineComplete,
  type SubmissionTimelineState,
} from "@/lib/syncro/syncro-submission-timeline";

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

/** Compass entry: current submission slot has full LLM copy. */
export function isSyncroCompassGateReady(session: SyncroSession): boolean {
  if (isSubmissionTimelineComplete(session)) return false;
  const live = getLivePeriodInSubmissionTimeline(session);
  if (!live) return false;
  return isHourPeriodLlmReady(session.matrix, live, session.llm_meta);
}
