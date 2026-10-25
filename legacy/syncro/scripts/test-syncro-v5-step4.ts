/**
 * Syncro v5 Step 4 — hour-period helpers smoke tests.
 * Run: pnpm exec tsx scripts/test-syncro-v5-step4.ts
 */

import {
  HOUR_PERIODS,
  getCurrentHourPeriod,
  matrixKey,
  secondsToNextHourPeriod,
} from "../lib/syncro/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(Object.keys(HOUR_PERIODS).length === 12, "12 hour periods");

assert(matrixKey("mao", "SE") === "mao__SE", "matrixKey");

const noon = new Date("2026-05-18T12:30:00");
assert(getCurrentHourPeriod(noon) === "wu", "noon → wu");

const secs = secondsToNextHourPeriod(noon);
assert(secs > 0 && secs <= 2 * 3600, "secondsToNextHourPeriod in 2h window");

console.log("getCurrentHourPeriod(noon):", getCurrentHourPeriod(noon));
console.log("secondsToNextHourPeriod(noon):", secs, "s");
console.log("matrixKey(mao, SE):", matrixKey("mao", "SE"));
console.log("\nSyncro v5 Step 4: type/helper checks passed.");
