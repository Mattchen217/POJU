/**
 * Legacy matrix timestamps (UTC server bug) still resolve NOW via wall clock + elapsed.
 */
import assert from "node:assert/strict";

import { getLivePeriodInSubmissionTimeline } from "@/lib/syncro/syncro-submission-timeline";
import type { HourPeriod, SyncroMatrix, SyncroSession } from "@/lib/syncro/types";

function makeBrokenLegacySession(): SyncroSession {
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
  const created = new Date("2026-06-02T17:42:00.000Z"); // 2026-06-03 01:42 +08
  const matrix: SyncroMatrix = {};

  // Simulates Vercel UTC bug: 丑时 stored as 01:00–03:00 UTC (= 09:00–11:00 Shanghai)
  let cursor = Date.parse("2026-06-02T01:00:00.000Z");
  for (const period of sequence) {
    const hour_start_iso = new Date(cursor).toISOString();
    const hour_end_iso = new Date(cursor + 2 * 60 * 60 * 1000).toISOString();
    matrix[`${period}__N`] = {
      hour_period: period,
      direction_id: "N",
      hour_start_iso,
      hour_end_iso,
      current_level: "stillwater",
      short_advice: "x",
      detailed_advice: "",
      rationale: "",
      llm_pending: false,
      llm_failed: false,
    };
    cursor += 2 * 60 * 60 * 1000;
  }

  return {
    session_id: "legacy",
    device_id: "d",
    profile_id: "p",
    task_description: "t",
    user_location: { latitude: 31.2, longitude: 121.5, timezone: "Asia/Shanghai" },
    created_at: created,
    expires_at: new Date(created.getTime() + 24 * 60 * 60 * 1000),
    matrix,
    locale: "zh",
    is_free: true,
    cost_usd: 0,
    llm_meta: { model: "x", tokens_used: 0, latency_ms: 0 },
  };
}

const session = makeBrokenLegacySession();
const at933 = new Date("2026-06-03T01:33:00.000Z"); // 09:33 Shanghai
assert.equal(
  getLivePeriodInSubmissionTimeline(session, at933),
  "si",
  "legacy session at 09:33 Shanghai → si, not stuck on chou",
);

console.log("test-syncro-legacy-timeline-now: ok");
