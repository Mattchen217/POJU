"use client";

import { useTranslations } from "next-intl";

import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import {
  DeliveryBookGlyph,
  EnergyPortraitGlyph,
  EnergyReportGlyph,
} from "@/components/ui/A4PaperSheet";
import { useWorkspaceAtmosPrepareOptional } from "@/components/workspace/WorkspaceAtmosPrepareContext";
import { useWorkspaceDocVaultOptional } from "@/components/workspace/WorkspaceDocVaultContext";
import { useWorkspaceMatchPrepareOptional } from "@/components/workspace/WorkspaceMatchPrepareContext";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import { isDocVaultUnread } from "@/lib/workspace/doc-vault-unread";

type Props = {
  visible: boolean;
  onOpenPanel: () => void;
};

/**
 * Collapsed right-rail: vertical glyph buttons (portrait / report / delivery).
 * Vault items light the same icons; no section labels or counts in the thin rail.
 */
export function WorkspaceRightCollapsedIcons({ visible, onOpenPanel }: Props) {
  const t = useTranslations("workspace.pojuRail");
  const tBook = useTranslations("workspace.deliveryBook");
  const tChat = useTranslations("poju.chat");
  const tAtmos = useTranslations("workspace.atmosRail");
  const tMatch = useTranslations("match.workspace");
  const vault = useWorkspaceDocVaultOptional();
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
    const aReportReady = match.reportAStatus === "ready" && Boolean(match.reportAText);
    const bReportReady = match.reportBStatus === "ready" && Boolean(match.reportBText);
    const showReportA = aGenerating || aReportReady;
    const showReportB = bGenerating || bReportReady;

    if (!hasA && !hasB && !showReportA && !showReportB) return null;

    return (
      <div className="workspace-right-collapsed-icons" role="toolbar" aria-label={t("collapsedRailLabel")}>
        {hasA ? (
          <button
            type="button"
            className="workspace-right-collapsed-icons__btn"
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
          </button>
        ) : null}
        {hasB ? (
          <button
            type="button"
            className="workspace-right-collapsed-icons__btn"
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
          </button>
        ) : null}
        {showReportA ? (
          <button
            type="button"
            className={`workspace-right-collapsed-icons__btn${aGenerating ? " is-generating" : ""}`}
            aria-label={tMatch("portrait_a", {
              title: aGenerating ? t("reportGeneratingIconLabel") : t("reportIconLabel"),
            })}
            data-tooltip={tMatch("portrait_a", {
              title: aGenerating ? t("reportGeneratingIconLabel") : t("reportIconLabel"),
            })}
            aria-busy={aGenerating || undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (aReportReady) match.setReportAExpanded(true);
              onOpenPanel();
            }}
          >
            {aGenerating ? (
              <span className="workspace-right-collapsed-icons__spin" aria-hidden />
            ) : null}
            <span className="workspace-sidebar__icon" aria-hidden>
              <EnergyReportGlyph className="workspace-right-collapsed-icons__report" />
            </span>
          </button>
        ) : null}
        {showReportB ? (
          <button
            type="button"
            className={`workspace-right-collapsed-icons__btn${bGenerating ? " is-generating" : ""}`}
            aria-label={tMatch("portrait_b", {
              title: bGenerating ? t("reportGeneratingIconLabel") : t("reportIconLabel"),
            })}
            data-tooltip={tMatch("portrait_b", {
              title: bGenerating ? t("reportGeneratingIconLabel") : t("reportIconLabel"),
            })}
            aria-busy={bGenerating || undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (bReportReady) match.setReportBExpanded(true);
              onOpenPanel();
            }}
          >
            {bGenerating ? (
              <span className="workspace-right-collapsed-icons__spin" aria-hidden />
            ) : null}
            <span className="workspace-sidebar__icon" aria-hidden>
              <EnergyReportGlyph className="workspace-right-collapsed-icons__report" />
            </span>
          </button>
        ) : null}
      </div>
    );
  }

  const vaultItems = vault?.items ?? [];
  const hasVaultMatrix = vaultItems.some((i) => i.kind === "energy_matrix");
  const hasVaultReport = vaultItems.some((i) => i.kind === "energy_report");
  const hasVaultDelivery = vaultItems.some((i) => i.kind === "pivot_delivery");
  const vaultMatrixUnread = vaultItems.some(
    (i) => i.kind === "energy_matrix" && isDocVaultUnread(i.id),
  );
  const vaultReportUnread = vaultItems.some(
    (i) => i.kind === "energy_report" && isDocVaultUnread(i.id),
  );
  const vaultDeliveryUnread = vaultItems.some(
    (i) => i.kind === "pivot_delivery" && isDocVaultUnread(i.id),
  );

  const hasMatrix = Boolean(prepare?.matrixPayload) || hasVaultMatrix;
  const generating = prepare?.baseReportStatus === "generating";
  const reportReady =
    (prepare?.baseReportStatus === "ready" && Boolean(prepare?.baseReportText)) || hasVaultReport;
  const showReport = generating || reportReady;
  const deliveryReady =
    Boolean(
      prepare?.session?.main_delivery?.full_text?.trim() ||
        prepare?.session?.main_delivery_done ||
        prepare?.session?.pending_delivery_job_id,
    ) || hasVaultDelivery;

  const matrixUnread = Boolean(prepare?.matrixUnread) || vaultMatrixUnread;
  const reportUnread = Boolean(prepare?.reportUnread) || vaultReportUnread;
  const deliveryUnread = Boolean(prepare?.deliveryBookUnread) || vaultDeliveryUnread;

  if (!hasMatrix && !showReport && !deliveryReady && !prepare?.qaDeliveryRegenerate) {
    return null;
  }

  const openVaultSection = (sectionId: string) => {
    onOpenPanel();
    requestAnimationFrame(() => {
      document
        .getElementById(`workspace-doc-vault-section-${sectionId}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

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
            if (prepare?.matrixPayload) {
              prepare.setReportExpanded(false);
              prepare.setDeliveryBookExpanded(false);
              prepare.setMatrixExpanded(true);
              onOpenPanel();
            } else {
              openVaultSection("foundation");
            }
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
          className={`workspace-right-collapsed-icons__btn${generating ? " is-generating" : ""}`}
          aria-label={generating ? t("reportGeneratingIconLabel") : t("reportIconLabel")}
          data-tooltip={generating ? t("reportGeneratingIconLabel") : t("reportIconLabel")}
          aria-busy={generating || undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (prepare && reportReady && prepare.baseReportText) {
              prepare.setMatrixExpanded(false);
              prepare.setDeliveryBookExpanded(false);
              prepare.setReportExpanded(true);
              onOpenPanel();
            } else {
              openVaultSection("foundation");
            }
          }}
        >
          {generating ? (
            <span className="workspace-right-collapsed-icons__spin" aria-hidden />
          ) : null}
          <span className="workspace-sidebar__icon" aria-hidden>
            <EnergyReportGlyph className="workspace-right-collapsed-icons__report" />
          </span>
          {reportUnread && !generating ? (
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
            if (prepare?.session?.main_delivery?.full_text || prepare?.session?.main_delivery_done) {
              prepare.requestOpenDeliveryShelf();
              onOpenPanel();
            } else {
              openVaultSection("pivot");
            }
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

      {prepare?.qaDeliveryRegenerate ? (
        <button
          type="button"
          className="workspace-right-collapsed-icons__btn workspace-right-collapsed-icons__btn--qa"
          aria-label={tChat("delivery_regenerate")}
          data-tooltip={tChat("delivery_regenerate")}
          disabled={prepare.qaDeliveryRegenerate.busy}
          onClick={(e) => {
            e.stopPropagation();
            prepare.qaDeliveryRegenerate?.run();
          }}
        >
          <span className="material-symbols-outlined workspace-right-collapsed-icons__qa-icon" aria-hidden>
            replay
          </span>
        </button>
      ) : null}
    </div>
  );
}
