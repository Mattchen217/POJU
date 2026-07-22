"use client";

import { useTranslations } from "next-intl";

export function AtmosPanel() {
  const t = useTranslations("workspace.atmos");

  return (
    <div className="workspace-panel">
      <h2 className="workspace-panel__headline">{t("headline")}</h2>
      <p className="workspace-panel__guidance">{t("guidance")}</p>
      <div className="workspace-glass-card workspace-coming-soon">
        <span className="workspace-coming-soon__badge">{t("badge")}</span>
        <h3 className="workspace-coming-soon__title">{t("title")}</h3>
        <p className="workspace-coming-soon__body">{t("body")}</p>
      </div>
    </div>
  );
}
