/**
 * generateNext12HourPeriods must use user IANA TZ, not server local clock.
 */
import assert from "node:assert/strict";

import { generateNext12HourPeriods } from "@/lib/syncro/calculate-matrix";
import { getLivePeriodInSubmissionTimeline } from "@/lib/syncro/syncro-submission-timeline";
import type { HourPeriod, SyncroMatrix, SyncroSession } from "@/lib/syncro/types";

const TZ = "Asia/Shanghai";
const submitLocal = new Date("2026-06-02T17:42:00.000Z"); // 2026-06-03 01:42 CST

const periods = generateNext12HourPeriods(submitLocal, TZ);
assert.equal(periods[0]?.id, "chou", "first slot is chou at 01:42 submit");
assert.equal(
  periods[0]?.start.toISOString(),
  "2026-06-02T17:00:00.000Z",
  "chou starts 01:00 Shanghai (17:00 UTC)",
);

const matrix: SyncroMatrix = {};
for (const p of periods) {
  matrix[`${p.id}__N`] = {
    hour_period: p.id,
    direction_id: "N",
    hour_start_iso: p.start.toISOString(),
    hour_end_iso: p.end.toISOString(),
    current_level: "stillwater",
    short_advice: "x",
    detailed_advice: "",
    rationale: "",
    llm_pending: false,
    llm_failed: false,
  };
}

const session: SyncroSession = {
  session_id: "tz-test",
  device_id: "d",
  profile_id: "p",
  task_description: "t",
  user_location: { latitude: 31.2, longitude: 121.5, timezone: TZ },
  created_at: submitLocal,
  expires_at: periods[11]!.end,
  matrix,
  locale: "zh",
  is_free: true,
  cost_usd: 0,
  llm_meta: { model: "x", tokens_used: 0, latency_ms: 0 },
};

const at933 = new Date("2026-06-03T01:33:00.000Z"); // 09:33 Shanghai
assert.equal(
  getLivePeriodInSubmissionTimeline(session, at933),
  "si" satisfies HourPeriod,
  "NOW at 09:33 Shanghai is si (5th slot), not chou",
);

console.log("test-syncro-timezone-periods: ok");
