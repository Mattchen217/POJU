"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function ArchivePanel() {
  const t = useTranslations("workspace.archive");

  return (
    <div className="workspace-panel">
      <h2 className="workspace-panel__headline">{t("headline")}</h2>
      <p className="workspace-panel__guidance">{t("guidance")}</p>
      <div className="workspace-glass-card flex flex-col items-start gap-4">
        <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">{t("body")}</p>
        <Link href="/archive" className="workspace-link-btn">
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
