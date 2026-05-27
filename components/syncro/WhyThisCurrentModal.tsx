"use client";

import { useEffect } from "react";
import { IconBulb, IconX } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { getCurrentLevelFallbackLabel, getCurrentLevelI18nKey } from "@/lib/syncro/compass-display";
import {
  DIRECTIONS,
  currentLevelCssClass,
  type DirectionId,
} from "@/lib/syncro/current-system";
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import type { HourPeriod, SyncroCombination } from "@/lib/syncro/types";

import "@/styles/syncro-why-modal.css";

export type WhyThisCurrentModalProps = {
  cell: SyncroCombination;
  direction: DirectionId;
  hourId: HourPeriod;
  onClose: () => void;
};

export function WhyThisCurrentModal({ cell, direction, hourId, onClose }: WhyThisCurrentModalProps) {
  const t = useTranslations("syncro");
  const tLevels = useTranslations("syncro.levels");
  const locale = useLocale();
  const isZh = locale.startsWith("zh");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const dirInfo = DIRECTIONS[direction];
  const levelKey = getCurrentLevelI18nKey(cell.current_level);
  const levelTitle = (() => {
    try {
      return tLevels(levelKey);
    } catch {
      return getCurrentLevelFallbackLabel(cell.current_level, isZh);
    }
  })();

  const rationaleText = cell.rationale?.trim() || cell.detailed_advice?.trim() || "";
  const detailedText = cell.detailed_advice?.trim() || "";
  const showActionCard = Boolean(detailedText && cell.rationale?.trim());

  return (
    <div className="why-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="why-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="why-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="why-modal-close" onClick={onClose} aria-label={t("why_modal.close")}>
          <IconX aria-hidden size={14} stroke={1.75} />
        </button>

        <div id="why-modal-title" className="why-modal-tag">
          {t("why_this_current")}
        </div>

        <div className={`why-level ${currentLevelCssClass(cell.current_level)}`}>{levelTitle}</div>

        <div className="why-meta">
          <span>{isZh ? dirInfo.name_zh : dirInfo.name_en}</span>
          <span className="meta-divider">·</span>
          <span>
            {hourPeriodDisplayName(hourId, locale)} · {HOUR_PERIOD_RANGES[hourId]}
          </span>
        </div>

        <div className="why-divider" aria-hidden />

        <div className="why-rationale">{rationaleText}</div>

        {showActionCard ? (
          <div className="why-action-card">
            <IconBulb aria-hidden size={18} stroke={1.5} className="why-action-icon" />
            <span>{detailedText}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
