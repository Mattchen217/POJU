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
import { isSyncroLlmReady } from "../lib/syncro/llm-cell-display";
import { isHourPeriodLlmReady } from "../lib/syncro/hour-llm-ready";
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
  assert(compassCss.includes(".compass-page"), "compass page container");

  const compass = readFileSync(join(ROOT, "components/syncro/SyncroCompassMode.tsx"), "utf8");
  assert(
    compass.includes("SYNCRO_RING_SIZE") && compass.includes("SyncroDirectionLabels"),
    "polish v3 ring + static labels",
  );
  assert(compass.includes("PostureHintOverlay") && compass.includes("deviceTiltBeta"), "compass posture overlay");
  const ringLayout = readFileSync(join(ROOT, "lib/syncro/syncro-ring-layout.ts"), "utf8");
  assert(
    compass.includes("rotate(${-alpha}deg)") && compass.includes("counterRotateDeg={alpha}"),
    "simple rotate + upright labels",
  );
  assert(!ringLayout.includes("rotate3d"), "no GPU rotate helper");
  assert(ringLayout.includes("SYNCRO_PARTICLE_DISPLAY_SCALE"), "particle scale for canvas margin");
  assert(ringLayout.includes("SYNCRO_PARTICLE_OFFSET_X = 5"), "particle +5px nudge");
  assert(ringLayout.includes("getSyncroParticleFieldStyle"), "particle size on spline root");
  assert(ringLayout.includes("SYNCRO_RING_MARGIN_TOP = 80"), "ring margin 80");
  assert(compass.includes("SyncroParticleCore bare"), "particle without mask");
  assert(compass.includes("SyncroCellAdvice"), "compass uses real LLM advice gate");
  assert(!compass.includes("phone-position-hint"), "no layout phone hint bar");
  assert(!compass.includes("requestPermission"), "compass permission only at gate");
  assert(compass.includes("WhyThisCurrentModal"), "compass has why modal");

  const ar = readFileSync(join(ROOT, "components/syncro/SyncroARMode.tsx"), "utf8");
  assert(ar.includes("SYNCRO_AR_CAMERA_SIZE") && ar.includes("getUserMedia"), "AR camera 200px");
  assert(ar.includes("SYNCRO_RING_SIZE") && ar.includes("PostureHintOverlay"), "AR shared ring layout + posture");
  assert(!ar.includes("phone-position-hint"), "AR no layout phone hint bar");

  const mapMode = readFileSync(join(ROOT, "components/syncro/SyncroMapMode.tsx"), "utf8");
  assert(mapMode.includes("SYNCRO_MAP_POINT_SIZE") && mapMode.includes("SyncroDirectionLabels"), "map shared layout + labels");
  assert(mapMode.includes("SYNCRO_RING_SIZE") && mapMode.includes("why-btn-prominent"), "map ring + CTA");
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
  assert(mainView.includes("onRetryHour"), "main wires hour retry");
  assert(mainView.includes("SyncroMapMode"), "main has map mode");
  assert(mainView.includes("SyncroARMode"), "main has AR mode");
  assert(mainView.includes("loadSyncroPermission"), "main loads permissions");
  assert(!mainView.includes("tiltSuggestsMode"), "no posture auto-switch");

  const hourBar = readFileSync(join(ROOT, "components/syncro/HourProgressBar.tsx"), "utf8");
  assert(hourBar.includes("getHourDotStatus") && hourBar.includes("hour-now-tag"), "hour progress states");
  assert(hourBar.includes("hour-track-viewport") && hourBar.includes("hour-dot-slot"), "hour bar fixed rail slots");
  assert(hourBar.includes("onRetryHour") && hourBar.includes("retry_failed"), "failed hour tap retry");

  const hourCss = readFileSync(join(ROOT, "styles/syncro-hour-progress.css"), "utf8");
  assert(
    hourCss.includes("hour-track-viewport") &&
      hourCss.includes("flex-wrap: nowrap") &&
      hourCss.includes("status-failed"),
    "hour bar horizontal rail + failed",
  );

  const inngestJob = readFileSync(join(ROOT, "lib/syncro/use-syncro-inngest-job.ts"), "utf8");
  assert(inngestJob.includes("remaining_only"), "background Inngest after compass");
  assert(inngestJob.includes("/api/syncro/status"), "poll KV for hour advice");
  const retryHelper = readFileSync(join(ROOT, "lib/syncro/generate-syncro-hour-with-retry.ts"), "utf8");
  assert(retryHelper.includes("/api/syncro/llm_hour"), "llm_hour API with retry");
  assert(retryHelper.includes("MAX_ATTEMPTS = 3"), "hour retry helper");

  const pageLayout = readFileSync(join(ROOT, "components/syncro/SyncroPageLayout.tsx"), "utf8");
  assert(pageLayout.includes("SyncroRecentSessionsList"), "recent sessions on browser syncro home");

  const pwaFooter = readFileSync(join(ROOT, "components/syncro/SyncroPwaHomeFooter.tsx"), "utf8");
  assert(pwaFooter.includes("PWAOnly") && pwaFooter.includes("SyncroPwaContinuePrimary"), "PWA syncro resume footer");
  const marketing = readFileSync(join(ROOT, "components/marketing/syncro-marketing-page.tsx"), "utf8");
  assert(marketing.includes("SyncroPwaHomeFooter"), "marketing wires PWA syncro footer");

  const taskPage = readFileSync(join(ROOT, "components/syncro/SyncroTaskPage.tsx"), "utf8");
  assert(taskPage.includes("SyncroExistingSessionPrompt"), "task page resume prompt");

  const preparing = readFileSync(join(ROOT, "components/syncro/SyncroPreparingLiveHour.tsx"), "utf8");
  assert(preparing.includes("runStreamHoursWithRetry"), "SSE stream for priority hour");
  assert(preparing.includes("SyncroPreparingLiveHour"), "live hour gate before compass");

  assert(compass.includes("SYNCRO_WHY_BUTTON_MARGIN_TOP"), "why CTA margin");
  assert(compassCss.includes("padding-top: 80px"), "compass page padding 80");
  assert(compass.includes('overflow: "visible"'), "compass-area no clip");

  assert(SYNCRO_LLM_BATCH_COUNT === 12, "12 LLM batches");

  const localMeta = { model: "local", tokens_used: 0, latency_ms: 0 };
  const gateCell = {
    hour_period: "wu" as const,
    direction_id: "N" as const,
    hour_start_iso: "2024-01-01T00:00:00.000Z",
    hour_end_iso: "2024-01-01T02:00:00.000Z",
    current_level: "open_current" as const,
    short_advice: "LLM wu",
    detailed_advice: "detail",
    rationale: "why",
    llm_pending: false,
    llm_failed: false,
  };
  assert(isSyncroLlmReady(gateCell, localMeta), "LLM cells ready after patch even if meta still local");
  const gateSession: SyncroSession = {
    session_id: "gate",
    device_id: "d",
    profile_id: "p",
    task_description: "t",
    user_location: { latitude: 0, longitude: 0, timezone: "Asia/Shanghai" },
    matrix: {},
    locale: "zh",
    is_free: false,
    cost_usd: 0,
    llm_meta: localMeta,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 86400000),
  };
  for (const d of ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const) {
    gateSession.matrix[matrixKey("wu", d)] = { ...gateCell, direction_id: d };
  }
  assert(
    isHourPeriodLlmReady(gateSession.matrix, "wu", localMeta),
    "compass gate hour ready when 8 cells patched (model may stay local)",
  );

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
  const llmMeta = { model: "gpt", tokens_used: 1000, latency_ms: 0 };
  const markLlmReady = (h: (typeof HOUR_ORDER)[number]) => {
    for (const d of dirs) {
      const c = matrix[matrixKey(h, d)]!;
      c.llm_pending = false;
      c.short_advice = `LLM ${h} ${d}`;
      c.detailed_advice = "detail";
      c.rationale = "why";
    }
  };

  assert(getHourDotStatus(live, live, matrix, [...order], llmMeta) === "now", "live hour is now");
  assert(getHourDotStatus("wei", live, matrix, [...order], llmMeta) === "pending", "wei still pending");
  assert(getHourDotStatus("shen", live, matrix, [...order], llmMeta) === "pending", "shen waits for live wu");
  markLlmReady(live);
  assert(getHourDotStatus("shen", live, matrix, [...order], llmMeta) === "pending", "shen waits for wei");
  markLlmReady("wei");
  markLlmReady("shen");
  assert(getHourDotStatus("shen", live, matrix, [...order], llmMeta) === "done", "shen done after predecessors");

  console.log("\n✅ Syncro TST Step 6 — three-mode UI OK");
}

main();
