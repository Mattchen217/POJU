"use client";

import { useTranslations } from "next-intl";

import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import {
  DeliveryBookGlyph,
  EnergyPortraitGlyph,
  EnergyReportGlyph,
} from "@/components/ui/A4PaperSheet";
import { useWorkspaceAtmosPrepareOptional } from "@/components/workspace/WorkspaceAtmosPrepareContext";
import { useWorkspaceMatchPrepareOptional } from "@/components/workspace/WorkspaceMatchPrepareContext";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";

type Props = {
  visible: boolean;
  onOpenPanel: () => void;
};

/**
 * Collapsed right-rail icon stack.
 * POJU: energy matrix + base report.
 * Atmos: energy matrix only.
 * Match: energy portraits A/B + base-analysis report icons A/B (same glyphs as POJU).
 */
export function WorkspaceRightCollapsedIcons({ visible, onOpenPanel }: Props) {
  const t = useTranslations("workspace.pojuRail");
  const tBook = useTranslations("workspace.deliveryBook");
  const tAtmos = useTranslations("workspace.atmosRail");
  const tMatch = useTranslations("match.workspace");
  const prepare = useWorkspacePojuPrepareOptional();
  const atmos = useWorkspaceAtmosPrepareOptional();
  const match = useWorkspaceMatchPrepareOptional();

  if (!visible) return null;

  const atmosActive =
    atmos &&
    (atmos.phase === "exiting" || atmos.phase === "forecast") &&
    Boolean(atmos.matrixPayload);

  if (atmosActive && atmos) {
    return (
      <div className="workspace-right-collapsed-icons" role="toolbar" aria-label={tAtmos("matrixTitle")}>
        <button
          type="button"
          className="workspace-right-collapsed-icons__btn"
          aria-label={tAtmos("matrixTitle")}
          data-tooltip={tAtmos("matrixTitle")}
          onClick={(e) => {
            e.stopPropagation();
            atmos.setMatrixExpanded(true);
            onOpenPanel();
          }}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <EnergyPortraitGlyph className="workspace-right-collapsed-icons__portrait" />
          </span>
          {atmos.matrixUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      </div>
    );
  }

  const matchActive =
    match &&
    (match.phase === "inquiry" ||
      match.phase === "paywall" ||
      match.phase === "generating" ||
      match.phase === "delivery") &&
    (Boolean(match.matrixPayloadA) ||
      Boolean(match.matrixPayloadB) ||
      match.reportAStatus === "generating" ||
      match.reportBStatus === "generating" ||
      Boolean(match.reportAText) ||
      Boolean(match.reportBText));

  if (matchActive && match) {
    const hasA = Boolean(match.matrixPayloadA);
    const hasB = Boolean(match.matrixPayloadB);
    const aGenerating = match.reportAStatus === "generating";
    const bGenerating = match.reportBStatus === "generating";
    const aReportReady =
      match.reportAStatus === "ready" && Boolean(match.reportAText);
    const bReportReady =
      match.reportBStatus === "ready" && Boolean(match.reportBText);
    const showReportA = aGenerating || aReportReady;
    const showReportB = bGenerating || bReportReady;

    if (!hasA && !hasB && !showReportA && !showReportB) return null;

    const reportLabelA = tMatch("portrait_a", { title: t("reportIconLabel") });
    const reportLabelB = tMatch("portrait_b", { title: t("reportIconLabel") });
    const reportGeneratingA = tMatch("portrait_a", {
      title: t("reportGeneratingIconLabel"),
    });
    const reportGeneratingB = tMatch("portrait_b", {
      title: t("reportGeneratingIconLabel"),
    });

    return (
      <div className="workspace-right-collapsed-icons" role="toolbar" aria-label={t("collapsedRailLabel")}>
        {hasA ? (
          <button
            type="button"
            className="workspace-right-collapsed-icons__btn workspace-right-collapsed-icons__btn--slot"
            aria-label={tMatch("portrait_a", { title: t("matrixIconLabel") })}
            data-tooltip={tMatch("portrait_a", { title: t("matrixIconLabel") })}
            onClick={(e) => {
              e.stopPropagation();
              match.setMatrixExpandedA(true);
              onOpenPanel();
            }}
          >
            <span className="workspace-sidebar__icon" aria-hidden>
              <EnergyPortraitGlyph className="workspace-right-collapsed-icons__portrait" />
            </span>
            <span className="workspace-right-collapsed-icons__slot" aria-hidden>
              A
            </span>
            {match.matrixUnreadA ? (
              <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
            ) : null}
          </button>
        ) : null}

        {hasB ? (
          <button
            type="button"
            className="workspace-right-collapsed-icons__btn workspace-right-collapsed-icons__btn--slot"
            aria-label={tMatch("portrait_b", { title: t("matrixIconLabel") })}
            data-tooltip={tMatch("portrait_b", { title: t("matrixIconLabel") })}
            onClick={(e) => {
              e.stopPropagation();
              match.setMatrixExpandedB(true);
              onOpenPanel();
            }}
          >
            <span className="workspace-sidebar__icon" aria-hidden>
              <EnergyPortraitGlyph className="workspace-right-collapsed-icons__portrait" />
            </span>
            <span className="workspace-right-collapsed-icons__slot" aria-hidden>
              B
            </span>
            {match.matrixUnreadB ? (
              <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
            ) : null}
          </button>
        ) : null}

        {showReportA ? (
          <button
            type="button"
            className={`workspace-right-collapsed-icons__btn workspace-right-collapsed-icons__btn--slot${
              aGenerating ? " is-generating" : ""
            }`}
            aria-label={aGenerating ? reportGeneratingA : reportLabelA}
            data-tooltip={aGenerating ? reportGeneratingA : reportLabelA}
            aria-busy={aGenerating || undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (aReportReady) {
                match.setReportAExpanded(true);
              }
              onOpenPanel();
            }}
          >
            {aGenerating ? (
              <span className="workspace-right-collapsed-icons__spin" aria-hidden />
            ) : null}
            <span className="workspace-sidebar__icon" aria-hidden>
              <EnergyReportGlyph className="workspace-right-collapsed-icons__report" />
            </span>
            <span className="workspace-right-collapsed-icons__slot" aria-hidden>
              A
            </span>
            {aReportReady && match.reportUnreadA ? (
              <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
            ) : null}
          </button>
        ) : null}

        {showReportB ? (
          <button
            type="button"
            className={`workspace-right-collapsed-icons__btn workspace-right-collapsed-icons__btn--slot${
              bGenerating ? " is-generating" : ""
            }`}
            aria-label={bGenerating ? reportGeneratingB : reportLabelB}
            data-tooltip={bGenerating ? reportGeneratingB : reportLabelB}
            aria-busy={bGenerating || undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (bReportReady) {
                match.setReportBExpanded(true);
              }
              onOpenPanel();
            }}
          >
            {bGenerating ? (
              <span className="workspace-right-collapsed-icons__spin" aria-hidden />
            ) : null}
            <span className="workspace-sidebar__icon" aria-hidden>
              <EnergyReportGlyph className="workspace-right-collapsed-icons__report" />
            </span>
            <span className="workspace-right-collapsed-icons__slot" aria-hidden>
              B
            </span>
            {bReportReady && match.reportUnreadB ? (
              <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
            ) : null}
          </button>
        ) : null}
      </div>
    );
  }

  if (!prepare) return null;

  const hasMatrix = Boolean(prepare.matrixPayload);
  const generating = prepare.baseReportStatus === "generating";
  const reportReady =
    prepare.baseReportStatus === "ready" && Boolean(prepare.baseReportText);
  const showReport = generating || reportReady;
  // Only after Phase-4 job completes and full_text is persisted (never during stream).
  const deliveryReady = Boolean(
    prepare.session?.main_delivery_done &&
      prepare.session?.main_delivery?.full_text?.trim() &&
      !prepare.session?.pending_delivery_job_id,
  );
  const matrixUnread = hasMatrix && prepare.matrixUnread;
  const reportUnread = reportReady && prepare.reportUnread;
  const deliveryUnread = deliveryReady && prepare.deliveryBookUnread;

  if (!hasMatrix && !showReport && !deliveryReady) return null;

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
            prepare.setDeliveryBookExpanded(false);
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
            prepare.setDeliveryBookExpanded(false);
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

      {deliveryReady ? (
        <button
          type="button"
          className="workspace-right-collapsed-icons__btn"
          aria-label={tBook("icon_label")}
          data-tooltip={tBook("icon_label")}
          onClick={(e) => {
            e.stopPropagation();
            prepare.setMatrixExpanded(false);
            prepare.setReportExpanded(false);
            prepare.setDeliveryBookExpanded(true);
            onOpenPanel();
          }}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <DeliveryBookGlyph className="workspace-right-collapsed-icons__report" />
          </span>
          {deliveryUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
