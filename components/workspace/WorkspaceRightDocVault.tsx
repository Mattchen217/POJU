"use client";

import { useLocale, useTranslations } from "next-intl";

import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { WorkspaceDocVaultCard } from "@/components/workspace/WorkspaceDocVaultCard";
import { useWorkspaceDocVaultOptional } from "@/components/workspace/WorkspaceDocVaultContext";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import {
  DOC_VAULT_SECTION_ORDER,
  type DocVaultSection,
} from "@/lib/workspace/doc-vault-types";

import "@/styles/workspace-doc-vault.css";

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
    <section className="workspace-doc-vault" aria-label={t("title")}>
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

      {loading && !hasAny ? (
        <p className="workspace-doc-vault__empty">{t("loading")}</p>
      ) : null}

      {!loading && !hasAny ? (
        <p className="workspace-doc-vault__empty">{t("empty")}</p>
      ) : null}

      {DOC_VAULT_SECTION_ORDER.map((section) => {
        const items = grouped[section];
        if (items.length === 0) return null;
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
            <div className="workspace-doc-vault__grid">
              {items.map((item) => (
                <WorkspaceDocVaultCard
                  key={item.id}
                  item={item}
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
