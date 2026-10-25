/**
 * Syncro True Solar Time — Step 4 integration tests.
 * Run: pnpm test:syncro-tst-step4
 */
import { buildSyncroPrompt } from "../lib/llm/prompts/syncro-deepseek-prompt";
import {
  calculateSyncroMatrix,
  generateNext12HourPeriods,
} from "../lib/syncro/calculate-matrix";
import { calculateTrueSolarTime } from "../lib/syncro/true-solar-time";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const mockProfile = {
  base_analysis: {
    content: {
      bazi: { day_master: "甲" },
      yong_shen: { primary_element: "水" },
    },
  },
};

const civilNoon = new Date("2024-06-15T12:00:00+08:00");
const shared = {
  profile: mockProfile,
  taskDescription: "下午要去见客户谈合作",
  startTime: civilNoon,
  userTimezone: "Asia/Shanghai",
};

function main() {
  const beijing = calculateSyncroMatrix({
    ...shared,
    userLongitude: 116.4,
    userLatitude: 39.9,
  });
  const urumqi = calculateSyncroMatrix({
    ...shared,
    userLongitude: 87.6,
    userLatitude: 43.8,
  });

  assert(Object.keys(beijing.matrix).length === 96, "Beijing 96 cells");
  assert(beijing.metadata.trueSolarTime !== urumqi.metadata.trueSolarTime, "TST ISO differs");

  const bPeriods = generateNext12HourPeriods(
    new Date(beijing.metadata.trueSolarTime),
    "Asia/Shanghai",
  );
  const uPeriods = generateNext12HourPeriods(
    new Date(urumqi.metadata.trueSolarTime),
    "Asia/Shanghai",
  );

  const periodDiff =
    bPeriods[0].id !== uPeriods[0].id ||
    bPeriods[0].start.getTime() !== uPeriods[0].start.getTime();
  assert(periodDiff, "Beijing vs Urumqi first hour-period window differs");

  assert(
    Math.abs(beijing.metadata.longitudeDiffMinutes - urumqi.metadata.longitudeDiffMinutes) > 100,
    "longitude correction differs by city",
  );
  assert(beijing.metadata.diffMinutes < -10, "Beijing TST behind civil");
  assert(urumqi.metadata.diffMinutes < -120, "Urumqi TST ~2h behind civil");

  const { system } = buildSyncroPrompt({
    profile: null,
    base_analysis: mockProfile.base_analysis.content,
    task_description: shared.taskDescription,
    user_location: { latitude: 39.9, longitude: 116.4, timezone: "Asia/Shanghai" },
    locale: "zh",
    matrix: beijing.matrix,
    true_solar: beijing.metadata,
  });
  assert(system.includes("真太阳时"), "prompt has true solar section");
  assert(system.includes(beijing.metadata.trueSolarTime), "prompt lists TST ISO");

  const tst = calculateTrueSolarTime({
    localTime: civilNoon,
    longitude: 87.6,
    timezone: "Asia/Shanghai",
  });
  assert(tst.diffMinutes < -120, "Urumqi raw TST correction");

  console.log("Beijing metadata:", beijing.metadata);
  console.log("Urumqi metadata:", urumqi.metadata);
  console.log("First periods:", bPeriods[0].id, "vs", uPeriods[0].id);
  console.log("\n✅ Syncro TST Step 4 — matrix + prompt + TST integration OK");
}

main();
