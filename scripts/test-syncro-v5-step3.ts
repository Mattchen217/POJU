/**
 * Syncro v5 Step 3 — compassToDirection smoke tests.
 * Run: pnpm exec tsx scripts/test-syncro-v5-step3.ts
 */

import {
  CURRENT_LEVELS,
  DIRECTIONS,
  compassToDirection,
  getCurrentLevelInfo,
} from "../lib/syncro/current-system";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(Object.keys(CURRENT_LEVELS).length === 5, "expected 5 Current levels");
assert(Object.keys(DIRECTIONS).length === 8, "expected 8 directions");

assert(getCurrentLevelInfo("open_current").score === 5, "open_current score");
assert(getCurrentLevelInfo("undertow").score === 1, "undertow score");

const cases: Array<[number, DirectionId, DirectionId?]> = [
  [0, "N"],
  [45, "NE"],
  [67, "NE", "E"],
  [360, "N"],
  // -30° → 330° (30° west of north) → NW sector
  [-30, "NW"],
];

type DirectionId = import("../lib/syncro/current-system").DirectionId;

for (const [deg, wantPrimary, wantSecondary] of cases) {
  const r = compassToDirection(deg);
  assert(
    r.primary === wantPrimary,
    `deg ${deg}: primary ${r.primary} !== ${wantPrimary}`,
  );
  if (wantSecondary) {
    assert(
      r.secondary === wantSecondary,
      `deg ${deg}: secondary ${r.secondary} !== ${wantSecondary}`,
    );
  }
}

console.log("compassToDirection(0):", compassToDirection(0));
console.log("compassToDirection(45):", compassToDirection(45));
console.log("compassToDirection(67):", compassToDirection(67));
console.log("compassToDirection(360):", compassToDirection(360));
console.log("compassToDirection(-30):", compassToDirection(-30));
console.log("\nSyncro v5 Step 3: all checks passed.");
