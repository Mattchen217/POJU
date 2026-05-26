/**
 * POJU/Match/Glyph True Solar Time — Step 2 tests (Classification A fix).
 * Run: pnpm test:bazi-tst-step2
 */
import { calculateProfile } from "@/lib/calculations";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo } from "@/lib/profile/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function hourPillar(profile: Awaited<ReturnType<typeof calculateProfile>>): string {
  return profile.bazi.hourPillar;
}

async function main() {
  const base: Omit<BirthInfo, "birth_location"> = {
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
  };

  // Beijing — precise location
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
  assert(beijing.used_true_solar_time === true, "Beijing should use TST");
  assert(hourPillar(beijing) === "壬午", `Beijing hour pillar expected 壬午, got ${hourPillar(beijing)}`);
  assert(beijing.tst_meta?.computation_version === "v2_with_tst", "Beijing v2_with_tst");
  console.log("Beijing:", hourPillar(beijing), beijing.tst_meta);

  // Urumqi — same civil time, different longitude
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
  assert(hourPillar(urumqi) === "辛巳", `Urumqi hour pillar expected 辛巳, got ${hourPillar(urumqi)}`);
  assert(hourPillar(beijing) !== hourPillar(urumqi), "Beijing vs Urumqi must differ");
  assert((urumqi.tst_meta?.diff_minutes ?? 0) < -120, `Urumqi diff ~2h, got ${urumqi.tst_meta?.diff_minutes}`);
  console.log("Urumqi:", hourPillar(urumqi), urumqi.tst_meta);

  // New York
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
  assert(nyc.used_true_solar_time === true, "NYC should use TST");
  console.log("NYC:", hourPillar(nyc), nyc.tst_meta);

  // Defaults (timezone center) — marked v1, used_true_solar_time false
  const defaults = await calculateProfile({ ...base });
  assert(defaults.used_true_solar_time === false, "defaults → used_true_solar_time false");
  assert(defaults.tst_meta?.computation_version === "v1", "defaults → v1");
  const defaultParams = shunshiParamsFromBirthInfo({ ...base });
  assert(defaultParams.longitude === 120, `default longitude 120, got ${defaultParams.longitude}`);
  console.log("Defaults:", hourPillar(defaults), defaults.tst_meta);

  // Cross-day: Urumqi 00:30 Beijing time → previous day true solar
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
  assert(
    crossDay.tst_meta?.true_solar_date === "2024-06-14",
    `Cross-day expected 2024-06-14, got ${crossDay.tst_meta?.true_solar_date}`,
  );
  console.log("Cross-day Urumqi zi_early:", crossDay.bazi.dayPillar, crossDay.tst_meta);

  console.log("\n✅ Bazi TST Step 2 — classification A fix OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
