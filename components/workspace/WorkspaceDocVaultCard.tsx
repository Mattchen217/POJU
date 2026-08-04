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

function formatDateYmd(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

/** Prefer YYYY-MM-DD from subject label when present. */
function subtitleForItem(item: DocVaultItem): string {
  const fromSubject = item.subjectLabel.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (fromSubject) return fromSubject;
  return formatDateYmd(item.createdAt);
}

type Props = {
  item: DocVaultItem;
  density?: "lg" | "md" | "sm";
  locale: string;
  onOpen: () => void;
};

/** List-row document entry: folded icon + two text lines. */
export function WorkspaceDocVaultCard({ item, locale, onOpen }: Props) {
  void locale;
  const sub = subtitleForItem(item);

  return (
    <button
      type="button"
      className={`workspace-doc-vault-card${item.unread ? " is-unread" : ""}`}
      onClick={onOpen}
      aria-label={`${item.title}. ${sub}`}
    >
      <span className="workspace-doc-vault-card__thumb" aria-hidden>
        <A4PaperSheet mode="folded" className="workspace-doc-vault-card__sheet">
          <span className="workspace-doc-vault-card__icon">
            <GlyphForKind kind={item.kind} />
          </span>
        </A4PaperSheet>
      </span>
      <span className="workspace-doc-vault-card__copy">
        <span className="workspace-doc-vault-card__title">{item.title}</span>
        <span className="workspace-doc-vault-card__sub">{sub || item.subjectLabel}</span>
      </span>
      {item.unread ? (
        <ArchiveUnreadDot className="workspace-doc-vault-card__unread" />
      ) : null}
    </button>
  );
}
