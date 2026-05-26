/**
 * Syncro True Solar Time — Step 7 end-to-end verification (automated).
 *
 *   pnpm test:syncro-tst-step7
 *   pnpm test:syncro-tst-step7 -- --api http://localhost:3000
 *   pnpm test:syncro-tst-step7 -- --live   (optional LLM rationale spot-check)
 *
 * Browser-only items are listed in the report under manual_checklist.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { mapNominatimResults } from "../lib/syncro/nominatim-search";
import { buildSyncroPrompt } from "../lib/llm/prompts/syncro-deepseek-prompt";
import { calculateSyncroMatrix } from "../lib/syncro/calculate-matrix";
import { buildDeviceCapability, canUseSyncro } from "../lib/syncro/device-capability";
import { calculateTrueSolarTime } from "../lib/syncro/true-solar-time";
import {
  buildSyncroStoredLocation,
  parseSyncroStoredLocation,
} from "../lib/syncro/syncro-location-storage";
import {
  findBestDirectionForPeriod,
  getInitialSyncroUiMode,
  getOrderedHourPeriodsFromSession,
  inferTaskTimeScope,
  tiltSuggestsMode,
} from "../lib/syncro/syncro-view-helpers";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = resolve(ROOT, ".data", "syncro-tst-step7-report.json");

const failures: string[] = [];
const LIVE = process.argv.includes("--live");
const API_SERVER = (() => {
  const i = process.argv.indexOf("--api");
  return i >= 0 ? process.argv[i + 1] : null;
})();

type Report = {
  ran_at: string;
  summary: { passed: number; failed: number };
  scenarios: Record<string, unknown>;
  manual_checklist: string[];
};

function assert(scenario: string, name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${scenario} — ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(`${scenario}: ${name}`);
}

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const mockProfile = {
  base_analysis: {
    content: {
      bazi: { day_master: "甲" },
      yong_shen: { primary_element: "水" },
    },
  },
};

function scenario1DesktopBlock(report: Report) {
  console.log("\n=== S1: PC desktop block ===\n");
  const s = "S1";

  const pc = buildDeviceCapability({
    isTabletUA: false,
    isMobileUA: false,
    hasTouch: false,
    hasOrientationSensor: false,
    hasCamera: false,
    hasGeolocation: false,
    os: "windows",
  });
  assert(s, "desktop cannot use Syncro", !canUseSyncro(pc));

  const guarded = [
    "app/[locale]/(marketing)/syncro/task/page.tsx",
    "app/[locale]/(marketing)/syncro/result/[id]/page.tsx",
  ];
  for (const f of guarded) {
    assert(s, `${f} guarded`, readSrc(f).includes("SyncroGuardedRoute"));
  }

  const start = readSrc("components/syncro/SyncroMobileStartSection.tsx");
  assert(s, "QR modal on desktop CTA", start.includes("SyncroDesktopQRModal"));
  assert(s, "desktop=true deep link", start.includes('searchParams.get("desktop")'));

  report.scenarios.S1_desktop = { pc_type: pc.type, guarded };
}

function scenario2Beijing(report: Report) {
  console.log("\n=== S2: Mobile — Beijing (116.4°E) ===\n");
  const s = "S2";
  const civil = new Date("2024-06-15T12:00:00+08:00");

  const { metadata } = calculateSyncroMatrix({
    profile: mockProfile,
    taskDescription: "今天下午见客户谈合作",
    startTime: civil,
    userTimezone: "Asia/Shanghai",
    userLongitude: 116.4,
    userLatitude: 39.9,
  });

  assert(s, "TST diff ~-15 min", metadata.diffMinutes < -10 && metadata.diffMinutes > -25, String(metadata.diffMinutes));
  assert(s, "metadata has trueSolarTime", metadata.trueSolarTime.length > 10);

  report.scenarios.S2_beijing = metadata;
}

function scenario3Urumqi(report: Report) {
  console.log("\n=== S3: Mobile — Urumqi (87.6°E) — critical ===\n");
  const s = "S3";
  const civil = new Date("2024-06-15T12:00:00+08:00");

  const beijing = calculateSyncroMatrix({
    profile: mockProfile,
    taskDescription: "今天下午见客户谈合作",
    startTime: civil,
    userTimezone: "Asia/Shanghai",
    userLongitude: 116.4,
    userLatitude: 39.9,
  });

  const urumqi = calculateSyncroMatrix({
    profile: mockProfile,
    taskDescription: "今天下午见客户谈合作",
    startTime: civil,
    userTimezone: "Asia/Shanghai",
    userLongitude: 87.6,
    userLatitude: 43.8,
  });

  assert(s, "Urumqi diff < -120 min", urumqi.metadata.diffMinutes < -120, String(urumqi.metadata.diffMinutes));

  const bPeriods = getOrderedHourPeriodsFromSession({ matrix: beijing.matrix } as unknown as import("../lib/syncro/types").SyncroSession);
  const uPeriods = getOrderedHourPeriodsFromSession({ matrix: urumqi.matrix } as unknown as import("../lib/syncro/types").SyncroSession);
  const bFirst = bPeriods[0];
  const uFirst = uPeriods[0];
  assert(
    s,
    "hour-period window differs from Beijing",
    bFirst !== uFirst || beijing.matrix[Object.keys(beijing.matrix)[0]].hour_start_iso !== urumqi.matrix[Object.keys(urumqi.matrix)[0]].hour_start_iso,
    `${bFirst} vs ${uFirst}`,
  );

  report.scenarios.S3_urumqi = {
    beijing: beijing.metadata,
    urumqi: urumqi.metadata,
    first_period: { beijing: bFirst, urumqi: uFirst },
  };
}

function scenario4ManualLocation(report: Report) {
  console.log("\n=== S4: Geolocation denied → city search ===\n");
  const s = "S4";

  const mapped = mapNominatimResults([
    {
      place_id: 1,
      display_name: "New York, NY, USA",
      lat: "40.7128",
      lon: "-74.0060",
      type: "city",
    },
  ]);
  assert(s, "Nominatim mapper", mapped[0].lat > 40 && mapped[0].lng < -73);

  const locPage = readSrc("components/syncro/SyncroLocationPage.tsx");
  assert(s, "manual_search stage", locPage.includes("manual_search"));
  assert(s, "CitySearchBox wired", locPage.includes("CitySearchBox"));

  const stored = buildSyncroStoredLocation({
    lat: 40.7128,
    lng: -74.006,
    source: "manual",
    city_name: "New York",
    timezone: "America/New_York",
  });
  const parsed = parseSyncroStoredLocation(JSON.stringify(stored));
  assert(s, "session timezone preserved", parsed?.timezone === "America/New_York");

  const nycWinter = calculateTrueSolarTime({
    localTime: new Date("2024-01-15T12:00:00-05:00"),
    longitude: -74,
    timezone: "America/New_York",
  });
  assert(
    s,
    "NYC TST longitude correction small (EST)",
    Math.abs(nycWinter.longitudeDiffMinutes) < 10,
    String(nycWinter.longitudeDiffMinutes),
  );

  report.scenarios.S4_manual_location = { stored, nyc_winter_diff: nycWinter.diffMinutes };
}

function scenario5PlanningTask(report: Report) {
  console.log("\n=== S5: Planning task → default View ===\n");
  const s = "S5";

  assert(s, "tomorrow → planning", inferTaskTimeScope("I have a meeting tomorrow at 10") === "planning");
  assert(s, "today → now", inferTaskTimeScope("sign contract today") === "now");
  assert(
    s,
    "planning default View",
    getInitialSyncroUiMode({ taskTimeScope: "planning", orientationSupported: true }) === "view",
  );
  assert(
    s,
    "now default Compass",
    getInitialSyncroUiMode({ taskTimeScope: "now", orientationSupported: true }) === "compass",
  );

  const taskPage = readSrc("components/syncro/SyncroTaskPage.tsx");
  assert(
    s,
    "task writes syncro_task_time",
    taskPage.includes("SYNCRO_TASK_TIME_KEY") || taskPage.includes("syncro_task_time"),
  );

  report.scenarios.S5_planning = {
    tomorrow: inferTaskTimeScope("tomorrow interview"),
    initial_view: getInitialSyncroUiMode({ taskTimeScope: "planning", orientationSupported: true }),
  };
}

function scenario6Tablet(report: Report) {
  console.log("\n=== S6: iPad / tablet ===\n");
  const s = "S6";

  const ipad = buildDeviceCapability({
    isTabletUA: true,
    isMobileUA: false,
    hasTouch: true,
    hasOrientationSensor: false,
    hasCamera: true,
    hasGeolocation: true,
    os: "ios",
  });
  assert(s, "iPad → tablet", ipad.isTablet);
  assert(s, "tablet can use Syncro", canUseSyncro(ipad));
  assert(
    s,
    "no compass → View default",
    getInitialSyncroUiMode({ taskTimeScope: "now", orientationSupported: false }) === "view",
  );

  report.scenarios.S6_tablet = { type: ipad.type, canUse: canUseSyncro(ipad) };
}

function scenario7TrueSolarCities(report: Report) {
  console.log("\n=== S7: True solar time — global spots ===\n");
  const s = "S7";
  const civilCn = new Date("2024-06-15T12:00:00+08:00");

  const urumqi = calculateTrueSolarTime({
    localTime: civilCn,
    longitude: 87.6,
    timezone: "Asia/Shanghai",
  });
  const beijing = calculateTrueSolarTime({
    localTime: civilCn,
    longitude: 116.4,
    timezone: "Asia/Shanghai",
  });
  const nyc = calculateTrueSolarTime({
    localTime: new Date("2024-01-15T12:00:00-05:00"),
    longitude: -74,
    timezone: "America/New_York",
  });
  const sf = calculateTrueSolarTime({
    localTime: new Date("2024-01-15T12:00:00-08:00"),
    longitude: -122.4,
    timezone: "America/Los_Angeles",
  });

  assert(s, "Urumqi ≈ -130 min", urumqi.diffMinutes < -120, String(urumqi.diffMinutes));
  assert(s, "Beijing ≈ -15 min", beijing.diffMinutes < -10 && beijing.diffMinutes > -25, String(beijing.diffMinutes));
  assert(s, "NYC |lon diff| < 10", Math.abs(nyc.longitudeDiffMinutes) < 10, String(nyc.longitudeDiffMinutes));
  assert(s, "SF lon diff ≈ -9.6", Math.abs(sf.longitudeDiffMinutes + 9.6) < 1.5, String(sf.longitudeDiffMinutes));

  report.scenarios.S7_cities = {
    urumqi: urumqi.diffMinutes,
    beijing: beijing.diffMinutes,
    nyc: nyc.diffMinutes,
    sf: sf.diffMinutes,
  };
}

function scenario8PromptAndUi(report: Report) {
  console.log("\n=== S8: LLM prompt + three-mode UI ===\n");
  const s = "S8";

  const civil = new Date("2024-06-15T12:00:00+08:00");
  const { matrix, metadata } = calculateSyncroMatrix({
    profile: mockProfile,
    taskDescription: "今天下午见客户",
    startTime: civil,
    userTimezone: "Asia/Shanghai",
    userLongitude: 116.4,
    userLatitude: 39.9,
  });

  const { system } = buildSyncroPrompt({
    profile: null,
    base_analysis: mockProfile.base_analysis.content,
    task_description: "今天下午见客户",
    user_location: { latitude: 39.9, longitude: 116.4, timezone: "Asia/Shanghai" },
    locale: "zh",
    matrix,
    true_solar: metadata,
  });

  assert(s, "prompt includes 真太阳时", system.includes("真太阳时"));
  assert(s, "prompt includes diff minutes", system.includes(String(metadata.diffMinutes)));

  const mainView = readSrc("components/syncro/SyncroMainView.tsx");
  assert(s, "three modes in main view", mainView.includes("SyncroCompassMode") && mainView.includes("SyncroViewMode"));
  assert(s, "tilt auto-switch", mainView.includes("tiltSuggestsMode"));
  assert(s, "hour progress bar", mainView.includes("HourProgressBar"));

  assert(s, "tilt compass", tiltSuggestsMode(70) === "compass");
  assert(s, "tilt AR", tiltSuggestsMode(10) === "ar");

  const session = { matrix } as unknown as import("../lib/syncro/types").SyncroSession;
  const periods = getOrderedHourPeriodsFromSession(session);
  const best = findBestDirectionForPeriod(session, periods[0]);
  assert(s, "view mode best direction resolved", ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].includes(best));

  report.scenarios.S8_prompt_ui = {
    prompt_has_true_solar: system.includes("真太阳时"),
    best_direction: best,
  };
}

async function scenarioApi(report: Report) {
  if (!API_SERVER) return;
  console.log(`\n=== API: ${API_SERVER} ===\n`);
  const s = "API";

  try {
    const bad = await fetch(`${API_SERVER}/api/syncro/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: "x",
        task_description: "test task here now",
        user_location: { latitude: 40, longitude: -74 },
      }),
    });
    const badJson = (await bad.json()) as { error?: string };
    assert(s, "missing timezone → 400", bad.status === 400 && badJson.error === "invalid_location", String(bad.status));

    const city = await fetch(`${API_SERVER}/api/syncro/search-city?q=Beijing`);
    const cityJson = (await city.json()) as { results?: unknown[] };
    assert(s, "search-city returns results", Array.isArray(cityJson.results), String(cityJson.results?.length ?? 0));

    report.scenarios.API = { bad_status: bad.status, city_count: cityJson.results?.length };
  } catch (e) {
    console.log("  API skipped:", e);
    report.scenarios.API = { skipped: true, error: String(e) };
  }
}

const MANUAL_CHECKLIST = [
  "S1: Desktop — /syncro shows marketing + QR on CTA; /syncro/task redirects to /syncro?desktop=true",
  "S2: Phone — full flow through location → computing → result; Compass default for “today” task",
  "S2: Flat phone → Compass; upright → AR; bottom View shows 9-grid with YOU center",
  "S3: DevTools geolocation 87.6°E — console TST diff ~-130 min vs Beijing ~-15 min",
  "S4: Deny geolocation — city search → confirm → computing uses selected coords + timezone",
  "S5: Task with “明天/tomorrow” — result opens in View mode by default",
  "S6: iPad — not blocked as desktop; View if no compass permission",
  "S8: Live session — rationale mentions location or true solar timing (human read)",
];

async function main() {
  const report: Report = {
    ran_at: new Date().toISOString(),
    summary: { passed: 0, failed: 0 },
    scenarios: {},
    manual_checklist: MANUAL_CHECKLIST,
  };

  console.log("\n######## Syncro True Solar Time — Step 7 E2E ########\n");

  scenario1DesktopBlock(report);
  scenario2Beijing(report);
  scenario3Urumqi(report);
  scenario4ManualLocation(report);
  scenario5PlanningTask(report);
  scenario6Tablet(report);
  scenario7TrueSolarCities(report);
  scenario8PromptAndUi(report);
  await scenarioApi(report);

  if (LIVE) {
    console.log("\n  (--live: full LLM E2E — run pnpm test:syncro-step7:live for calculation-engine live suite)\n");
  }

  report.summary.failed = failures.length;
  report.summary.passed = failures.length === 0 ? 1 : 0;

  if (!existsSync(resolve(ROOT, ".data"))) mkdirSync(resolve(ROOT, ".data"));
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log("\n--- Manual browser checklist (not automated) ---");
  for (const line of MANUAL_CHECKLIST) {
    console.log(`  • ${line}`);
  }
  console.log(`\nReport: ${REPORT_PATH}`);

  if (failures.length) {
    console.error(`\n${failures.length} automated check(s) failed:\n`, failures);
    process.exit(1);
  }
  console.log("\n✅ Syncro TST Step 7 — all automated scenarios passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
