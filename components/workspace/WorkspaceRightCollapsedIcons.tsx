"use client";

import { useTranslations } from "next-intl";

import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import {
  A4PaperSheet,
  DeliveryBookGlyph,
  EnergyPortraitGlyph,
  RemindersGlyph,
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
 * Collapsed right-rail: folded A4 + inner glyph for the three delivery kinds.
 * No regenerate / stop controls in the rail.
 */
export function WorkspaceRightCollapsedIcons({ visible, onOpenPanel }: Props) {
  const t = useTranslations("workspace.pojuRail");
  const tVaultType = useTranslations("workspace.docVault");
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
            <A4PaperSheet mode="folded" className="workspace-right-collapsed-icons__sheet">
              <EnergyPortraitGlyph className="workspace-right-collapsed-icons__glyph" />
            </A4PaperSheet>
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
              <A4PaperSheet mode="folded" className="workspace-right-collapsed-icons__sheet">
                <EnergyPortraitGlyph className="workspace-right-collapsed-icons__glyph" />
              </A4PaperSheet>
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
              <A4PaperSheet mode="folded" className="workspace-right-collapsed-icons__sheet">
                <EnergyPortraitGlyph className="workspace-right-collapsed-icons__glyph" />
              </A4PaperSheet>
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
  const baselineCount = vaultItems.filter((i) => i.kind === "energy_matrix").length;
  const deliveryCount = vaultItems.filter((i) => i.kind === "pivot_delivery").length;
  const remindersCount = vaultItems.filter((i) => i.kind === "pivot_reminders").length;
  const hasVaultReminders = remindersCount > 0;
  const vaultRemindersUnread = vaultItems.some(
    (i) => i.kind === "pivot_reminders" && isDocVaultUnread(i.id),
  );

  const hasMatrix = Boolean(prepare?.matrixPayload) || hasVaultMatrix;
  const deliveryReady =
    Boolean(
      prepare?.session?.main_delivery?.full_text?.trim() ||
        prepare?.session?.main_delivery_done ||
        prepare?.session?.pending_delivery_job_id,
    ) || hasVaultDelivery;
  const remindersReady = hasVaultReminders;

  const matrixUnread = Boolean(prepare?.matrixUnread) || vaultMatrixUnread;
  const deliveryUnread = Boolean(prepare?.deliveryBookUnread) || vaultDeliveryUnread;

  if (!hasMatrix && !deliveryReady && !remindersReady) {
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
          aria-label={tVaultType("type_baseline")}
          data-tooltip={tVaultType("type_baseline")}
          onClick={(e) => {
            e.stopPropagation();
            openVaultSection("foundation");
          }}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <A4PaperSheet mode="folded" className="workspace-right-collapsed-icons__sheet">
              <EnergyPortraitGlyph className="workspace-right-collapsed-icons__glyph" />
            </A4PaperSheet>
          </span>
          {baselineCount > 0 ? (
            <span className="workspace-right-collapsed-icons__count">{baselineCount}</span>
          ) : null}
          {matrixUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}

      {deliveryReady ? (
        <button
          type="button"
          className="workspace-right-collapsed-icons__btn"
          aria-label={tVaultType("type_delivery")}
          data-tooltip={tVaultType("type_delivery")}
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
            <A4PaperSheet mode="folded" className="workspace-right-collapsed-icons__sheet">
              <DeliveryBookGlyph className="workspace-right-collapsed-icons__glyph" />
            </A4PaperSheet>
          </span>
          {deliveryCount > 0 ? (
            <span className="workspace-right-collapsed-icons__count">{deliveryCount}</span>
          ) : null}
          {deliveryUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}

      {remindersReady ? (
        <button
          type="button"
          className="workspace-right-collapsed-icons__btn"
          aria-label={tVaultType("type_reminders")}
          data-tooltip={tVaultType("type_reminders")}
          onClick={(e) => {
            e.stopPropagation();
            openVaultSection("reminders");
          }}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <A4PaperSheet mode="folded" className="workspace-right-collapsed-icons__sheet">
              <RemindersGlyph className="workspace-right-collapsed-icons__glyph" />
            </A4PaperSheet>
          </span>
          {remindersCount > 0 ? (
            <span className="workspace-right-collapsed-icons__count">{remindersCount}</span>
          ) : null}
          {vaultRemindersUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
