/**
 * Syncro Calculation Engine — Step 4 unit tests (calculate-score).
 * Run: pnpm test:syncro-step4
 */

import {
  calculateCombinationScore,
  scoreToCurrentLevel,
} from "../lib/syncro/calculate-score";
import { extractTaskKeywords } from "../lib/syncro/task-keyword-extractor";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const fixedTime = new Date("2024-05-10T14:30:00");

const taskKeywords = extractTaskKeywords("I have a job interview tomorrow");
const factors = calculateCombinationScore({
  yongShenWuXing: "木",
  dayMasterWuXing: "木",
  hourPeriod: "wei",
  direction: "E",
  combinationTime: fixedTime,
  taskKeywords,
});

assert(typeof factors.total_score === "number", "total_score is number");
assert(typeof factors.qimen_signals.subtotal === "number", "qimen subtotal");
assert(typeof factors.yong_shen_direction.subtotal === "number", "yong_shen subtotal");

const creationKw = extractTaskKeywords("需要灵感写代码");
const eastFactors = calculateCombinationScore({
  yongShenWuXing: "木",
  dayMasterWuXing: "木",
  hourPeriod: "wei",
  direction: "E",
  combinationTime: fixedTime,
  taskKeywords: creationKw,
});
const westFactors = calculateCombinationScore({
  yongShenWuXing: "木",
  dayMasterWuXing: "木",
  hourPeriod: "wei",
  direction: "W",
  combinationTime: fixedTime,
  taskKeywords: creationKw,
});

assert(
  eastFactors.yong_shen_direction.subtotal > westFactors.yong_shen_direction.subtotal,
  "wood yong_shen: E (木) beats W (金克木)"
);
assertEq(eastFactors.yong_shen_direction.relation, "same", "E same element as 木");
assertEq(westFactors.yong_shen_direction.relation, "keOther", "W keOther for 木");

assertEq(scoreToCurrentLevel(50), "open_current", "level 50");
assertEq(scoreToCurrentLevel(15), "following_current", "level 15");
assertEq(scoreToCurrentLevel(0), "stillwater", "level 0");
assertEq(scoreToCurrentLevel(-15), "crosscurrent", "level -15");
assertEq(scoreToCurrentLevel(-40), "undertow", "level -40");

const level = scoreToCurrentLevel(factors.total_score);
assert(
  ["open_current", "following_current", "stillwater", "crosscurrent", "undertow"].includes(
    level
  ),
  "valid current level"
);

console.log("Sample combination E @ fixedTime:");
console.log("  total_score:", factors.total_score, "→", level);
console.log("  qimen subtotal:", factors.qimen_signals.subtotal);
console.log("  yong_shen E vs W:", eastFactors.yong_shen_direction.subtotal, "vs", westFactors.yong_shen_direction.subtotal);
console.log("\nSyncro Step 4 (calculate-score): all checks passed.");
