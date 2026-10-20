"use client";

import { useLocale, useTranslations } from "next-intl";

import { WorkspaceDocVaultCard } from "@/components/workspace/WorkspaceDocVaultCard";
import { useWorkspaceDocVaultOptional } from "@/components/workspace/WorkspaceDocVaultContext";
import {
  DOC_VAULT_DELIVERY_SECTIONS,
  type DocVaultSection,
} from "@/lib/workspace/doc-vault-types";

import "@/styles/workspace-doc-vault.css";

/**
 * Right-rail historical deliveries — three categories (baseline / decision / 30-day).
 * Each category shows 5 rows; overflow scrolls inside the section list.
 */
export function WorkspaceRightDocVault() {
  const t = useTranslations("workspace.docVault");
  const locale = useLocale();
  const vault = useWorkspaceDocVaultOptional();

  const sectionLabel = (section: DocVaultSection): string => {
    switch (section) {
      case "foundation":
        return t("type_baseline");
      case "pivot":
        return t("type_delivery");
      case "reminders":
        return t("type_reminders");
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
      {loading && !hasAny ? (
        <p className="workspace-doc-vault__empty">{t("loading")}</p>
      ) : null}

      {DOC_VAULT_DELIVERY_SECTIONS.map((section) => {
        const items = grouped[section] ?? [];
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
            {items.length === 0 ? (
              <p className="workspace-doc-vault__section-empty">
                {loading ? t("loading") : t("section_empty")}
              </p>
            ) : (
              <div className="workspace-doc-vault__list" role="list">
                {items.map((item) => (
                  <WorkspaceDocVaultCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    onOpen={() => openItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
