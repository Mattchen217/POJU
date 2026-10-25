/**
 * Syncro True Solar Time — Step 3 tests.
 * Run: pnpm test:syncro-tst-step3
 */
import {
  calculateEquationOfTime,
  calculateTrueSolarTime,
  getTimezoneOffsetMinutes,
} from "../lib/syncro/true-solar-time";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function closeTo(actual: number, expected: number, decimals = 1) {
  const tol = 10 ** -decimals;
  assert(Math.abs(actual - expected) <= tol, `expected ${expected} ± ${tol}, got ${actual}`);
}

function main() {
  // Beijing (116.4°E, zone center 120°E)
  const beijing = calculateTrueSolarTime({
    localTime: new Date("2024-06-15T12:00:00+08:00"),
    longitude: 116.4,
    timezone: "Asia/Shanghai",
  });
  closeTo(beijing.longitudeDiffMinutes, -14.4, 1);
  const beijingHour =
    beijing.trueSolarTime.getTime() - new Date("2024-06-15T12:00:00+08:00").getTime();
  assert(beijingHour < 0, "Beijing true solar time earlier than civil noon");

  // Urumqi (~87.6°E, still Asia/Shanghai)
  const urumqi = calculateTrueSolarTime({
    localTime: new Date("2024-06-15T12:00:00+08:00"),
    longitude: 87.6,
    timezone: "Asia/Shanghai",
  });
  closeTo(urumqi.longitudeDiffMinutes, -129.6, 0);
  const urumqiTotalMin = urumqi.diffMinutes;
  assert(urumqiTotalMin < -120, `Urumqi total correction ~2h, got ${urumqiTotalMin}`);

  // New York — EST (standard meridian −75°) for stable longitude correction
  const nyc = calculateTrueSolarTime({
    localTime: new Date("2024-01-15T12:00:00-05:00"),
    longitude: -74.0,
    timezone: "America/New_York",
  });
  assert(Math.abs(nyc.longitudeDiffMinutes) < 10, `NYC longitude diff ${nyc.longitudeDiffMinutes}`);

  // San Francisco — PST (meridian −120°)
  const sf = calculateTrueSolarTime({
    localTime: new Date("2024-01-15T12:00:00-08:00"),
    longitude: -122.4,
    timezone: "America/Los_Angeles",
  });
  closeTo(sf.longitudeDiffMinutes, -9.6, 0);

  // Equation of time: Feb negative, Nov positive (at zone center → longitude diff 0)
  const feb = calculateTrueSolarTime({
    localTime: new Date("2024-02-05T12:00:00+08:00"),
    longitude: 120.0,
    timezone: "Asia/Shanghai",
  });
  const nov = calculateTrueSolarTime({
    localTime: new Date("2024-11-05T12:00:00+08:00"),
    longitude: 120.0,
    timezone: "Asia/Shanghai",
  });
  assert(feb.eqOfTimeMinutes < -10, `Feb EoT ${feb.eqOfTimeMinutes}`);
  assert(nov.eqOfTimeMinutes > 10, `Nov EoT ${nov.eqOfTimeMinutes}`);

  // Shanghai offset +480 min → center 120°
  const shOffset = getTimezoneOffsetMinutes("Asia/Shanghai", new Date("2024-06-15T12:00:00+08:00"));
  assert(shOffset === 480, `Asia/Shanghai offset ${shOffset}`);

  // EoT standalone sanity
  const eotFeb = calculateEquationOfTime(36);
  assert(eotFeb < -5, `EoT day 36 ${eotFeb}`);

  console.log("Beijing:", beijing);
  console.log("Urumqi:", urumqi);
  console.log("NYC (EST):", nyc);
  console.log("SF (PST):", sf);
  console.log("\n✅ Syncro TST Step 3 — true solar time OK");
}

main();
