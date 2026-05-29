"use client";

import { useState } from "react";
import { IconCompass, IconLoader2 } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { SyncroParticleCircle } from "@/components/syncro/SyncroParticleCircle";
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
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-compass.css";

export type SyncroCompassModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  highlightMatrixKeys?: Set<string>;
};

export function SyncroCompassMode({
  session,
  locale,
  hourPeriod,
  highlightMatrixKeys,
}: SyncroCompassModeProps) {
  const t = useTranslations("syncro");
  const tLevels = useTranslations("syncro.levels");
  const resolvedLocale = useLocale();
  const isZh = locale.startsWith("zh");

  const { compassDegree, hasPermission, requestPermission, isSupported } = useOrientation();
  const [whyModalOpen, setWhyModalOpen] = useState(false);

  const currentDirection: DirectionId = compassDegreeToDirection(compassDegree);
  const cellKey = matrixKey(hourPeriod, currentDirection);
  const cell = session.matrix[cellKey];
  const llmHighlight = highlightMatrixKeys?.has(cellKey);

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

  if (!cell) {
    return (
      <div className="compass-loading" aria-busy="true">
        <IconLoader2 aria-hidden size={28} stroke={1.5} className="compass-loading-spin" />
      </div>
    );
  }

  const levelKey = getCurrentLevelI18nKey(cell.current_level);
  let levelTitle: string;
  try {
    levelTitle = tLevels(levelKey);
  } catch {
    levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
  }

  const dirInfo = DIRECTIONS[currentDirection];

  return (
    <div className={`syncro-immersive compass-mode ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      <div className="syncro-content-overlay">
        <div className="compass-particle-area">
          <SyncroParticleCircle rotation={-compassDegree} activeDirection={currentDirection} />

          <div className="center-info">
            <div className={`current-level ${currentLevelCssClass(cell.current_level)}`}>
              <div className="level-line">{levelTitle}</div>
            </div>

            <div className="cell-meta">
              <span>{isZh ? dirInfo.name_zh : dirInfo.name_en}</span>
              <span className="meta-divider">·</span>
              <span>
                {hourPeriodDisplayName(hourPeriod, resolvedLocale)} · {HOUR_PERIOD_RANGES[hourPeriod]}
              </span>
            </div>
          </div>
        </div>

        <div className="compass-footer syncro-info-bottom">
          <p className="short-advice">{cell.short_advice}</p>

          <button type="button" className="why-btn" onClick={() => setWhyModalOpen(true)}>
            {t("why_this_current")}
          </button>
        </div>
      </div>

      {whyModalOpen ? (
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
