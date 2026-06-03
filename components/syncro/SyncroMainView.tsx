"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import { SyncroPermissionGate } from "@/components/syncro/SyncroPermissionGate";
import { ThreeModeToggle } from "@/components/syncro/ThreeModeToggle";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import { SyncroARMode } from "@/components/syncro/SyncroARMode";
import { SyncroCompassMode } from "@/components/syncro/SyncroCompassMode";
import { SyncroMapMode } from "@/components/syncro/SyncroMapMode";
import type { SyncroLlmProgress } from "@/lib/syncro/syncro-llm-progress";
import type { DirectionId } from "@/lib/syncro/current-system";
import {
  getSyncroPermissionStatus,
  readSyncroPermissionSync,
  requestSyncroCameraPermission,
  syncCameraPermissionFromBrowser,
} from "@/lib/syncro/permissions";
import { deviceOrientationRequiresPermissionPrompt } from "@/lib/syncro/compass-permission-ios";
import {
  findBestDirectionForPeriod,
  getOrderedHourPeriodsFromSession,
  getInitialSyncroUiMode,
  type SyncroTaskTimeScope,
  type SyncroUiMode,
} from "@/lib/syncro/syncro-view-helpers";
import {
  getLivePeriodInSubmissionTimeline,
  getSubmissionTimelineState,
  isSubmissionTimelineComplete,
} from "@/lib/syncro/syncro-submission-schedule";
import type { SyncroBackgroundStreamState } from "@/lib/syncro/use-syncro-background-stream";
import type { HourPeriod, SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-hour-progress.css";
import "@/styles/syncro-layout.css";
import "@/styles/syncro-compass.css";

export type SyncroMainViewProps = {
  session: SyncroSession;
  locale: string;
  highlightMatrixKeys?: Set<string>;
  llmProgress?: SyncroLlmProgress;
  /** Live hour LLM copy is ready — compass/AR allowed. */
  liveHourReady?: boolean;
  backgroundStream?: SyncroBackgroundStreamState;
  onRetryHour?: (hourId: HourPeriod) => void;
  retryingHour?: HourPeriod | null;
  /** Fired once when the 12-slot submission window has ended. */
  onTimelineComplete?: () => void;
};

function readTaskTimeScope(): SyncroTaskTimeScope {
  if (typeof window === "undefined") return "now";
  const raw = sessionStorage.getItem("syncro_task_time");
  return raw === "planning" ? "planning" : "now";
}

export function SyncroMainView({
  session,
  locale,
  highlightMatrixKeys,
  llmProgress,
  liveHourReady = true,
  backgroundStream,
  onRetryHour,
  retryingHour = null,
  onTimelineComplete,
}: SyncroMainViewProps) {
  const t = useTranslations("syncro.main");
  const { isSupported, receivingHeading, requestPermissionFromUserGesture } = useOrientation();
  const rootRef = useRef<HTMLDivElement>(null);
  const autoCompassOnceRef = useRef(false);

  const orderedPeriods = useMemo(() => getOrderedHourPeriodsFromSession(session), [session]);

  const initialTimeline = useMemo(() => getSubmissionTimelineState(session), [session]);

  const [liveHourPeriod, setLiveHourPeriod] = useState<HourPeriod | null>(
    () => initialTimeline.livePeriod,
  );
  const [activeHour, setActiveHour] = useState<HourPeriod>(() => {
    const live = initialTimeline.livePeriod;
    if (live && orderedPeriods.includes(live)) return live;
    return orderedPeriods[0] ?? "zi";
  });
  const [uiMode, setUiMode] = useState<SyncroUiMode>("compass");
  const [initialized, setInitialized] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(
    () => readSyncroPermissionSync().camera,
  );
  const [activeDirection, setActiveDirection] = useState<DirectionId>("E");
  const [permissionGate, setPermissionGate] = useState<"hidden" | "initial" | "resume">("hidden");
  const permissionsCheckedRef = useRef(false);

  const tryActivateCompass = useCallback(() => {
    if (!isSupported || receivingHeading) return;
    void requestPermissionFromUserGesture();
  }, [isSupported, receivingHeading, requestPermissionFromUserGesture]);

  useEffect(() => {
    if (permissionsCheckedRef.current) return;
    permissionsCheckedRef.current = true;

    void syncCameraPermissionFromBrowser().then((cameraOk) => {
      if (cameraOk) setCameraGranted(true);
    });

    void getSyncroPermissionStatus().then((status) => {
      setCameraGranted(status.camera);

      if (!isSupported) {
        setPermissionGate("hidden");
        return;
      }

      if (status.allGranted) {
        setPermissionGate(deviceOrientationRequiresPermissionPrompt() ? "resume" : "hidden");
        return;
      }

      if (status.orientation && status.camera) {
        setPermissionGate("hidden");
        return;
      }

      setPermissionGate("initial");
    });
  }, [isSupported]);

  useEffect(() => {
    if (receivingHeading && permissionGate !== "hidden") {
      setPermissionGate("hidden");
    }
  }, [receivingHeading, permissionGate]);

  useEffect(() => {
    const scope = readTaskTimeScope();
    const preferred = getInitialSyncroUiMode({ taskTimeScope: scope, orientationSupported: isSupported });
    setUiMode(liveHourReady ? preferred : "map");
    setInitialized(true);
  }, [isSupported, liveHourReady]);

  useEffect(() => {
    if (!liveHourReady) {
      autoCompassOnceRef.current = false;
      if (uiMode === "compass" || uiMode === "ar") setUiMode("map");
      return;
    }
    if (autoCompassOnceRef.current) return;
    const scope = readTaskTimeScope();
    if (scope === "now" && isSupported) {
      setUiMode("compass");
      autoCompassOnceRef.current = true;
    }
  }, [liveHourReady, isSupported, uiMode]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || receivingHeading || permissionGate === "hidden") return;

    const onPointerDown = () => tryActivateCompass();
    root.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => root.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [receivingHeading, permissionGate, tryActivateCompass]);

  useEffect(() => {
    const syncLiveHour = () => {
      if (isSubmissionTimelineComplete(session)) {
        onTimelineComplete?.();
        return;
      }

      const next = getLivePeriodInSubmissionTimeline(session);
      setLiveHourPeriod((prev) => {
        if (next !== prev) {
          setActiveHour((sel) => {
            if (prev !== null && sel === prev && next) return next;
            return sel;
          });
        }
        return next;
      });
    };

    syncLiveHour();

    const interval = window.setInterval(syncLiveHour, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") syncLiveHour();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, onTimelineComplete]);

  useEffect(() => {
    setActiveDirection(findBestDirectionForPeriod(session, activeHour));
  }, [session, activeHour]);

  async function requestCameraPermission() {
    const ok = await requestSyncroCameraPermission();
    setCameraGranted(ok);
  }

  function handlePermissionGateReady(result: { cameraGranted: boolean }) {
    setCameraGranted(result.cameraGranted);
    setPermissionGate("hidden");
  }

  function handleModeChange(mode: SyncroUiMode) {
    if ((mode === "compass" || mode === "ar") && !liveHourReady) return;

    if (mode === "ar") {
      const cachedCamera = readSyncroPermissionSync().camera;
      if (cachedCamera) {
        setCameraGranted(true);
      }
    }

    if ((mode === "compass" || mode === "ar") && !receivingHeading && isSupported && permissionGate === "hidden") {
      void getSyncroPermissionStatus().then((status) => {
        if (mode === "ar" && status.camera) {
          setCameraGranted(true);
          return;
        }
        if (status.orientation && mode === "ar") {
          return;
        }
        if (status.allGranted) {
          setPermissionGate(deviceOrientationRequiresPermissionPrompt() ? "resume" : "hidden");
          return;
        }
        if (!status.orientation) {
          setPermissionGate("initial");
        }
      });
    }
    if (mode === "compass" || mode === "ar") {
      tryActivateCompass();
    }
    setUiMode(mode);
  }

  function handleHourSelect(period: HourPeriod) {
    tryActivateCompass();
    setActiveHour(period);
  }

  const effectivePeriod = orderedPeriods.includes(activeHour)
    ? activeHour
    : (liveHourPeriod && orderedPeriods.includes(liveHourPeriod)
        ? liveHourPeriod
        : (orderedPeriods[0] ?? "zi"));

  if (!initialized) {
    return (
      <div className="syncro-main-view flex min-h-screen items-center justify-center bg-bg-deep text-text-dim">
        …
      </div>
    );
  }

  const hasAnyCell = Object.keys(session.matrix).length > 0;
  if (!hasAnyCell) {
    return (
      <div className="syncro-error flex min-h-screen items-center justify-center bg-bg-deep px-4 text-center text-text-secondary">
        <p>{t("combination_not_found")}</p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`syncro-main-view syncro-main syncro-main-view--${uiMode}`}
    >
      {permissionGate !== "hidden" ? (
        <SyncroPermissionGate
          layout="fullscreen"
          variant={permissionGate}
          onReady={handlePermissionGateReady}
        />
      ) : null}

      <HourProgressBar
        matrix={session.matrix}
        llmMeta={session.llm_meta}
        orderedPeriods={orderedPeriods}
        livePeriod={liveHourPeriod}
        activeHour={effectivePeriod}
        onSelect={handleHourSelect}
        onRetryHour={onRetryHour}
        retryingHour={retryingHour}
        locale={locale}
        failedHourIds={llmProgress?.failed_hours}
        progress={
          llmProgress
            ? {
                completed_batches: llmProgress.completed,
                total_batches: llmProgress.total,
              }
            : undefined
        }
      />

      <div className="syncro-display syncro-mode-stage">
        {uiMode === "compass" ? (
          <SyncroCompassMode
            session={session}
            locale={locale}
            hourPeriod={effectivePeriod}
            highlightMatrixKeys={highlightMatrixKeys}
            llmProgress={llmProgress}
            backgroundStream={backgroundStream}
          />
        ) : null}

        {uiMode === "ar" ? (
          <SyncroARMode
            session={session}
            locale={locale}
            hourPeriod={effectivePeriod}
            highlightMatrixKeys={highlightMatrixKeys}
            cameraGranted={cameraGranted}
            onRequestCamera={() => void requestCameraPermission()}
          />
        ) : null}

        {uiMode === "map" ? (
          <SyncroMapMode
            session={session}
            locale={locale}
            hourPeriod={effectivePeriod}
            activeDirection={activeDirection}
            onSelectDirection={setActiveDirection}
            highlightMatrixKeys={highlightMatrixKeys}
          />
        ) : null}
      </div>

      <ThreeModeToggle
        mode={uiMode}
        onChange={handleModeChange}
        compassDisabled={!liveHourReady}
        arDisabled={!liveHourReady}
      />
    </div>
  );
}
