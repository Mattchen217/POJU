"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import { SyncroPermissionGate } from "@/components/syncro/SyncroPermissionGate";
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
}: SyncroMainViewProps) {
  const t = useTranslations("syncro.main");
  const { isSupported, hasPermission, needsUserGesture } = useOrientation();
  const [compassGateDone, setCompassGateDone] = useState(false);

  const orderedPeriods = useMemo(() => getOrderedHourPeriodsFromSession(session), [session]);

  const [liveHourPeriod, setLiveHourPeriod] = useState<HourPeriod>(() => getCurrentHourPeriod());
  const [activeHour, setActiveHour] = useState<HourPeriod>(() => getCurrentHourPeriod());
  const [uiMode, setUiMode] = useState<SyncroUiMode>("compass");
  const [initialized, setInitialized] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [activeDirection, setActiveDirection] = useState<DirectionId>("E");

  useEffect(() => {
    void loadSyncroPermission().then((perms) => {
      setCameraGranted(perms.camera);
    });
  }, []);

  useEffect(() => {
    if (!isSupported) {
      setCompassGateDone(true);
    }
  }, [isSupported]);

  useEffect(() => {
    if (hasPermission) {
      setCompassGateDone(true);
    }
  }, [hasPermission]);

  useEffect(() => {
    const scope = readTaskTimeScope();
    setUiMode(getInitialSyncroUiMode({ taskTimeScope: scope, orientationSupported: isSupported }));
    setInitialized(true);
  }, [isSupported]);

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
    setUiMode(mode);
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

  const showCompassGate = isSupported && needsUserGesture && !compassGateDone && !hasPermission;

  if (showCompassGate) {
    return (
      <div className="syncro-main-view syncro-main">
        <SyncroPermissionGate
          onGranted={() => setCompassGateDone(true)}
          onSkip={() => setCompassGateDone(true)}
        />
      </div>
    );
  }

  return (
    <div className={`syncro-main-view syncro-main syncro-main-view--${uiMode}`}>
      <HourProgressBar
        matrix={session.matrix}
        orderedPeriods={orderedPeriods}
        livePeriod={liveHourPeriod}
        activeHour={effectivePeriod}
        onSelect={setActiveHour}
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

      <ThreeModeToggle mode={uiMode} onChange={handleModeChange} />
    </div>
  );
}
