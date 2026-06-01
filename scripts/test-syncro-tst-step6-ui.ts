/**
 * Syncro True Solar Time — Step 6 three-mode UI tests.
 * Run: pnpm test:syncro-tst-step6
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkPosture } from "../lib/syncro/posture-check";
import {
  findBestDirectionForPeriod,
  getInitialSyncroUiMode,
  getOrderedHourPeriodsFromSession,
  inferTaskTimeScope,
  tiltSuggestsMode,
} from "../lib/syncro/syncro-view-helpers";
import { getHourDotStatus } from "../lib/syncro/hour-progress-status";
import { HOUR_ORDER } from "../lib/syncro/hour-order";
import { SYNCRO_LLM_BATCH_COUNT } from "../lib/llm/services/syncro-reading-service";
import { matrixKey, type SyncroSession } from "../lib/syncro/types";

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
    "components/syncro/PostureHintOverlay.tsx",
    "styles/syncro-posture.css",
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
    "lib/syncro/useCompassPermission.ts",
    "styles/syncro-permission-gate.css",
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

  const compassCss = readFileSync(join(ROOT, "styles/syncro-compass.css"), "utf8");
  assert(compassCss.includes("85vmin") && compassCss.includes("width: 75%"), "full-screen concentric + particle");

  const compass = readFileSync(join(ROOT, "components/syncro/SyncroCompassMode.tsx"), "utf8");
  assert(compass.includes("concentric-system"), "compass uses concentric layout");
  assert(compass.includes("SyncroDirectionRing"), "compass uses direction ring");
  assert(compass.includes("PostureHintOverlay") && compass.includes("deviceTiltBeta"), "compass posture overlay");
  assert(compass.includes("rotating-layer") && compass.includes("-compassDegree"), "compass rotates parent layer");
  assert(!compass.includes("phone-position-hint"), "no layout phone hint bar");
  assert(!compass.includes("requestPermission"), "compass permission only at gate");
  assert(compass.includes("WhyThisCurrentModal"), "compass has why modal");

  const ar = readFileSync(join(ROOT, "components/syncro/SyncroARMode.tsx"), "utf8");
  assert(ar.includes("concentric-system"), "AR uses concentric layout");
  assert(ar.includes("ar-camera-window") && ar.includes("getUserMedia"), "AR camera window");
  assert(ar.includes("SyncroDirectionRing") && ar.includes("PostureHintOverlay"), "AR direction ring + posture");
  assert(!ar.includes("phone-position-hint"), "AR no layout phone hint bar");

  const mapMode = readFileSync(join(ROOT, "components/syncro/SyncroMapMode.tsx"), "utf8");
  assert(
    mapMode.includes("concentric-system") && mapMode.includes("SYNCRO_DIRECTION_RING_RADIUS_PCT"),
    "map uses full-size concentric layout",
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
  assert(layoutCss.includes("--syncro-bottom-reserve: 120px"), "compact bottom chrome for large ring");
  assert(layoutCss.includes("padding-top: var(--syncro-stage-top)"), "stage clears top chrome");

  const compassHook = readFileSync(join(ROOT, "lib/syncro/useCompassPermission.ts"), "utf8");
  const compassIos = readFileSync(join(ROOT, "lib/syncro/compass-permission-ios.ts"), "utf8");
  assert(
    compassHook.includes("requestPermissionFromUserGesture") && compassHook.includes("webkitCompassHeading"),
    "compass hook iOS + gesture API",
  );
  assert(
    compassIos.includes("requestDeviceOrientationPermission") && compassIos.includes("pj_compass_granted"),
    "iOS motion permission helper",
  );
  const mainView = readFileSync(join(ROOT, "components/syncro/SyncroMainView.tsx"), "utf8");
  assert(mainView.includes("tryActivateCompass") && mainView.includes("pointerdown"), "auto compass on touch");
  assert(!mainView.includes("SyncroPermissionGate"), "no manual compass gate");
  assert(mainView.includes("ThreeModeToggle"), "main has three-mode toggle");
  assert(mainView.includes("HourProgressBar"), "main has progress");
  assert(mainView.includes("SyncroMapMode"), "main has map mode");
  assert(mainView.includes("SyncroARMode"), "main has AR mode");
  assert(mainView.includes("loadSyncroPermission"), "main loads permissions");
  assert(!mainView.includes("tiltSuggestsMode"), "no posture auto-switch");

  const hourBar = readFileSync(join(ROOT, "components/syncro/HourProgressBar.tsx"), "utf8");
  assert(hourBar.includes("getHourDotStatus") && hourBar.includes("hour-now-tag"), "hour progress states");
  assert(hourBar.includes("scrollIntoView"), "hour bar scrolls live period to center");

  const hourCss = readFileSync(join(ROOT, "styles/syncro-hour-progress.css"), "utf8");
  assert(hourCss.includes("scroll-snap-type") && hourCss.includes("status-failed"), "hour bar scroll + failed");

  const runner = readFileSync(join(ROOT, "components/syncro/SyncroLlmBatchRunner.tsx"), "utf8");
  assert(runner.includes("HOUR_ORDER") && runner.includes("hour_id"), "12-hour LLM batches");
  assert(runner.includes("patchSyncroSessionMatrixFailure"), "marks failed hour cells");

  assert(SYNCRO_LLM_BATCH_COUNT === 12, "12 LLM batches");

  const live: (typeof HOUR_ORDER)[number] = "wu";
  const order = ["wu", "wei", "shen", "you", "xu", "hai", "zi", "chou", "yin", "mao", "chen", "si"] as const;
  const matrix: SyncroSession["matrix"] = {};
  for (const h of HOUR_ORDER) {
    for (const d of ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const) {
      matrix[matrixKey(h, d)] = {
        hour_period: h,
        direction_id: d,
        hour_start_iso: "2024-01-01T00:00:00.000Z",
        hour_end_iso: "2024-01-01T02:00:00.000Z",
        current_level: "stillwater",
        short_advice: "x",
        detailed_advice: "y",
        rationale: "z",
        llm_pending: h === "wei",
      };
    }
  }
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const clearHourPending = (h: (typeof HOUR_ORDER)[number]) => {
    for (const d of dirs) matrix[matrixKey(h, d)]!.llm_pending = false;
  };

  assert(getHourDotStatus(live, live, matrix, [...order]) === "now", "live hour is now");
  assert(getHourDotStatus("wei", live, matrix, [...order]) === "pending", "wei still pending");
  for (const h of HOUR_ORDER) {
    if (h === live || h === "wei") continue;
    clearHourPending(h);
  }
  assert(getHourDotStatus("shen", live, matrix, [...order]) === "pending", "shen waits for wei");
  clearHourPending("wei");
  assert(getHourDotStatus("shen", live, matrix, [...order]) === "done", "shen done after wei completes");

  console.log("\n✅ Syncro TST Step 6 — three-mode UI OK");
}

main();
