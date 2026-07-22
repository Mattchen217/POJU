"use client";

import { useTranslations } from "next-intl";

import { ArchiveDetailClient } from "@/components/archive/archive-detail-client";

type Props = {
  archiveId: string;
  onBack: () => void;
};

/** Embed existing archive detail inside the workspace canvas. */
export function WorkspaceArchiveReportPanel({ archiveId, onBack }: Props) {
  const t = useTranslations("workspace.density");

  return (
    <div className="workspace-report">
      <div className="workspace-report__toolbar">
        <button type="button" className="workspace-report__back" onClick={onBack}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            arrow_back
          </span>
          {t("backToNew")}
        </button>
      </div>
      <div className="workspace-report__body workspace-glass-panel">
        <ArchiveDetailClient archiveId={archiveId} />
      </div>
    </div>
  );
}
