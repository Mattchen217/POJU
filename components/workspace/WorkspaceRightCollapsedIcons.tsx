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
import { countDocVaultUnreadBySection } from "@/lib/workspace/doc-vault-unread";
import {
  DOC_VAULT_SECTION_ORDER,
  type DocVaultSection,
} from "@/lib/workspace/doc-vault-types";

import "@/styles/workspace-doc-vault.css";

type Props = {
  visible: boolean;
  onOpenPanel: () => void;
};

function SectionGlyph({ section }: { section: DocVaultSection }) {
  if (section === "foundation") {
    return <EnergyPortraitGlyph className="workspace-right-collapsed-icons__portrait" />;
  }
  if (section === "pivot") {
    return <DeliveryBookGlyph className="workspace-right-collapsed-icons__report" />;
  }
  return <EnergyReportGlyph className="workspace-right-collapsed-icons__report" />;
}

/**
 * Collapsed right-rail: document vault sections with counts + unread.
 * Falls back to legacy live icons when vault has no rows yet but prepare is active.
 */
export function WorkspaceRightCollapsedIcons({ visible, onOpenPanel }: Props) {
  const t = useTranslations("workspace.docVault");
  const tRail = useTranslations("workspace.pojuRail");
  const tChat = useTranslations("poju.chat");
  const tAtmos = useTranslations("workspace.atmosRail");
  const tMatch = useTranslations("match.workspace");
  const vault = useWorkspaceDocVaultOptional();
  const prepare = useWorkspacePojuPrepareOptional();
  const atmos = useWorkspaceAtmosPrepareOptional();
  const match = useWorkspaceMatchPrepareOptional();

  if (!visible) return null;

  const unreadBySection = countDocVaultUnreadBySection();
  const vaultCounts = vault?.counts;
  const hasVaultDocs = Boolean(vault && vault.items.length > 0);

  if (hasVaultDocs && vaultCounts) {
    const sectionTitle = (section: DocVaultSection): string => {
      switch (section) {
        case "foundation":
          return t("section_foundation");
        case "pivot":
          return t("section_pivot");
        case "atmos":
          return t("section_atmos");
        case "match":
          return t("section_match");
        case "syncro":
          return t("section_syncro");
        case "glyph":
          return t("section_glyph");
        default:
          return section;
      }
    };

    return (
      <div className="workspace-right-collapsed-icons" role="toolbar" aria-label={t("collapsed_label")}>
        {DOC_VAULT_SECTION_ORDER.map((section) => {
          const count = vaultCounts[section];
          if (count <= 0) return null;
          const unread = unreadBySection[section] > 0;
          return (
            <div key={section} className="workspace-right-collapsed-icons__section">
              <span className="workspace-right-collapsed-icons__section-label">{sectionTitle(section)}</span>
              <button
                type="button"
                className="workspace-right-collapsed-icons__btn"
                aria-label={`${sectionTitle(section)} (${count})`}
                data-tooltip={`${sectionTitle(section)} · ${count}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPanel();
                  requestAnimationFrame(() => {
                    document
                      .getElementById(`workspace-doc-vault-section-${section}`)
                      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  });
                }}
              >
                <span className="workspace-sidebar__icon" aria-hidden>
                  <SectionGlyph section={section} />
                </span>
                <span className="workspace-right-collapsed-icons__count" aria-hidden>
                  {count > 99 ? "99+" : count}
                </span>
                {unread ? (
                  <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
                ) : null}
              </button>
            </div>
          );
        })}

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

  // —— Legacy live-session fallback (no vault rows yet) ——
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
    if (!hasA && !match.matrixPayloadB) return null;
    return (
      <div className="workspace-right-collapsed-icons" role="toolbar" aria-label={tRail("collapsedRailLabel")}>
        {hasA ? (
          <button
            type="button"
            className="workspace-right-collapsed-icons__btn"
            aria-label={tMatch("portrait_a", { title: tRail("matrixIconLabel") })}
            data-tooltip={tMatch("portrait_a", { title: tRail("matrixIconLabel") })}
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
      </div>
    );
  }

  if (!prepare) return null;

  const hasMatrix = Boolean(prepare.matrixPayload);
  const generating = prepare.baseReportStatus === "generating";
  const reportReady =
    prepare.baseReportStatus === "ready" && Boolean(prepare.baseReportText);
  const showReport = generating || reportReady;
  const deliveryReady = Boolean(
    prepare.session?.main_delivery?.full_text?.trim() ||
      prepare.session?.main_delivery_done ||
      prepare.session?.pending_delivery_job_id,
  );

  if (!hasMatrix && !showReport && !deliveryReady && !prepare.qaDeliveryRegenerate) return null;

  return (
    <div className="workspace-right-collapsed-icons" role="toolbar" aria-label={tRail("collapsedRailLabel")}>
      {hasMatrix ? (
        <button
          type="button"
          className="workspace-right-collapsed-icons__btn"
          aria-label={tRail("matrixIconLabel")}
          data-tooltip={tRail("matrixIconLabel")}
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
          {prepare.matrixUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}

      {showReport ? (
        <button
          type="button"
          className={`workspace-right-collapsed-icons__btn${generating ? " is-generating" : ""}`}
          aria-label={
            generating ? tRail("reportGeneratingIconLabel") : tRail("reportIconLabel")
          }
          data-tooltip={
            generating ? tRail("reportGeneratingIconLabel") : tRail("reportIconLabel")
          }
          aria-busy={generating || undefined}
          onClick={(e) => {
            e.stopPropagation();
            prepare.setMatrixExpanded(false);
            prepare.setDeliveryBookExpanded(false);
            if (reportReady) prepare.setReportExpanded(true);
            onOpenPanel();
          }}
        >
          {generating ? (
            <span className="workspace-right-collapsed-icons__spin" aria-hidden />
          ) : null}
          <span className="workspace-sidebar__icon" aria-hidden>
            <EnergyReportGlyph className="workspace-right-collapsed-icons__report" />
          </span>
          {reportReady && prepare.reportUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}

      {deliveryReady ? (
        <button
          type="button"
          className="workspace-right-collapsed-icons__btn"
          aria-label={t("section_pivot")}
          data-tooltip={t("section_pivot")}
          onClick={(e) => {
            e.stopPropagation();
            prepare.requestOpenDeliveryShelf();
            onOpenPanel();
          }}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <DeliveryBookGlyph className="workspace-right-collapsed-icons__report" />
          </span>
          {prepare.deliveryBookUnread ? (
            <ArchiveUnreadDot className="workspace-right-collapsed-icons__unread" />
          ) : null}
        </button>
      ) : null}

      {prepare.qaDeliveryRegenerate ? (
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
