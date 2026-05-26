"use client";

import { useTranslations } from "next-intl";

import {
  CURRENT_LEVELS,
  DIRECTIONS,
  type DirectionId,
} from "@/lib/syncro/current-system";
import { HOUR_PERIODS, type HourPeriod, type SyncroCombination } from "@/lib/syncro/types";

const DIRECTION_ORDER: DirectionId[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function SyncroDirectionLabels({
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

export function SyncroCenterInfo({
  combination,
  directionId,
  hourPeriod,
  showDetail,
  onToggleDetail,
  compact,
  locale,
}: {
  combination: SyncroCombination;
  directionId: DirectionId;
  hourPeriod: HourPeriod;
  showDetail: boolean;
  onToggleDetail: () => void;
  compact?: boolean;
  locale: string;
}) {
  const t = useTranslations("syncro.main");
  const isZh = locale.startsWith("zh");
  const levelInfo = CURRENT_LEVELS[combination.current_level];
  const directionInfo = DIRECTIONS[directionId];
  const periodLabel = isZh ? HOUR_PERIODS[hourPeriod].name_zh : HOUR_PERIODS[hourPeriod].name_en;

  return (
    <div className={`center-info ${compact ? "in-vr-frame" : ""}`}>
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
