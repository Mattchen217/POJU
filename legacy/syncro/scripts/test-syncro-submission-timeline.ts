/**
 * Submission timeline — live slot follows hour_start/hour_end, not wall-clock rotation.
 */
import assert from "node:assert/strict";

import {
  computeSyncroSessionExpiresAt,
  getLivePeriodInSubmissionTimeline,
  getSubmissionTimelineBounds,
  getSubmissionTimelineState,
  isSubmissionTimelineComplete,
} from "@/lib/syncro/syncro-submission-timeline";
import type { HourPeriod, SyncroMatrix, SyncroSession } from "@/lib/syncro/types";

function makeSession(start: Date, periods: HourPeriod[]): SyncroSession {
  const matrix: SyncroMatrix = {};
  let cursor = start.getTime();

  for (const period of periods) {
    const hour_start_iso = new Date(cursor).toISOString();
    const hour_end_iso = new Date(cursor + 2 * 60 * 60 * 1000).toISOString();
    for (const dir of ["N", "E"] as const) {
      matrix[`${period}__${dir}`] = {
        hour_period: period,
        direction_id: dir,
        hour_start_iso,
        hour_end_iso,
        current_level: "stillwater",
        short_advice: "ok",
        detailed_advice: "",
        rationale: "",
        llm_pending: false,
        llm_failed: false,
      };
    }
    cursor += 2 * 60 * 60 * 1000;
  }

  const expires_at = computeSyncroSessionExpiresAt(matrix, start);

  return {
    session_id: "test",
    device_id: "dev",
    profile_id: "p",
    task_description: "task",
    user_location: { latitude: 0, longitude: 0, timezone: "Asia/Shanghai" },
    created_at: start,
    expires_at,
    matrix,
    locale: "zh",
    is_free: true,
    cost_usd: 0,
    llm_meta: { model: "x", tokens_used: 0, latency_ms: 0 },
  };
}

const sequence: HourPeriod[] = [
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
  "zi",
];

const submissionStart = new Date("2026-05-26T01:30:00.000Z");
const session = makeSession(submissionStart, sequence);

assert.deepEqual(
  getSubmissionTimelineState(session, new Date("2026-05-26T01:45:00.000Z")).livePeriod,
  "chou",
  "first slot active at +15min",
);

assert.deepEqual(
  getLivePeriodInSubmissionTimeline(session, new Date("2026-05-26T07:30:00.000Z")),
  "chen",
  "fourth slot active after 6 wall hours",
);

assert.equal(
  getSubmissionTimelineState(session, new Date("2026-05-26T07:30:00.000Z")).liveIndex,
  3,
  "live index is 3 after 6 hours",
);

assert.equal(
  isSubmissionTimelineComplete(session, new Date("2026-05-27T01:31:00.000Z")),
  true,
  "timeline complete after last slot ends",
);

assert.equal(
  getLivePeriodInSubmissionTimeline(session, new Date("2026-05-27T01:31:00.000Z")),
  null,
  "no live period after timeline ends",
);

const bounds = getSubmissionTimelineBounds(session);
assert.ok(bounds && bounds.endMs === session.expires_at.getTime(), "expires_at matches last slot end");

console.log("test-syncro-submission-timeline: ok");
