"use client";

import { useTranslations } from "next-intl";

import type { SyncroUiMode } from "@/lib/syncro/syncro-view-helpers";

export type ModeSwitcherProps = {
  mode: SyncroUiMode;
  onModeChange: (mode: SyncroUiMode) => void;
  compassAvailable: boolean;
};

export function ModeSwitcher({ mode, onModeChange, compassAvailable }: ModeSwitcherProps) {
  const t = useTranslations("syncro.modes");

  const items: { id: SyncroUiMode; label: string; disabled?: boolean }[] = [
    { id: "compass", label: t("compass"), disabled: !compassAvailable },
    { id: "ar", label: t("ar") },
    { id: "view", label: t("view") },
  ];

  return (
    <div className="syncro-mode-switcher" role="tablist" aria-label={t("aria_label")}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          disabled={item.disabled}
          className={`syncro-mode-switcher-btn ${mode === item.id ? "active" : ""}`}
          onClick={() => onModeChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
