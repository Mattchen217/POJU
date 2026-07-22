"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { WorkspaceAccountPlaceholder } from "@/components/workspace/WorkspaceAccountPlaceholder";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";

export function ProfilePanel() {
  const t = useTranslations("workspace.profile");

  return (
    <div className="workspace-panel">
      <h2 className="workspace-panel__headline">{t("headline")}</h2>
      <p className="workspace-panel__guidance">{t("guidance")}</p>

      <div className="workspace-glass-card mb-4 flex flex-col gap-4">
        <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
          {t("accountSection")}
        </p>
        <WorkspaceAccountPlaceholder />
        <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">{t("accountBody")}</p>
      </div>

      <div className="workspace-glass-card flex flex-col gap-4">
        <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
          {t("slotsSection")}
        </p>
        <WorkspaceProfileSlotBar showAddAffordance />
        <Link href="/profile/setup" className="workspace-link-btn self-start">
          {t("setupCta")}
        </Link>
      </div>
    </div>
  );
}
