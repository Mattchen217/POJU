/**
 * Step 1.2 — Verify shunshi-bazi-core true solar time behavior
 * Run: pnpm tsx scripts/test-bazi-library.ts
 */
import { getBaziChart } from "shunshi-bazi-core";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo } from "@/lib/profile/types";

function hourPillar(chart: ReturnType<typeof getBaziChart>): string {
  return chart.八字?.柱位详细?.时柱?.干支 ?? chart.八字?.四柱?.split(" ")[3] ?? "?";
}

function shichen(chart: ReturnType<typeof getBaziChart>): string {
  return chart.真太阳时?.时辰 ?? "?";
}

function tstMeta(chart: ReturnType<typeof getBaziChart>) {
  return chart.真太阳时
    ? {
        clock: chart.真太阳时.钟表时间,
        solar: chart.真太阳时.真太阳时,
        correctionMin: chart.真太阳时.修正分钟,
        shichen: chart.真太阳时.时辰,
      }
    : null;
}

async function testBaziLibrary() {
  console.log("=== Test 1: Beijing time, no longitude ===");
  const beijingNoLoc = getBaziChart({
    year: 2024,
    month: 6,
    day: 15,
    hour: 12,
    minute: 0,
    gender: 1,
  });
  console.log("Beijing 12:00 (no location) →", {
    pillars: beijingNoLoc.八字.四柱,
    hourPillar: hourPillar(beijingNoLoc),
    shichen: shichen(beijingNoLoc),
    tst: tstMeta(beijingNoLoc),
  });

  console.log("\n=== Test 2: Same time at Urumqi (87.6°E) with correct longitude ===");
  const urumqiCorrect = getBaziChart({
    year: 2024,
    month: 6,
    day: 15,
    hour: 12,
    minute: 0,
    gender: 1,
    longitude: 87.6,
    latitude: 43.8,
    useTrueSolarTime: true,
    standardMeridian: 120, // China uses Beijing time (UTC+8 → 120°E)
  });
  console.log("Urumqi 12:00 Beijing time (87.6°E) →", {
    pillars: urumqiCorrect.八字.四柱,
    hourPillar: hourPillar(urumqiCorrect),
    shichen: shichen(urumqiCorrect),
    tst: tstMeta(urumqiCorrect),
  });

  console.log("\n=== Test 3: Beijing with correct longitude (116.4°E) ===");
  const beijingCorrect = getBaziChart({
    year: 2024,
    month: 6,
    day: 15,
    hour: 12,
    minute: 0,
    gender: 1,
    longitude: 116.4,
    latitude: 39.9,
    useTrueSolarTime: true,
    standardMeridian: 120,
  });
  console.log("Beijing 12:00 (116.4°E) →", {
    pillars: beijingCorrect.八字.四柱,
    hourPillar: hourPillar(beijingCorrect),
    shichen: shichen(beijingCorrect),
    tst: tstMeta(beijingCorrect),
  });

  console.log("\n=== Test 4: Difference? (library-level) ===");
  const hourDiff =
    hourPillar(beijingCorrect) !== hourPillar(urumqiCorrect)
      ? "DIFFERENT ✓ (true solar time works)"
      : "SAME ✗ (unexpected)";
  console.log(`Beijing vs Urumqi hour pillar: ${hourDiff}`);
  console.log(`  Beijing:  ${hourPillar(beijingCorrect)} (${shichen(beijingCorrect)})`);
  console.log(`  Urumqi:   ${hourPillar(urumqiCorrect)} (${shichen(urumqiCorrect)})`);

  console.log("\n=== Test 5: CURRENT pojulife behavior (defaults, timezone center) ===");
  const urumqiBirth: BirthInfo = {
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
  };
  const currentParams = shunshiParamsFromBirthInfo(urumqiBirth);
  console.log("Default params for Urumqi user (no birth_location):", currentParams);

  const currentChart = getBaziChart({
    year: currentParams.year,
    month: currentParams.month,
    day: currentParams.day,
    hour: currentParams.hour,
    minute: currentParams.minute,
    gender: currentParams.gender,
    city: currentParams.city,
    latitude: currentParams.latitude,
    longitude: currentParams.longitude,
    standardMeridian: currentParams.standardMeridian,
    useTrueSolarTime: true,
  });
  console.log("Default (timezone center 120°E) →", {
    pillars: currentChart.八字.四柱,
    hourPillar: hourPillar(currentChart),
    shichen: shichen(currentChart),
    tst: tstMeta(currentChart),
  });

  console.log("\n=== Test 6: With explicit Urumqi birth_location ===");
  const urumqiBirthFixed: BirthInfo = {
    ...urumqiBirth,
    birth_location: {
      name: "Urumqi",
      longitude: 87.6,
      latitude: 43.8,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  };
  const fixedParams = shunshiParamsFromBirthInfo(urumqiBirthFixed);
  const fixedChart = getBaziChart({
    year: fixedParams.year,
    month: fixedParams.month,
    day: fixedParams.day,
    hour: fixedParams.hour,
    minute: fixedParams.minute,
    gender: fixedParams.gender,
    longitude: fixedParams.longitude,
    latitude: fixedParams.latitude,
    standardMeridian: fixedParams.standardMeridian,
    useTrueSolarTime: true,
  });
  console.log("Fixed Urumqi user →", {
    pillars: fixedChart.八字.四柱,
    hourPillar: hourPillar(fixedChart),
    shichen: shichen(fixedChart),
    tst: tstMeta(fixedChart),
  });
  console.log(
    hourPillar(fixedChart) === hourPillar(urumqiCorrect)
      ? "✓ Urumqi birth_location gives correct 巳时"
      : "✗ Still wrong",
  );
}

testBaziLibrary().catch((err) => {
  console.error(err);
  process.exit(1);
});
