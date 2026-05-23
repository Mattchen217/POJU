"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import { SyncroSplineCanvas } from "@/components/syncro/SyncroSplineCanvas";
import { SyncroTimerBar } from "@/components/syncro/SyncroTimerBar";
import { SyncroVRMode } from "@/components/syncro/SyncroVRMode";
import {
  compassToDirection,
  CURRENT_LEVELS,
  DIRECTIONS,
  type DirectionId,
} from "@/lib/syncro/current-system";
import {
  getCurrentHourPeriod,
  HOUR_PERIODS,
  matrixKey,
  type HourPeriod,
  type SyncroCombination,
  type SyncroSession,
} from "@/lib/syncro/types";

export type SyncroMainViewProps = {
  session: SyncroSession;
  locale: string;
};

export function SyncroMainView({ session, locale }: SyncroMainViewProps) {
  const t = useTranslations("syncro.main");
  const { compassDegree, hasPermission, requestPermission, isSupported } = useOrientation();

  const [showDetail, setShowDetail] = useState(false);
  const [vrMode, setVrMode] = useState(false);
  const [currentHourPeriod, setCurrentHourPeriod] = useState<HourPeriod>(() => getCurrentHourPeriod());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = getCurrentHourPeriod();
      setCurrentHourPeriod((prev) => (next !== prev ? next : prev));
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const { primary: currentDirection } = compassToDirection(compassDegree);
  const key = matrixKey(currentHourPeriod, currentDirection);
  const combination = session.matrix[key];

  if (!combination) {
    return (
      <div className="syncro-error flex min-h-screen items-center justify-center bg-bg-deep px-4 text-center text-text-secondary">
        <p>{t("combination_not_found")}</p>
        <p className="mt-2 font-mono text-xs text-text-dim">{key}</p>
      </div>
    );
  }

  const levelInfo = CURRENT_LEVELS[combination.current_level];
  const directionInfo = DIRECTIONS[currentDirection];
  const isZh = locale.startsWith("zh");

  return (
    <div className={`syncro-main-view ${vrMode ? "vr-mode" : ""}`}>
      <SyncroTimerBar currentHourPeriod={currentHourPeriod} locale={locale} />

      <DirectionLabels
        compassDegree={compassDegree}
        activeDirection={currentDirection}
        locale={locale}
      />

      <SyncroSplineCanvas compassDegree={compassDegree} vrMode={vrMode} />

      {vrMode ? <SyncroVRMode /> : null}

      <CenterInfo
        combination={combination}
        levelInfo={levelInfo}
        directionInfo={directionInfo}
        periodLabel={isZh ? HOUR_PERIODS[currentHourPeriod].name_zh : HOUR_PERIODS[currentHourPeriod].name_en}
        showDetail={showDetail}
        onToggleDetail={() => setShowDetail((v) => !v)}
        vrMode={vrMode}
        locale={locale}
      />

      <BottomControls
        vrMode={vrMode}
        onToggleVR={() => setVrMode((v) => !v)}
        hasPermission={hasPermission}
        onRequestPermission={requestPermission}
        isSupported={isSupported}
      />
    </div>
  );
}

const DIRECTION_ORDER: DirectionId[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function DirectionLabels({
  compassDegree,
  activeDirection,
  locale,
}: {
  compassDegree: number;
  activeDirection: DirectionId;
  locale: string;
}) {
  const isZh = locale.startsWith("zh");

  return (
    <div
      className="direction-labels-container"
      style={{ transform: `rotate(${-compassDegree}deg)` }}
    >
      {DIRECTION_ORDER.map((dir, idx) => {
        const angle = idx * 45 - 90;
        const isActive = dir === activeDirection;
        const info = DIRECTIONS[dir];

        return (
          <div
            key={dir}
            className={`direction-label ${isActive ? "active" : ""}`}
            style={{
              transform: `
                rotate(${angle}deg)
                translateX(45vmin)
                rotate(${-angle + compassDegree}deg)
              `,
            }}
          >
            <span className="dir-symbol">{isZh ? info.name_zh : info.name_en}</span>
          </div>
        );
      })}
    </div>
  );
}

function CenterInfo({
  combination,
  levelInfo,
  directionInfo,
  periodLabel,
  showDetail,
  onToggleDetail,
  vrMode,
  locale,
}: {
  combination: SyncroCombination;
  levelInfo: (typeof CURRENT_LEVELS)[keyof typeof CURRENT_LEVELS];
  directionInfo: (typeof DIRECTIONS)[DirectionId];
  periodLabel: string;
  showDetail: boolean;
  onToggleDetail: () => void;
  vrMode: boolean;
  locale: string;
}) {
  const t = useTranslations("syncro.main");
  const isZh = locale.startsWith("zh");

  return (
    <div className={`center-info ${vrMode ? "in-vr-frame" : ""}`}>
      <div className="current-level-badge" style={{ color: levelInfo.color_hex }}>
        {isZh ? levelInfo.name_zh : levelInfo.name_en}
        <span className="dot" style={{ background: levelInfo.color_hex }} aria-hidden />
      </div>

      <div className="dir-hour">
        {isZh ? directionInfo.name_zh : directionInfo.name_en}
        <span className="separator">·</span>
        {periodLabel}
        <span className="separator">·</span>
        {t("current_hour")}
      </div>

      <p className="short-advice">{combination.short_advice}</p>

      {!showDetail ? (
        <button type="button" onClick={onToggleDetail} className="why-button">
          {t("why_this")} ↓
        </button>
      ) : null}

      {showDetail ? (
        <div className="detail-section">
          <h4>{t("detailed_label")}</h4>
          <p>{combination.detailed_advice}</p>

          <h4>{t("rationale_label")}</h4>
          <p>{combination.rationale}</p>

          <button type="button" onClick={onToggleDetail} className="collapse-button">
            {t("collapse")} ↑
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BottomControls({
  vrMode,
  onToggleVR,
  hasPermission,
  onRequestPermission,
  isSupported,
}: {
  vrMode: boolean;
  onToggleVR: () => void;
  hasPermission: boolean;
  onRequestPermission: () => Promise<boolean>;
  isSupported: boolean;
}) {
  const t = useTranslations("syncro.main");

  if (!isSupported) {
    return (
      <div className="bottom-controls error">
        <p>{t("not_supported")}</p>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="bottom-controls">
        <button
          type="button"
          onClick={() => void onRequestPermission()}
          className="permission-button"
        >
          {t("enable_compass")}
        </button>
      </div>
    );
  }

  return (
    <div className="bottom-controls">
      <button
        type="button"
        onClick={onToggleVR}
        className={`vr-toggle ${vrMode ? "active" : ""}`}
      >
        {vrMode ? t("exit_vr") : t("enable_vr")}
      </button>
    </div>
  );
}
