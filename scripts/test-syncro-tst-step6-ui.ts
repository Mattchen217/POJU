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
        llm_pending: false,
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
  assert(getInitialSyncroUiMode({ taskTimeScope: "planning", orientationSupported: true }) === "map", "planning → map");
  assert(getInitialSyncroUiMode({ taskTimeScope: "now", orientationSupported: false }) === "map", "no compass → map");

  assert(tiltSuggestsMode(70) === "compass", "flat → compass");
  assert(tiltSuggestsMode(10) === "ar", "upright → ar");
  assert(tiltSuggestsMode(45) === null, "mid tilt → no force");

  const session = mockSession();
  const ordered = getOrderedHourPeriodsFromSession(session);
  assert(ordered.length === 3, "ordered periods from session");

  const best = findBestDirectionForPeriod(session, "zi");
  assert(best === "N", "best dir N for open_current");

  const files = [
    "components/syncro/SyncroMainView.tsx",
    "components/syncro/SyncroCompassMode.tsx",
    "components/syncro/SyncroParticleCore.tsx",
    "components/syncro/SyncroDirectionRing.tsx",
    "components/syncro/SyncroParticleCircle.tsx",
    "components/syncro/WhyThisCurrentModal.tsx",
    "styles/syncro-compass.css",
    "components/syncro/SyncroARMode.tsx",
    "styles/syncro-ar.css",
    "components/syncro/SyncroMapMode.tsx",
    "styles/syncro-map.css",
    "styles/syncro-why-modal.css",
    "components/syncro/HourProgressBar.tsx",
    "components/syncro/ThreeModeToggle.tsx",
    "lib/syncro/permissions.ts",
    "components/pwa/PWAConditional.tsx",
    "components/pwa/BeginButton.tsx",
    "styles/pwa-product-begin.css",
    "styles/syncro-hour-progress.css",
    "styles/syncro-layout.css",
  ];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert(src.length > 50, `${f} exists`);
  }

  const compass = readFileSync(join(ROOT, "components/syncro/SyncroCompassMode.tsx"), "utf8");
  assert(compass.includes("concentric-system"), "compass uses concentric layout");
  assert(compass.includes("SyncroDirectionRing"), "compass uses direction ring");
  assert(compass.includes("WhyThisCurrentModal"), "compass has why modal");

  const ar = readFileSync(join(ROOT, "components/syncro/SyncroARMode.tsx"), "utf8");
  assert(ar.includes("concentric-system"), "AR uses concentric layout");
  assert(ar.includes("ar-camera-window") && ar.includes("getUserMedia"), "AR camera window");
  assert(ar.includes("SyncroDirectionRing"), "AR direction ring");

  const mapMode = readFileSync(join(ROOT, "components/syncro/SyncroMapMode.tsx"), "utf8");
  assert(
    mapMode.includes("concentric-system") && mapMode.includes("map-larger"),
    "map uses enlarged concentric layout",
  );
  assert(mapMode.includes("SyncroDirectionRing") && mapMode.includes("SyncroParticleCore"), "map shared layers");
  assert(mapMode.includes("map-point") && mapMode.includes("why-btn-prominent"), "map points + CTA");
  assert(mapMode.includes("WhyThisCurrentModal"), "map has why modal");

  const whyModal = readFileSync(join(ROOT, "components/syncro/WhyThisCurrentModal.tsx"), "utf8");
  assert(whyModal.includes("why-modal-overlay") && whyModal.includes("Escape"), "why modal UX");
  const whyCss = readFileSync(join(ROOT, "styles/syncro-why-modal.css"), "utf8");
  assert(whyCss.includes("backdrop-filter") && whyCss.includes("why-action-card"), "why modal styles");

  const beginBtn = readFileSync(join(ROOT, "components/pwa/BeginButton.tsx"), "utf8");
  assert(beginBtn.includes("isFirstTimeFree") && beginBtn.includes("begin-btn-large"), "PWA begin button");

  const syncroCss = readFileSync(join(ROOT, "styles/syncro.css"), "utf8");
  assert(syncroCss.includes("flex-direction: row"), "compact mode toggle");
  assert(syncroCss.includes("--syncro-why-bottom"), "why CTA uses layout token");

  const layoutCss = readFileSync(join(ROOT, "styles/syncro-layout.css"), "utf8");
  assert(layoutCss.includes("--syncro-bottom-reserve: 160px"), "bottom reserve band");
  assert(layoutCss.includes("--syncro-phone-hint-top: 100px"), "phone hint below hour bar");
  assert(layoutCss.includes("padding-top: var(--syncro-stage-top)"), "stage clears top chrome");

  const mainView = readFileSync(join(ROOT, "components/syncro/SyncroMainView.tsx"), "utf8");
  assert(mainView.includes("ThreeModeToggle"), "main has three-mode toggle");
  assert(mainView.includes("HourProgressBar"), "main has progress");
  assert(mainView.includes("SyncroMapMode"), "main has map mode");
  assert(mainView.includes("SyncroARMode"), "main has AR mode");
  assert(mainView.includes("loadSyncroPermission"), "main loads permissions");
  assert(!mainView.includes("tiltSuggestsMode"), "no posture auto-switch");

  const hourBar = readFileSync(join(ROOT, "components/syncro/HourProgressBar.tsx"), "utf8");
  assert(hourBar.includes("HourDotStatus") && hourBar.includes("hour-now-tag"), "hour progress states");
  assert(hourBar.includes("hour-now-tag"), "NOW tag below labels");

  console.log("\n✅ Syncro TST Step 6 — three-mode UI OK");
}

main();
