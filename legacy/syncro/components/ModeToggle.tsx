"use client";

import { useTranslations } from "next-intl";

export type ModeToggleTab = "compass" | "map";

export type ModeToggleProps = {
  mode: ModeToggleTab;
  onChange: (mode: ModeToggleTab) => void;
};

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const t = useTranslations("syncro.modes");

  return (
    <div className="syncro-mode-toggle" role="tablist" aria-label={t("aria_label")}>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "compass"}
        className={`syncro-mode-toggle-btn ${mode === "compass" ? "active" : ""}`}
        onClick={() => onChange("compass")}
      >
        {t("compass")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "map"}
        className={`syncro-mode-toggle-btn ${mode === "map" ? "active" : ""}`}
        onClick={() => onChange("map")}
      >
        {t("map")}
      </button>
    </div>
  );
}
