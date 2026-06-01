"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import { ThreeModeToggle } from "@/components/syncro/ThreeModeToggle";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import { SyncroARMode } from "@/components/syncro/SyncroARMode";
import { SyncroCompassMode } from "@/components/syncro/SyncroCompassMode";
import { SyncroMapMode } from "@/components/syncro/SyncroMapMode";
import type { SyncroLlmProgress } from "@/components/syncro/SyncroLlmBatchRunner";
import type { DirectionId } from "@/lib/syncro/current-system";
import { loadSyncroPermission, saveSyncroPermission } from "@/lib/syncro/permissions";
import {
  findBestDirectionForPeriod,
  getOrderedHourPeriodsFromSession,
  getInitialSyncroUiMode,
  type SyncroTaskTimeScope,
  type SyncroUiMode,
} from "@/lib/syncro/syncro-view-helpers";
import { getCurrentHourPeriod, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-hour-progress.css";
import "@/styles/syncro-layout.css";

export type SyncroMainViewProps = {
  session: SyncroSession;
  locale: string;
  highlightMatrixKeys?: Set<string>;
  llmProgress?: SyncroLlmProgress;
  /** Live hour LLM copy is ready — compass/AR allowed. */
  liveHourReady?: boolean;
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
}: SyncroMainViewProps) {
  const t = useTranslations("syncro.main");
  const { isSupported, receivingHeading, requestPermissionFromUserGesture } = useOrientation();
  const rootRef = useRef<HTMLDivElement>(null);
  const autoCompassOnceRef = useRef(false);

  const orderedPeriods = useMemo(() => getOrderedHourPeriodsFromSession(session), [session]);

  const [liveHourPeriod, setLiveHourPeriod] = useState<HourPeriod>(() => getCurrentHourPeriod());
  const [activeHour, setActiveHour] = useState<HourPeriod>(() => getCurrentHourPeriod());
  const [uiMode, setUiMode] = useState<SyncroUiMode>("compass");
  const [initialized, setInitialized] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [activeDirection, setActiveDirection] = useState<DirectionId>("E");

  const tryActivateCompass = useCallback(() => {
    if (!isSupported || receivingHeading) return;
    void requestPermissionFromUserGesture();
  }, [isSupported, receivingHeading, requestPermissionFromUserGesture]);

  useEffect(() => {
    void loadSyncroPermission().then((perms) => {
      setCameraGranted(perms.camera);
    });
  }, []);

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

  /** Auto-enable compass: Android on mount; iOS on mount attempt + any touch on Syncro. */
  useEffect(() => {
    if (!isSupported || receivingHeading) return;
    tryActivateCompass();
  }, [isSupported, receivingHeading, tryActivateCompass]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || receivingHeading) return;

    const onPointerDown = () => tryActivateCompass();
    root.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => root.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [receivingHeading, tryActivateCompass]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = getCurrentHourPeriod();
      setLiveHourPeriod((prev) => {
        if (next !== prev) {
          setActiveHour((sel) => (sel === prev ? next : sel));
        }
        return next;
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setActiveDirection(findBestDirectionForPeriod(session, activeHour));
  }, [session, activeHour]);

  async function requestCameraPermission() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraGranted(true);
      await saveSyncroPermission("camera", true);
    } catch (e) {
      console.error("[syncro] camera permission denied", e);
    }
  }

  function handleModeChange(mode: SyncroUiMode) {
    if ((mode === "compass" || mode === "ar") && !liveHourReady) return;
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
    : (orderedPeriods[0] ?? liveHourPeriod);

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
      <HourProgressBar
        matrix={session.matrix}
        llmMeta={session.llm_meta}
        orderedPeriods={orderedPeriods}
        livePeriod={liveHourPeriod}
        activeHour={effectivePeriod}
        onSelect={handleHourSelect}
        locale={locale}
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
