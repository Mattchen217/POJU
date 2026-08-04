"use client";

import { useLocale, useTranslations } from "next-intl";

import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { WorkspaceDocVaultCard } from "@/components/workspace/WorkspaceDocVaultCard";
import { useWorkspaceDocVaultOptional } from "@/components/workspace/WorkspaceDocVaultContext";
import { WorkspaceRailBaseAnalysis } from "@/components/workspace/WorkspaceRailBaseAnalysis";
import { WorkspaceRailBaseReport } from "@/components/workspace/WorkspaceRailBaseReport";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import {
  DOC_VAULT_SECTION_ORDER,
  type DocVaultSection,
} from "@/lib/workspace/doc-vault-types";

import "@/styles/workspace-doc-vault.css";

function densityForCount(n: number): "lg" | "md" | "sm" {
  if (n <= 2) return "lg";
  if (n <= 5) return "md";
  return "sm";
}

/**
 * Right-rail document vault — segmented archive of local artifacts.
 * Live generating/report expanders still overlay when POJU prepare is active.
 */
export function WorkspaceRightDocVault() {
  const t = useTranslations("workspace.docVault");
  const tChat = useTranslations("poju.chat");
  const locale = useLocale();
  const vault = useWorkspaceDocVaultOptional();
  const prepare = useWorkspacePojuPrepareOptional();

  const qa = prepare?.qaDeliveryRegenerate ?? null;
  const showLiveMatrix =
    Boolean(prepare?.matrixPayload) && Boolean(prepare?.matrixExpanded);
  const showLiveReport =
    prepare?.baseReportStatus === "ready" &&
    Boolean(prepare?.baseReportText) &&
    Boolean(prepare?.reportExpanded);
  const showGenerating = prepare?.baseReportStatus === "generating";

  const sectionLabel = (section: DocVaultSection): string => {
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

  if (!vault) {
    return <div className="workspace-right-drawer-placeholder" aria-hidden />;
  }

  const { grouped, openItem, loading } = vault;
  const hasAny = vault.items.length > 0;

  return (
    <section className="workspace-doc-vault" aria-label={t("label")}>
      {qa ? (
        <button
          type="button"
          className="workspace-right-matrix__qa-regen"
          disabled={qa.busy}
          onClick={() => qa.run()}
        >
          {qa.busy ? tChat("delivery_regenerating") : tChat("delivery_regenerate")}
        </button>
      ) : null}

      {showGenerating ? <WorkspaceRailBaseAnalysis /> : null}

      {showLiveMatrix && prepare?.matrixPayload ? (
        <div className="workspace-doc-vault__live">
          <PojuEnergyMatrix
            payload={prepare.matrixPayload}
            locale={locale}
            compact
            suppressNarrative
            hideChrome
            expanded
            onExpandedChange={(v) => prepare.setMatrixExpanded(v)}
          />
        </div>
      ) : null}

      {showLiveReport && prepare?.baseReportText ? (
        <div className="workspace-doc-vault__live workspace-doc-vault__live--report">
          <WorkspaceRailBaseReport
            displayText={prepare.baseReportText}
            locale={locale}
            expanded
            onExpandedChange={(v) => prepare.setReportExpanded(v)}
          />
        </div>
      ) : null}

      {prepare?.baseReportStatus === "error" && prepare.baseReportError ? (
        <p className="workspace-right-matrix__report-error" role="alert">
          {prepare.baseReportError}
        </p>
      ) : null}

      {loading && !hasAny ? (
        <p className="workspace-doc-vault__empty">{t("loading")}</p>
      ) : null}

      {!loading && !hasAny ? (
        <p className="workspace-doc-vault__empty">{t("empty")}</p>
      ) : null}

      {DOC_VAULT_SECTION_ORDER.map((section) => {
        const items = grouped[section];
        if (items.length === 0) return null;
        const density = densityForCount(items.length);
        return (
          <div
            key={section}
            className="workspace-doc-vault__section"
            data-section={section}
            id={`workspace-doc-vault-section-${section}`}
          >
            <header className="workspace-doc-vault__section-head">
              <h3 className="workspace-doc-vault__section-title">{sectionLabel(section)}</h3>
              <span className="workspace-doc-vault__section-count">{items.length}</span>
            </header>
            <div className={`workspace-doc-vault__grid workspace-doc-vault__grid--${density}`}>
              {items.map((item) => (
                <WorkspaceDocVaultCard
                  key={item.id}
                  item={item}
                  density={density}
                  locale={locale}
                  onOpen={() => openItem(item)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
