"use client";

import { useEffect, useState } from "react";
import { IconCompass, IconDeviceMobile, IconLoader2 } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { SyncroDirectionRing } from "@/components/syncro/SyncroDirectionRing";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import {
  compassDegreeToDirection,
  currentLevelCssClass,
  DIRECTIONS,
  type DirectionId,
} from "@/lib/syncro/current-system";
import {
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { matrixKey, type HourPeriod, type SyncroCombination, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-compass.css";

export type SyncroCompassModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  highlightMatrixKeys?: Set<string>;
};

function FlatPhoneHint() {
  const t = useTranslations("syncro.compass");
  return (
    <div className="phone-position-hint">
      <IconDeviceMobile aria-hidden size={14} stroke={1.75} className="phone-position-hint-icon" />
      <span>{t("hold_phone_flat")}</span>
    </div>
  );
}

function CenterCurrentDisplay({
  cell,
  hourPeriod,
  currentDirection,
  isZh,
  levelTitle,
}: {
  cell: SyncroCombination;
  hourPeriod: HourPeriod;
  currentDirection: DirectionId;
  isZh: boolean;
  levelTitle: string;
}) {
  const resolvedLocale = useLocale();
  const dirInfo = DIRECTIONS[currentDirection];

  return (
    <div className="current-display">
      <div className={`current-level ${currentLevelCssClass(cell.current_level)}`}>
        <div className="level-line">{levelTitle}</div>
      </div>
      <div className="current-meta">
        <span>{isZh ? dirInfo.name_zh : dirInfo.name_en}</span>
        <span className="meta-divider">·</span>
        <span>
          {hourPeriodDisplayName(hourPeriod, resolvedLocale)} · {HOUR_PERIOD_RANGES[hourPeriod]}
        </span>
      </div>
    </div>
  );
}

export function SyncroCompassMode({
  session,
  locale,
  hourPeriod,
  highlightMatrixKeys,
}: SyncroCompassModeProps) {
  const t = useTranslations("syncro");
  const tLevels = useTranslations("syncro.levels");
  const isZh = locale.startsWith("zh");

  const { compassDegree, hasPermission, requestPermission, isSupported } = useOrientation();
  const [whyModalOpen, setWhyModalOpen] = useState(false);

  const currentDirection: DirectionId = compassDegreeToDirection(compassDegree);
  const cellKey = matrixKey(hourPeriod, currentDirection);
  const cell = session.matrix[cellKey];
  const llmHighlight = highlightMatrixKeys?.has(cellKey);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("[Compass] cell lookup:", {
      activeHour: hourPeriod,
      currentDirection,
      cellKey,
      found: !!cell,
      has_llm_advice: !!cell?.short_advice && !cell.short_advice.startsWith("[FALLBACK]"),
      is_fallback: cell?.llm_pending ?? !cell,
      cell_data: cell,
    });
  }, [hourPeriod, currentDirection, cellKey, cell]);

  if (!isSupported) {
    return (
      <div className="compass-permission-needed">
        <p className="compass-unsupported">{t("main.not_supported")}</p>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="compass-permission-needed">
        <div className="permission-icon">
          <IconCompass aria-hidden size={32} stroke={1.5} />
        </div>
        <h3>{t("compass.permission_title")}</h3>
        <p>{t("compass.permission_description")}</p>
        <button type="button" className="permission-btn" onClick={() => void requestPermission()}>
          {t("compass.grant_access")}
        </button>
      </div>
    );
  }

  const levelKey = cell ? getCurrentLevelI18nKey(cell.current_level) : null;
  let levelTitle = "";
  if (cell && levelKey) {
    try {
      levelTitle = tLevels(levelKey);
    } catch {
      levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
    }
  }

  return (
    <div className={`syncro-immersive compass-mode ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      <FlatPhoneHint />

      <div className="syncro-content-overlay compass-mode-body">
        <div className="concentric-system">
          <div
            className="rotating-layer"
            style={{
              transform: `rotate(${-compassDegree}deg)`,
              transition: "transform 200ms ease-out",
            }}
          >
            <SyncroParticleCore />
            <SyncroDirectionRing activeDirection={currentDirection} />
          </div>

          <div className="center-info-layer">
            {!cell ? (
              <div className="no-data" aria-busy="true">
                <IconLoader2 aria-hidden size={20} stroke={1.5} className="no-data-spin" />
                <span>{t("generating")}</span>
              </div>
            ) : (
              <CenterCurrentDisplay
                cell={cell}
                hourPeriod={hourPeriod}
                currentDirection={currentDirection}
                isZh={isZh}
                levelTitle={levelTitle}
              />
            )}
          </div>
        </div>

        {cell ? (
          <>
            <p className="compass-short-advice">{cell.short_advice}</p>
            <div className="compass-bottom-cta">
              <button type="button" className="why-btn-prominent" onClick={() => setWhyModalOpen(true)}>
                {t("why_this_current")}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {whyModalOpen && cell ? (
        <WhyThisCurrentModal
          cell={cell}
          direction={currentDirection}
          hourId={hourPeriod}
          onClose={() => setWhyModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
