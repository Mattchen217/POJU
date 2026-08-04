"use client";

import { A4PaperSheet, DeliveryBookGlyph, EnergyPortraitGlyph, EnergyReportGlyph } from "@/components/ui/A4PaperSheet";
import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import type { DocVaultItem, DocVaultKind } from "@/lib/workspace/doc-vault-types";

function GlyphForKind({ kind }: { kind: DocVaultKind }) {
  if (kind === "energy_matrix") {
    return <EnergyPortraitGlyph className="workspace-doc-vault-card__glyph" />;
  }
  if (kind === "pivot_delivery") {
    return <DeliveryBookGlyph className="workspace-doc-vault-card__glyph" />;
  }
  return <EnergyReportGlyph className="workspace-doc-vault-card__glyph" />;
}

function formatShortDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

type Props = {
  item: DocVaultItem;
  density: "lg" | "md" | "sm";
  locale: string;
  onOpen: () => void;
};

export function WorkspaceDocVaultCard({ item, density, locale, onOpen }: Props) {
  const dateLabel = formatShortDate(item.createdAt, locale);

  return (
    <button
      type="button"
      className={`workspace-doc-vault-card workspace-doc-vault-card--${density}${
        item.unread ? " is-unread" : ""
      }`}
      onClick={onOpen}
      aria-label={`${item.title}. ${item.subjectLabel}${dateLabel ? `. ${dateLabel}` : ""}`}
    >
      <A4PaperSheet mode="folded" className="workspace-doc-vault-card__sheet">
        <div className="workspace-doc-vault-card__inner">
          <span className="workspace-doc-vault-card__icon" aria-hidden>
            <GlyphForKind kind={item.kind} />
          </span>
          <span className="workspace-doc-vault-card__title">{item.title}</span>
          {density !== "sm" ? (
            <span className="workspace-doc-vault-card__subject">{item.subjectLabel}</span>
          ) : null}
          {density === "lg" && dateLabel ? (
            <span className="workspace-doc-vault-card__meta">{dateLabel}</span>
          ) : null}
        </div>
      </A4PaperSheet>
      {item.unread ? (
        <ArchiveUnreadDot className="workspace-doc-vault-card__unread" />
      ) : null}
    </button>
  );
}
