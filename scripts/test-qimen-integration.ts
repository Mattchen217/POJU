/**
 * Syncro Calculation Engine — Step 1 qimen integration smoke test.
 * Run: pnpm exec tsx scripts/test-qimen-integration.ts
 */

import { Lunar } from "lunar-typescript";
import { QimenUtil } from "../lib/qimen/QimenUtil";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Fixed time for reproducibility (local solar; matches Lunar.fromYmdHms)
const lunar = Lunar.fromYmdHms(2024, 5, 10, 14, 30, 0);
const qimenPan = QimenUtil.create(lunar);

assert(qimenPan != null, "qimen pan defined");
assert(/陽遁|陰遁/.test(qimenPan.遁), "遁 is 陽遁 or 陰遁");
assert(qimenPan.局數 >= 1 && qimenPan.局數 <= 9, "局數 in 1..9");
assert(qimenPan.九宮.length === 9, "九宮 has 9 cells");
assert(Boolean(qimenPan.值符星), "值符星 set");

for (const cell of qimenPan.九宮) {
  assert(Boolean(cell.宮位), "宮位 set");
  // 中五宮 is the hub; 八神/九星/八門 may be absent on that cell
  if (cell.宮位 === "中五宮") continue;
  assert(Boolean(cell.八神), `八神 on ${cell.宮位}`);
  assert(Boolean(cell.九星), `九星 on ${cell.宮位}`);
  assert(Boolean(cell.八門), `八門 on ${cell.宮位}`);
}

const nowLunar = Lunar.fromDate(new Date());
const nowPan = QimenUtil.create(nowLunar);
assert(nowPan.九宮.length === 9, "current time pan has 9 cells");

console.log("遁:", qimenPan.遁, "局數:", qimenPan.局數, "值符星:", qimenPan.值符星);
console.log("Sample cell [0]:", {
  宮位: qimenPan.九宮[0].宮位,
  八門: qimenPan.九宮[0].八門,
  九星: qimenPan.九宮[0].九星,
  八神: qimenPan.九宮[0].八神,
});
console.log("\nQimen Step 1 integration: all checks passed.");
