/**
 * Verify Match v5.1 matrix uses real UserProfile pillars (UI path).
 * Run: pnpm test:match-ui-parse
 */

import { calculateProfile } from "@/lib/calculations";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import { parseProfileForMatrix, wrapProfileForMatrix } from "@/lib/match/parse-profile-for-matrix";
import type { BirthInfo } from "@/lib/profile/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const birthA: BirthInfo = {
  year: 1985,
  month: 12,
  day: 15,
  hour_period: "yin",
  gender: "M",
  timezone: "Asia/Shanghai",
};

const birthB: BirthInfo = {
  year: 1988,
  month: 2,
  day: 22,
  hour_period: "wei",
  gender: "F",
  timezone: "Asia/Shanghai",
};

async function main() {
  const profileA = await calculateProfile(birthA);
  const profileB = await calculateProfile(birthB);

  const parsedA = parseProfileForMatrix(wrapProfileForMatrix(profileA, {}));
  const parsedB = parseProfileForMatrix(wrapProfileForMatrix(profileB, {}));

  assert(parsedA.stems.day.length === 1, "A day stem");
  assert(parsedB.stems.day.length === 1, "B day stem");
  assert(parsedA.stems.day !== "甲", "A should not fall back to 甲");
  assert(parsedB.stems.day !== "甲", "B should not fall back to 甲");

  const matrix = calculateCompatibilityMatrix({
    profileA: wrapProfileForMatrix(profileA, {
      命主基础: { 用神忌神: { 用神: "水" } },
      当前大运详解: { 干支: "辛亥" },
    }),
    profileB: wrapProfileForMatrix(profileB, {
      命主基础: { 用神忌神: { 用神: "木" } },
      当前大运详解: { 干支: "丁巳" },
    }),
  });

  console.log("A 日主:", parsedA.stems.day + parsedA.branches.day);
  console.log("B 日主:", parsedB.stems.day + parsedB.branches.day);
  console.log("Matrix type:", matrix.synergy_type, "index:", matrix.resonance_index);
  console.log("\nMatch UI profile parse — OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
