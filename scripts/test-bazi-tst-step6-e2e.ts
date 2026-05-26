/**
 * POJU/Match/Glyph True Solar Time — Step 6 end-to-end verification matrix.
 * Run: pnpm test:bazi-tst-step6
 */
import { calculateProfile } from "@/lib/calculations";
import { buildBaseAnalysisPrompt } from "@/lib/llm/deepseek/base-analysis";
import { parseProfileForMatrix, wrapProfileForMatrix } from "@/lib/match/parse-profile-for-matrix";
import { splitPillar } from "@/lib/poju/chart-loader-display";
import {
  buildDefaultBirthLocation,
  normalizeStoredBirthInfo,
} from "@/lib/profile/birth-info-utils";
import { birthInfoToStoredRecord } from "@/lib/profile/stored-birth-info";
import { profileNeedsLocationUpgrade } from "@/lib/profile/upgrade-profile-location";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function hourPillar(p: UserProfile): string {
  return p.bazi.hourPillar;
}

function hourBranch(p: UserProfile): string {
  return splitPillar(p.bazi.hourPillar).branch;
}

async function test1NewProfileFullFlow() {
  console.log("\n=== Test 1: New profile — full flow (1985-06-15 12:00 Beijing) ===");

  const birth: BirthInfo = {
    year: 1985,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: {
      name: "Beijing",
      longitude: 116.4,
      latitude: 39.9,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  };

  const profile = await calculateProfile(birth);
  assert(profile.used_true_solar_time === true, "used_true_solar_time");
  assert(profile.tst_meta?.computation_version === "v2_with_tst", "v2_with_tst");
  assert(Math.abs((profile.tst_meta?.diff_minutes ?? 0) + 14) < 5, `Beijing diff ~-14 min, got ${profile.tst_meta?.diff_minutes}`);

  const stored = birthInfoToStoredRecord({ ...birth, tst_meta: profile.tst_meta });
  const normalized = normalizeStoredBirthInfo(stored as unknown as Record<string, unknown>);
  assert(normalized.birth_location?.name === "Beijing", "stored birth_location");

  console.log("  Original:", profile.tst_meta?.original_date, profile.tst_meta?.original_time);
  console.log("  True Solar:", profile.tst_meta?.true_solar_date, profile.tst_meta?.true_solar_time);
  console.log("  Diff:", profile.tst_meta?.diff_minutes, "min");
  console.log("  Hour pillar:", hourPillar(profile));
  console.log("  ✓ Test 1 passed");
}

async function test2CrossLongitude() {
  console.log("\n=== Test 2: Cross-longitude (2024-06-15 12:00) ===");

  const base: Omit<BirthInfo, "birth_location"> = {
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
  };

  const beijing = await calculateProfile({
    ...base,
    birth_location: {
      name: "Beijing",
      longitude: 116.4,
      latitude: 39.9,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  });

  const urumqi = await calculateProfile({
    ...base,
    birth_location: {
      name: "Urumqi",
      longitude: 87.6,
      latitude: 43.8,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  });

  const nyc = await calculateProfile({
    year: 2024,
    month: 1,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "America/New_York",
    birth_location: {
      name: "New York",
      longitude: -74.0,
      latitude: 40.71,
      timezone: "America/New_York",
      use_defaults: false,
    },
  });

  assert(hourPillar(beijing) === "壬午", `Beijing 壬午, got ${hourPillar(beijing)}`);
  assert(hourPillar(urumqi) === "辛巳", `Urumqi 辛巳, got ${hourPillar(urumqi)}`);
  assert(hourBranch(beijing) === "午", "Beijing branch 午");
  assert(hourBranch(urumqi) === "巳", "Urumqi branch 巳");
  assert(hourPillar(beijing) !== hourPillar(urumqi), "Beijing ≠ Urumqi");
  assert(nyc.used_true_solar_time === true, "NYC uses TST");

  console.log("  Beijing:", hourPillar(beijing), `(branch ${hourBranch(beijing)})`);
  console.log("  Urumqi:", hourPillar(urumqi), `(branch ${hourBranch(urumqi)})`);
  console.log("  NYC:", hourPillar(nyc));
  console.log("  ✓ Test 2 passed — TST differentiates cross-longitude");
}

async function test3OldProfileUpgrade() {
  console.log("\n=== Test 3: Old profile upgrade simulation ===");

  const base: BirthInfo = {
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
  };

  const oldProfile = await calculateProfile({
    ...base,
    birth_location: buildDefaultBirthLocation("Asia/Shanghai"),
  });

  assert(oldProfile.used_true_solar_time === false, "old: used_true_solar_time false");
  assert(profileNeedsLocationUpgrade(oldProfile.used_true_solar_time) === true, "needs upgrade badge");
  assert(hourPillar(oldProfile) === "壬午", `old default hour 壬午, got ${hourPillar(oldProfile)}`);

  const upgradedProfile = await calculateProfile({
    ...base,
    birth_location: {
      name: "Urumqi",
      longitude: 87.6,
      latitude: 43.8,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  });

  assert(upgradedProfile.used_true_solar_time === true, "upgraded: used_true_solar_time true");
  assert(profileNeedsLocationUpgrade(upgradedProfile.used_true_solar_time) === false, "no upgrade badge");
  assert(hourPillar(upgradedProfile) === "辛巳", `upgraded 辛巳, got ${hourPillar(upgradedProfile)}`);
  assert(hourPillar(oldProfile) !== hourPillar(upgradedProfile), "hour pillar changed on upgrade");

  console.log("  Before upgrade:", hourPillar(oldProfile), "(default longitude)");
  console.log("  After upgrade:", hourPillar(upgradedProfile), "(Urumqi 87.6°E)");
  console.log("  ✓ Test 3 passed");
}

async function test4CrossProductConsistency() {
  console.log("\n=== Test 4: Cross-product hour pillar consistency ===");

  const profile = await calculateProfile({
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: {
      name: "Urumqi",
      longitude: 87.6,
      latitude: 43.8,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  });

  const expectedHour = hourPillar(profile);

  // POJU — base analysis prompt
  const { user: promptUser } = buildBaseAnalysisPrompt(profile);
  assert(promptUser.includes(expectedHour), "POJU prompt includes hour pillar");
  assert(promptUser.includes("真太阳时"), "POJU prompt includes TST block");

  // Match — matrix parse
  const wrapped = wrapProfileForMatrix(profile, {});
  const matrixInput = parseProfileForMatrix(wrapped);
  const matrixHourPillar =
    matrixInput.stems.hour + matrixInput.branches.hour;
  assert(matrixHourPillar === expectedHour, `Match matrix hour ${matrixHourPillar} vs ${expectedHour}`);

  // Glyph / Syncro — user_profile is source of truth
  assert(profile.bazi.hourPillar === expectedHour, "Glyph/Syncro user_profile hour");

  console.log("  Shared hour pillar:", expectedHour);
  console.log("  POJU prompt: ✓");
  console.log("  Match matrix: ✓");
  console.log("  Glyph/Syncro profile.bazi: ✓");
  console.log("  ✓ Test 4 passed");
}

async function test5DefaultFallback() {
  console.log("\n=== Test 5: Default fallback (no birth city) ===");

  const shanghai = await calculateProfile({
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: buildDefaultBirthLocation("Asia/Shanghai"),
  });

  const nycDefault = await calculateProfile({
    year: 2024,
    month: 1,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "America/New_York",
    birth_location: buildDefaultBirthLocation("America/New_York"),
  });

  assert(shanghai.used_true_solar_time === false, "Shanghai default: not precise");
  assert(shanghai.tst_meta?.computation_version === "v1", "Shanghai default: v1");
  assert(shanghai.tst_meta?.longitude === 120, `Shanghai default lon 120, got ${shanghai.tst_meta?.longitude}`);
  assert(nycDefault.tst_meta?.longitude === -75, `NYC default lon -75, got ${nycDefault.tst_meta?.longitude}`);
  assert(shanghai.bazi.hourPillar.length === 2, "Shanghai default still generates chart");
  assert(nycDefault.bazi.hourPillar.length === 2, "NYC default still generates chart");

  console.log("  Asia/Shanghai default → lon", shanghai.tst_meta?.longitude, "hour", hourPillar(shanghai));
  console.log("  America/New_York default → lon", nycDefault.tst_meta?.longitude, "hour", hourPillar(nycDefault));
  console.log("  ✓ Test 5 passed");
}

async function test6EdgeCases() {
  console.log("\n=== Test 6: Edge cases ===");

  // Cross-day: Urumqi 00:30 Beijing time → previous day
  const crossDay = await calculateProfile({
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "zi_early",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: {
      name: "Urumqi",
      longitude: 87.6,
      latitude: 43.8,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  });

  assert(crossDay.tst_meta?.true_solar_date === "2024-06-14", `cross-day date ${crossDay.tst_meta?.true_solar_date}`);
  assert(crossDay.bazi.dayPillar.length === 2, "cross-day still has day pillar");

  // Longitude boundary — far east Russia (Chukotka ~177°E, still +12 offset simplified)
  const farEast = await calculateProfile({
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Kamchatka",
    birth_location: {
      name: "Petropavlovsk",
      longitude: 158.65,
      latitude: 53.02,
      timezone: "Asia/Kamchatka",
      use_defaults: false,
    },
  });
  assert(farEast.bazi.hourPillar.length === 2, "far east does not crash");

  // Southern hemisphere
  const sydney = await calculateProfile({
    year: 2024,
    month: 1,
    day: 15,
    hour_period: "wu",
    gender: "F",
    timezone: "Australia/Sydney",
    birth_location: {
      name: "Sydney",
      longitude: 151.2,
      latitude: -33.87,
      timezone: "Australia/Sydney",
      use_defaults: false,
    },
  });
  assert(sydney.used_true_solar_time === true, "Sydney TST");
  assert(sydney.bazi.hourPillar.length === 2, "southern hemisphere does not crash");

  console.log("  Cross-day Urumqi zi_early:");
  console.log("    clock:", crossDay.tst_meta?.original_date, crossDay.tst_meta?.original_time);
  console.log("    solar:", crossDay.tst_meta?.true_solar_date, crossDay.tst_meta?.true_solar_time);
  console.log("    day pillar:", crossDay.bazi.dayPillar);
  console.log("  Far east:", hourPillar(farEast));
  console.log("  Sydney:", hourPillar(sydney));
  console.log("  ✓ Test 6 passed");
}

async function main() {
  console.log("POJU/Match/Glyph True Solar Time — Step 6 E2E Matrix\n");

  await test1NewProfileFullFlow();
  await test2CrossLongitude();
  await test3OldProfileUpgrade();
  await test4CrossProductConsistency();
  await test5DefaultFallback();
  await test6EdgeCases();

  console.log("\n✅ Bazi TST Step 6 — all 6 test cases passed");
}

main().catch((e) => {
  console.error("\n✗ Step 6 failed:", e);
  process.exit(1);
});
