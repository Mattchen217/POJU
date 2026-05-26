/**
 * Syncro True Solar Time — Step 6 three-mode UI tests.
 * Run: pnpm test:syncro-tst-step6
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findBestDirectionForPeriod,
  getInitialSyncroUiMode,
  getOrderedHourPeriodsFromSession,
  inferTaskTimeScope,
  resolveHourProgressState,
  tiltSuggestsMode,
} from "../lib/syncro/syncro-view-helpers";
import type { SyncroSession } from "../lib/syncro/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function mockSession(): SyncroSession {
  const matrix: SyncroSession["matrix"] = {};
  const periods = ["zi", "chou", "yin"] as const;
  const dirs = ["N", "E", "S", "W"] as const;
  for (const p of periods) {
    for (const d of dirs) {
      const key = `${p}__${d}`;
      matrix[key] = {
        hour_period: p,
        direction_id: d,
        hour_start_iso: `2024-01-01T00:00:00.000Z`,
        hour_end_iso: `2024-01-01T02:00:00.000Z`,
        current_level: d === "N" ? "open_current" : "stillwater",
        short_advice: "x",
        detailed_advice: "y",
        rationale: "z",
      };
    }
  }

  return {
    session_id: "t",
    device_id: "d",
    profile_id: "p",
    task_description: "t",
    user_location: { latitude: 0, longitude: 0, timezone: "UTC" },
    created_at: new Date(),
    expires_at: new Date(),
    matrix,
    locale: "en",
    is_free: true,
    cost_usd: 0,
    llm_meta: { model: "x", tokens_used: 0, latency_ms: 0 },
  };
}

function main() {
  assert(inferTaskTimeScope("meet client tomorrow") === "planning", "tomorrow → planning");
  assert(inferTaskTimeScope("sign contract today") === "now", "today → now");

  assert(getInitialSyncroUiMode({ taskTimeScope: "now", orientationSupported: true }) === "compass", "now → compass");
  assert(getInitialSyncroUiMode({ taskTimeScope: "planning", orientationSupported: true }) === "view", "planning → view");
  assert(getInitialSyncroUiMode({ taskTimeScope: "now", orientationSupported: false }) === "view", "no compass → view");

  assert(tiltSuggestsMode(70) === "compass", "flat → compass");
  assert(tiltSuggestsMode(10) === "ar", "upright → ar");
  assert(tiltSuggestsMode(45) === null, "mid tilt → no force");

  const session = mockSession();
  const ordered = getOrderedHourPeriodsFromSession(session);
  assert(ordered.length === 3, "ordered periods from session");

  const best = findBestDirectionForPeriod(session, "zi");
  assert(best === "N", "best dir N for open_current");

  assert(
    resolveHourProgressState({
      period: "chou",
      livePeriod: "yin",
      selectedPeriod: "chou",
      orderedPeriods: ordered,
    }) === "selected",
    "manual select state",
  );

  const files = [
    "components/syncro/SyncroMainView.tsx",
    "components/syncro/SyncroCompassMode.tsx",
    "components/syncro/SyncroARMode.tsx",
    "components/syncro/SyncroViewMode.tsx",
    "components/syncro/HourProgressBar.tsx",
    "components/syncro/ModeSwitcher.tsx",
  ];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert(src.length > 100, `${f} exists`);
  }

  const mainView = readFileSync(join(ROOT, "components/syncro/SyncroMainView.tsx"), "utf8");
  assert(mainView.includes("ModeSwitcher"), "main has switcher");
  assert(mainView.includes("HourProgressBar"), "main has progress");
  assert(mainView.includes("SyncroViewMode"), "main has view mode");

  console.log("\n✅ Syncro TST Step 6 — three-mode UI OK");
}

main();
