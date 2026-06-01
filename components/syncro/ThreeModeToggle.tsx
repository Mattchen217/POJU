"use client";

import { IconCamera, IconCompass, IconMap2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import type { SyncroUiMode } from "@/lib/syncro/syncro-view-helpers";

export type ThreeModeToggleProps = {
  mode: SyncroUiMode;
  onChange: (mode: SyncroUiMode) => void;
};

export function ThreeModeToggle({ mode, onChange }: ThreeModeToggleProps) {
  const t = useTranslations("syncro.modes");

  return (
    <div className="three-mode-toggle" role="tablist" aria-label={t("aria_label")}>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "compass"}
        className={`mode-tab ${mode === "compass" ? "active" : ""}`}
        onClick={() => onChange("compass")}
      >
        <IconCompass size={13} stroke={1.75} aria-hidden />
        <span>{t("compass")}</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={mode === "ar"}
        className={`mode-tab ${mode === "ar" ? "active" : ""}`}
        onClick={() => onChange("ar")}
      >
        <IconCamera size={13} stroke={1.75} aria-hidden />
        <span>{t("ar")}</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={mode === "map"}
        className={`mode-tab ${mode === "map" ? "active" : ""}`}
        onClick={() => onChange("map")}
      >
        <IconMap2 size={13} stroke={1.75} aria-hidden />
        <span>{t("map")}</span>
      </button>
    </div>
  );
}
