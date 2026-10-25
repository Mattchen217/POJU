"use client";

import { requestDeliveryAutoOpen } from "@/lib/workspace/doc-vault-types";

import { useTranslations } from "next-intl";

import {
  DeliveryBookGlyph,
  EnergyPortraitGlyph,
  RemindersGlyph,
} from "@/components/ui/A4PaperSheet";
import { useWorkspaceAtmosPrepareOptional } from "@/components/workspace/WorkspaceAtmosPrepareContext";
import { useWorkspaceDocVaultOptional } from "@/components/workspace/WorkspaceDocVaultContext";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";

type Props = {
  visible: boolean;
  onOpenPanel: () => void;
};

function formatCount(n: number): string {
  return `x ${n}`;
}

/**
 * Collapsed right-rail: large inner glyph only (no A4 shell — that stays in the open vault list).
 * Count badge: white `X3` / `X5`. No unread red dots on rail icons.
 */
export function WorkspaceRightCollapsedIcons({ visible, onOpenPanel }: Props) {
  const t = useTranslations("workspace.pojuRail");
  const tVaultType = useTranslations("workspace.docVault");
  const tAtmos = useTranslations("workspace.atmosRail");
  const vault = useWorkspaceDocVaultOptional();
  const prepare = useWorkspacePojuPrepareOptional();
  const atmos = useWorkspaceAtmosPrepareOptional();

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
            <EnergyPortraitGlyph className="workspace-right-collapsed-icons__glyph" />
          </span>
        </button>
      </div>
    );
  }

  const vaultItems = vault?.items ?? [];
  const hasVaultMatrix = vaultItems.some((i) => i.kind === "energy_matrix");
  const hasVaultDelivery = vaultItems.some((i) => i.kind === "pivot_delivery");
  const baselineCount = vaultItems.filter((i) => i.kind === "energy_matrix").length;
  const deliveryCount = vaultItems.filter((i) => i.kind === "pivot_delivery").length;
  const remindersCount = vaultItems.filter((i) => i.kind === "pivot_reminders").length;
  const hasVaultReminders = remindersCount > 0;

  const hasMatrix = Boolean(prepare?.matrixPayload) || hasVaultMatrix;
  const deliveryReady =
    Boolean(
      prepare?.session?.main_delivery?.full_text?.trim() ||
        prepare?.session?.main_delivery_done ||
        prepare?.session?.pending_delivery_job_id,
    ) || hasVaultDelivery;
  const remindersReady = hasVaultReminders;

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
            <EnergyPortraitGlyph className="workspace-right-collapsed-icons__glyph" />
          </span>
          {baselineCount > 0 ? (
            <span className="workspace-right-collapsed-icons__count">{formatCount(baselineCount)}</span>
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
            const sid = prepare?.session?.session_id?.trim();
            if (sid) {
              requestDeliveryAutoOpen(sid);
            } else {
              openVaultSection("pivot");
            }
          }}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <DeliveryBookGlyph className="workspace-right-collapsed-icons__glyph" />
          </span>
          {deliveryCount > 0 ? (
            <span className="workspace-right-collapsed-icons__count">{formatCount(deliveryCount)}</span>
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
            <RemindersGlyph className="workspace-right-collapsed-icons__glyph" />
          </span>
          {remindersCount > 0 ? (
            <span className="workspace-right-collapsed-icons__count">{formatCount(remindersCount)}</span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
