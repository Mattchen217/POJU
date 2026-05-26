/**
 * Syncro Calculation Engine — Step 3 unit tests (wuxing + task keywords).
 * Run: pnpm test:syncro-step3
 */

import {
  getWuXingRelation,
  scoreForYongShen,
  STEM_TO_WUXING,
  BRANCH_TO_WUXING,
  HOUR_PERIOD_TO_BRANCH,
} from "../lib/syncro/wuxing-utils";
import {
  extractTaskKeywords,
  TASK_TO_QIMEN_FAVORED_DOORS,
  TASK_TO_DIRECTION_BONUS,
} from "../lib/syncro/task-keyword-extractor";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// --- getWuXingRelation ---
assertEq(getWuXingRelation("木", "木"), "same", "木-木 same");
assertEq(getWuXingRelation("木", "火"), "shengSelf", "木生火");
assertEq(getWuXingRelation("火", "木"), "shengOther", "水生木 style (火<-木)");
assertEq(getWuXingRelation("木", "土"), "keSelf", "木克土");
assertEq(getWuXingRelation("木", "金"), "keOther", "金克木 (木被金克)");
assertEq(getWuXingRelation("水", "火"), "keSelf", "水克火");

assert(scoreForYongShen("shengOther") > scoreForYongShen("keOther"), "shengOther beats keOther");
assert(STEM_TO_WUXING["甲"] === "木", "stem 甲");
assert(BRANCH_TO_WUXING["子"] === "水", "branch 子");
assert(HOUR_PERIOD_TO_BRANCH.mao === "卯", "mao → 卯");
assert(Object.keys(HOUR_PERIOD_TO_BRANCH).length === 12, "12 hour periods");

// --- extractTaskKeywords ---
const enCareer = extractTaskKeywords("Tomorrow I have a job interview at 10 AM");
assertEq(enCareer.primary_type, "career", "English interview → career");
assert(
  enCareer.raw_keywords.some((k) => /interview|job/i.test(k)),
  "raw career keyword"
);

const zhWealth = extractTaskKeywords("明天要签合同谈一笔大生意");
assertEq(zhWealth.primary_type, "wealth", "中文 生意/合同 → wealth");

const zhCreation = extractTaskKeywords("需要灵感写代码");
assertEq(zhCreation.primary_type, "creation", "中文 写 → creation");

const empty = extractTaskKeywords("随便看看");
assertEq(empty.primary_type, "other", "no keywords → other");

assert(TASK_TO_QIMEN_FAVORED_DOORS.wealth.includes("生門"), "wealth favors 生門");
assert(TASK_TO_DIRECTION_BONUS.career.S === 5, "career S bonus");

console.log("enCareer:", enCareer);
console.log("zhWealth:", zhWealth);
console.log("zhCreation:", zhCreation);
console.log("\nSyncro Step 3 (wuxing + task keywords): all checks passed.");
