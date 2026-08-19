"use client";

import { useTranslations } from "next-intl";

import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import {
  DeliveryBookGlyph,
  EnergyPortraitGlyph,
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
    (Boolean(match.matrixPayloadA) || Boolean(match.matrixPayloadB));

  if (matchActive && match) {
    const hasA = Boolean(match.matrixPayloadA);
    const hasB = Boolean(match.matrixPayloadB);

    if (!hasA && !hasB) return null;

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
      </div>
    );
  }

  const vaultItems = vault?.items ?? [];
  const hasVaultMatrix = vaultItems.some((i) => i.kind === "energy_matrix");
  const hasVaultDelivery = vaultItems.some((i) => i.kind === "pivot_delivery");
  const vaultMatrixUnread = vaultItems.some(
    (i) => i.kind === "energy_matrix" && isDocVaultUnread(i.id),
  );
  const vaultDeliveryUnread = vaultItems.some(
    (i) => i.kind === "pivot_delivery" && isDocVaultUnread(i.id),
  );

  const hasMatrix = Boolean(prepare?.matrixPayload) || hasVaultMatrix;
  const deliveryReady =
    Boolean(
      prepare?.session?.main_delivery?.full_text?.trim() ||
        prepare?.session?.main_delivery_done ||
        prepare?.session?.pending_delivery_job_id,
    ) || hasVaultDelivery;

  const matrixUnread = Boolean(prepare?.matrixUnread) || vaultMatrixUnread;
  const deliveryUnread = Boolean(prepare?.deliveryBookUnread) || vaultDeliveryUnread;

  if (!hasMatrix && !deliveryReady && !prepare?.qaDeliveryRegenerate) {
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
