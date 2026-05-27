"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { HourProgressBar } from "@/components/syncro/HourProgressBar";
import { ModeSwitcher } from "@/components/syncro/ModeSwitcher";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import { SyncroARMode } from "@/components/syncro/SyncroARMode";
import { SyncroCompassMode } from "@/components/syncro/SyncroCompassMode";
import { SyncroTimerBar } from "@/components/syncro/SyncroTimerBar";
import { SyncroViewMode } from "@/components/syncro/SyncroViewMode";
import {
  getInitialSyncroUiMode,
  getOrderedHourPeriodsFromSession,
  tiltSuggestsMode,
  type SyncroTaskTimeScope,
  type SyncroUiMode,
} from "@/lib/syncro/syncro-view-helpers";
import { getCurrentHourPeriod, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

export type SyncroMainViewProps = {
  session: SyncroSession;
  locale: string;
  /** Keys recently updated by LLM batches (fade-in highlight). */
  highlightMatrixKeys?: Set<string>;
};

function readTaskTimeScope(): SyncroTaskTimeScope {
  if (typeof window === "undefined") return "now";
  const raw = sessionStorage.getItem("syncro_task_time");
  return raw === "planning" ? "planning" : "now";
}

export function SyncroMainView({ session, locale, highlightMatrixKeys }: SyncroMainViewProps) {
  const t = useTranslations("syncro.main");
  const { isSupported, deviceTiltBeta } = useOrientation();

  const orderedPeriods = useMemo(() => getOrderedHourPeriodsFromSession(session), [session]);

  const [liveHourPeriod, setLiveHourPeriod] = useState<HourPeriod>(() => getCurrentHourPeriod());
  const [selectedHourPeriod, setSelectedHourPeriod] = useState<HourPeriod>(() => getCurrentHourPeriod());
  const [uiMode, setUiMode] = useState<SyncroUiMode>("compass");
  const [modePinned, setModePinned] = useState(false);
  const [initialized, setInitialized] = useState(false);

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
          setSelectedHourPeriod((sel) => (sel === prev ? next : sel));
        }
        return next;
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (modePinned || uiMode === "view") return;
    const suggested = tiltSuggestsMode(deviceTiltBeta);
    if (suggested && suggested !== uiMode) {
      setUiMode(suggested);
    }
  }, [deviceTiltBeta, modePinned, uiMode]);

  function handleModeChange(mode: SyncroUiMode) {
    setModePinned(true);
    setUiMode(mode);
  }

  const effectivePeriod = orderedPeriods.includes(selectedHourPeriod)
    ? selectedHourPeriod
    : orderedPeriods[0] ?? liveHourPeriod;

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
    <div className={`syncro-main-view syncro-main-view--${uiMode}`}>
      <SyncroTimerBar currentHourPeriod={effectivePeriod} locale={locale} />

      <HourProgressBar
        orderedPeriods={orderedPeriods}
        livePeriod={liveHourPeriod}
        selectedPeriod={effectivePeriod}
        onSelectPeriod={setSelectedHourPeriod}
        locale={locale}
      />

      <div className="syncro-mode-stage">
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
          />
        ) : null}
        {uiMode === "view" ? (
          <SyncroViewMode
            session={session}
            locale={locale}
            hourPeriod={effectivePeriod}
            highlightMatrixKeys={highlightMatrixKeys}
          />
        ) : null}
      </div>

      <ModeSwitcher
        mode={uiMode}
        onModeChange={handleModeChange}
        compassAvailable={isSupported}
      />
    </div>
  );
}
