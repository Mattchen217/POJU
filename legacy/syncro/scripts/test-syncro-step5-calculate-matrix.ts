/**
 * Syncro Calculation Engine — Step 5 matrix tests.
 * Run: pnpm test:syncro-step5
 */

import { calculateSyncroMatrix } from "../lib/syncro/calculate-matrix";

const LEVELS =
  /^open_current|following_current|stillwater|crosscurrent|undertow$/;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const mockProfile = {
  base_analysis: {
    content: {
      bazi: { day_master: "乙" },
      yong_shen: { primary_element: "水" },
    },
  },
};

const baseInput = {
  profile: mockProfile,
  taskDescription: "Tomorrow I need to make an important business decision",
  startTime: new Date("2024-05-10T10:00:00Z"),
  userTimezone: "UTC",
  userLongitude: 0,
  userLatitude: 51.5,
};

const { matrix } = calculateSyncroMatrix(baseInput);

assert(Object.keys(matrix).length === 96, "96 combinations");

for (const key of Object.keys(matrix)) {
  const cell = matrix[key];
  assert(LEVELS.test(cell.current_level), `${key} level`);
  assert(typeof cell._internal.total_score === "number", `${key} score`);
  assert(cell._internal.key_factors.length === 3, `${key} key_factors`);
  assert(key === `${cell.hour_period}__${cell.direction_id}`, `${key} format`);
}

const mockProfile2 = {
  base_analysis: {
    content: {
      bazi: { day_master: "丙" },
      yong_shen: { primary_element: "木" },
    },
  },
};

const detInput = {
  profile: mockProfile2,
  taskDescription: "Looking for new job opportunities",
  startTime: new Date("2024-05-10T10:00:00Z"),
  userTimezone: "UTC",
  userLongitude: 0,
  userLatitude: 51.5,
};

const { matrix: matrix1 } = calculateSyncroMatrix(detInput);
const { matrix: matrix2 } = calculateSyncroMatrix(detInput);

for (const key of Object.keys(matrix1)) {
  assert(
    matrix1[key].current_level === matrix2[key].current_level,
    `deterministic level ${key}`
  );
  assert(
    matrix1[key]._internal.total_score === matrix2[key]._internal.total_score,
    `deterministic score ${key}`
  );
}

const { matrix: loveMatrix } = calculateSyncroMatrix({
  profile: {
    base_analysis: {
      content: {
        bazi: { day_master: "甲" },
        yong_shen: { primary_element: "水" },
      },
    },
  },
  taskDescription: "I want to find love",
  startTime: new Date("2024-05-10T10:00:00Z"),
  userTimezone: "UTC",
  userLongitude: 0,
  userLatitude: 51.5,
});

const distribution = {
  open_current: 0,
  following_current: 0,
  stillwater: 0,
  crosscurrent: 0,
  undertow: 0,
};

for (const key of Object.keys(loveMatrix)) {
  distribution[loveMatrix[key].current_level]++;
}

console.log("Distribution (love task, water yong_shen):", distribution);

assert(distribution.stillwater < 80, "not mostly stillwater");
assert(
  distribution.open_current + distribution.following_current > 5,
  "some favorable levels"
);

const sample = matrix["si__E"];
assert(sample._internal.qimen_data.door !== "", "qimen door populated");

console.log("Sample si__E:", {
  level: sample.current_level,
  score: sample._internal.total_score,
  qimen: sample._internal.qimen_data,
  factors: sample._internal.key_factors,
});

console.log("\nSyncro Step 5 (calculate-matrix): all checks passed.");
