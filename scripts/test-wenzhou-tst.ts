/**
 * Wenzhou 1977-02-17 07:58 — true solar time must stay within ±20 min correction.
 * Run: pnpm tsx scripts/test-wenzhou-tst.ts
 */
import { getBaziChart } from "shunshi-bazi-core";

import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo } from "@/lib/profile/types";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

const wenzhouBirth: BirthInfo = {
  year: 1977,
  month: 2,
  day: 17,
  hour_period: "chen",
  hour: 7,
  minute: 58,
  gender: "M",
  timezone: "America/Chicago",
  birth_location: {
    name: "Wenzhou, Zhejiang, China",
    longitude: 120.7,
    latitude: 28.0,
    timezone: "America/Chicago",
    use_defaults: false,
  },
};

const params = shunshiParamsFromBirthInfo(wenzhouBirth);
assert(params.standardMeridian === 120, `standardMeridian=120 (got ${params.standardMeridian})`);
assert(params.hour === 7 && params.minute === 58, `clock 07:58 (got ${params.hour}:${params.minute})`);

const chart = getBaziChart({
  year: params.year,
  month: params.month,
  day: params.day,
  hour: params.hour,
  minute: params.minute,
  gender: params.gender,
  longitude: params.longitude,
  latitude: params.latitude,
  standardMeridian: params.standardMeridian,
  useTrueSolarTime: true,
});

const tst = chart.真太阳时;
if (!tst) {
  console.error("Missing 真太阳时 block");
  process.exit(1);
}

console.log("TST block:", tst);
assert(Math.abs(tst.修正分钟) < 20, `total correction within ±20 min (got ${tst.修正分钟})`);
assert(tst.钟表时间.includes("07:58"), `clock shows user input 07:58 (got ${tst.钟表时间})`);

const lngOnly = (120.7 - 120) * 4;
assert(Math.abs(lngOnly - 2.8) < 0.1, `longitude-only correction ≈ +2.8 min (got ${lngOnly})`);

console.log("\nAll Wenzhou TST checks passed.");
