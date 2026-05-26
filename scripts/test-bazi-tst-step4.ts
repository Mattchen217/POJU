/**
 * POJU/Match/Glyph True Solar Time — Step 4 API + stored_profiles tests.
 * Run: pnpm test:bazi-tst-step4
 */
import { calculateProfile } from "@/lib/calculations";
import {
  birthInfoToStoredRecord,
  parseRegenerateChartBody,
} from "@/lib/profile/stored-birth-info";
import { normalizeBirthInfoInput } from "@/lib/profile/normalize-birth-input";
import { parseUserProfileForApi } from "@/lib/profile/user-profile-api";
import { readFileSync } from "fs";
import { join } from "path";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const root = join(process.cwd());

  // API body parsing — Urumqi
  const urumqiBody = parseRegenerateChartBody({
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    timezone: "Asia/Shanghai",
    longitude: 87.6,
    latitude: 43.8,
    location_name: "Urumqi",
    use_defaults: false,
  });
  assert(!("error" in urumqiBody), "Urumqi body parses");
  if ("birth" in urumqiBody) {
    const p = await calculateProfile(urumqiBody.birth);
    assert(p.bazi.hourPillar === "辛巳", `Urumqi hour ${p.bazi.hourPillar}`);
    assert(p.tst_meta?.computation_version === "v2_with_tst", "v2_with_tst");
  }

  // use_defaults
  const defaultsBody = parseRegenerateChartBody({
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    use_defaults: true,
    user_timezone: "Asia/Shanghai",
  });
  assert(!("error" in defaultsBody), "defaults body parses");
  if ("birth" in defaultsBody) {
    assert(defaultsBody.birth.birth_location?.use_defaults === true, "use_defaults flag");
  }

  // invalid location
  const invalid = parseRegenerateChartBody({
    year: 2024,
    month: 6,
    day: 15,
    hour_period: "wu",
    gender: "M",
    use_defaults: false,
  });
  assert("error" in invalid && invalid.error === "invalid_location", "invalid_location");

  // stored record shape
  const stored = birthInfoToStoredRecord({
    year: 2024,
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
    tst_meta: {
      original_date: "2024-06-15",
      original_time: "12:00",
      true_solar_date: "2024-06-15",
      true_solar_time: "11:45",
      diff_minutes: -14.8,
      longitude: 116.4,
      timezone: "Asia/Shanghai",
      computation_version: "v2_with_tst",
    },
  });
  assert(stored.birth_location?.name === "Beijing", "stored birth_location");
  assert(stored.tst_meta?.computation_version === "v2_with_tst", "stored tst_meta");

  // API user_profile round-trip
  const profile = await calculateProfile(
    normalizeBirthInfoInput({
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
    }),
  );
  const roundTrip = parseUserProfileForApi(profile);
  assert(roundTrip?.used_true_solar_time === true, "API profile used_true_solar_time");
  assert(roundTrip?.tst_meta?.longitude === 87.6, "API profile tst_meta");

  // Route files exist
  const calcRoute = readFileSync(join(root, "app/api/profile/calculate/route.ts"), "utf8");
  const regenRoute = readFileSync(join(root, "app/api/profile/regenerate-chart/route.ts"), "utf8");
  const storedSvc = readFileSync(join(root, "lib/profile/stored-profiles-service.ts"), "utf8");
  assert(calcRoute.includes("invalid_location"), "calculate route validates location");
  assert(regenRoute.includes("parseRegenerateChartBody"), "regenerate-chart route");
  assert(storedSvc.includes("upgradeStoredProfileLocation"), "upgrade helper");
  assert(storedSvc.includes("used_true_solar_time"), "saveBaseAnalysis TST flag");

  console.log("✅ Bazi TST Step 4 — API + stored_profiles OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
