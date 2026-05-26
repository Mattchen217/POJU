/**
 * Syncro Calculation Engine — Step 2 smoke test.
 * Run: pnpm exec tsx scripts/test-syncro-qimen-direction-map.ts
 */

import { Lunar } from "lunar-typescript";
import { QimenUtil } from "../lib/qimen/QimenUtil";
import { 宮位飛星序 } from "../lib/qimen/dictionary";
import { DIRECTIONS, type DirectionId } from "../lib/syncro/current-system";
import {
  DIRECTION_TO_QIMEN_PALACE,
  EIGHT_DOORS_NATURE,
  EIGHT_GODS_NATURE,
  NINE_STARS_NATURE,
  SAN_QI_LIU_YI_BONUS,
} from "../lib/syncro/qimen-direction-map";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const directionIds = Object.keys(DIRECTIONS) as DirectionId[];
assert(directionIds.length === 8, "8 compass directions");

for (const id of directionIds) {
  const map = DIRECTION_TO_QIMEN_PALACE[id];
  assert(map.palace_index >= 0 && map.palace_index <= 8, `${id} index in range`);
  assert(map.palace_index !== 4, `${id} not center palace`);
  assert(
    宮位飛星序[map.palace_index] === map.palace_name,
    `${id} → ${map.palace_name} matches 飛星序`
  );
}

const lunar = Lunar.fromYmdHms(2024, 5, 10, 14, 30, 0);
const pan = QimenUtil.create(lunar);

for (const id of directionIds) {
  const { palace_index, palace_name } = DIRECTION_TO_QIMEN_PALACE[id];
  const cell = pan.九宮[palace_index];
  assert(cell.宮位 === palace_name, `${id} cell 宮位`);
  if (cell.八門) assert(cell.八門 in EIGHT_DOORS_NATURE, `door score: ${cell.八門}`);
  if (cell.九星) assert(cell.九星 in NINE_STARS_NATURE, `star score: ${cell.九星}`);
  if (cell.八神) assert(cell.八神 in EIGHT_GODS_NATURE, `god score: ${cell.八神}`);
  for (const stem of cell.天盤干) {
    assert(stem in SAN_QI_LIU_YI_BONUS, `stem bonus: ${stem}`);
  }
}

assert(Object.keys(EIGHT_DOORS_NATURE).length === 8, "8 doors");
assert(Object.keys(NINE_STARS_NATURE).length === 9, "9 stars");

console.log("Direction → palace (sample pan):");
for (const id of directionIds) {
  const m = DIRECTION_TO_QIMEN_PALACE[id];
  const cell = pan.九宮[m.palace_index];
  console.log(
    `  ${id}: ${m.palace_name} (${m.element}) — 八門 ${cell.八門 ?? "-"} 九星 ${cell.九星 ?? "-"}`
  );
}

console.log("\nSyncro Step 2 qimen-direction-map: all checks passed.");
