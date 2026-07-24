"use client";

import { useTranslations } from "next-intl";

import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import { EnergyPortraitGlyph, EnergyReportGlyph } from "@/components/ui/A4PaperSheet";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";

type Props = {
  visible: boolean;
  onOpenPanel: () => void;
};

/**
 * Collapsed right-rail icon stack: energy matrix + base report (with spin when generating).
 */
export function WorkspaceRightCollapsedIcons({ visible, onOpenPanel }: Props) {
  const t = useTranslations("workspace.pojuRail");
  const prepare = useWorkspacePojuPrepareOptional();

  if (!visible || !prepare) return null;

  const hasMatrix = Boolean(prepare.matrixPayload);
  const generating = prepare.baseReportStatus === "generating";
  const reportReady =
    prepare.baseReportStatus === "ready" && Boolean(prepare.baseReportText);
  const showReport = generating || reportReady;
  const matrixUnread = hasMatrix && prepare.matrixUnread;
  const reportUnread = reportReady && prepare.reportUnread;

  if (!hasMatrix && !showReport) return null;

  return (
    <div className="workspace-right-collapsed-icons" role="toolbar" aria-label={t("collapsedRailLabel")}>
      {hasMatrix ? (
        <button
          type="button"
          className="workspace-right-collapsed-icons__btn"
          aria-label={t("matrixIconLabel")}
          data-tooltip={t("matrixIconLabel")}
          onClick={(e) => {
            e.stopPropagation();
            prepare.setReportExpanded(false);
            prepare.setMatrixExpanded(true);
            onOpenPanel();
          }}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <EnergyPortraitGlyph className="workspace-right-collapsed-icons__portrait" />
          </span>
          {matrixUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}

      {showReport ? (
        <button
          type="button"
          className={`workspace-right-collapsed-icons__btn${
            generating ? " is-generating" : ""
          }`}
          aria-label={
            generating ? t("reportGeneratingIconLabel") : t("reportIconLabel")
          }
          data-tooltip={
            generating ? t("reportGeneratingIconLabel") : t("reportIconLabel")
          }
          aria-busy={generating || undefined}
          onClick={(e) => {
            e.stopPropagation();
            prepare.setMatrixExpanded(false);
            if (reportReady) {
              prepare.setReportExpanded(true);
            }
            onOpenPanel();
          }}
        >
          {generating ? (
            <span className="workspace-right-collapsed-icons__spin" aria-hidden />
          ) : null}
          <span className="workspace-sidebar__icon" aria-hidden>
            <EnergyReportGlyph className="workspace-right-collapsed-icons__report" />
          </span>
          {reportUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
