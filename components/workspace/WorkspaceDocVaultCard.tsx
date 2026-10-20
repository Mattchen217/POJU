"use client";

import {
  A4PaperSheet,
  DeliveryBookGlyph,
  EnergyPortraitGlyph,
  EnergyReportGlyph,
  RemindersGlyph,
} from "@/components/ui/A4PaperSheet";
import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import type { DocVaultItem, DocVaultKind } from "@/lib/workspace/doc-vault-types";

function GlyphForKind({ kind }: { kind: DocVaultKind }) {
  if (kind === "energy_matrix") {
    return <EnergyPortraitGlyph className="workspace-doc-vault-card__glyph" />;
  }
  if (kind === "pivot_delivery") {
    return <DeliveryBookGlyph className="workspace-doc-vault-card__glyph" />;
  }
  if (kind === "pivot_reminders") {
    return <RemindersGlyph className="workspace-doc-vault-card__glyph" />;
  }
  return <EnergyReportGlyph className="workspace-doc-vault-card__glyph" />;
}

function formatCreatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

type Props = {
  item: DocVaultItem;
  density?: "lg" | "md" | "sm";
  locale: string;
  onOpen: () => void;
};

/**
 * List-row document entry — folded A4 + inner glyph (same for all three delivery kinds).
 * Primary line + created time bottom-right (baseline layout for every kind).
 */
export function WorkspaceDocVaultCard({ item, locale, onOpen }: Props) {
  void locale;
  const primary =
    item.kind === "energy_matrix"
      ? item.subjectLabel.trim() || item.title.trim()
      : item.title.trim() || item.subjectLabel.trim();
  const createdAt = formatCreatedAt(item.createdAt);
  const ariaBits = [primary, createdAt, item.unread ? "unread" : ""].filter(Boolean);

  return (
    <button
      type="button"
      className={`workspace-doc-vault-card workspace-doc-vault-card--baseline${
        item.unread ? " is-unread" : ""
      }`}
      onClick={onOpen}
      aria-label={ariaBits.join(". ")}
      role="listitem"
    >
      <span className="workspace-doc-vault-card__thumb" aria-hidden>
        <A4PaperSheet mode="folded" className="workspace-doc-vault-card__sheet">
          <span className="workspace-doc-vault-card__icon">
            <GlyphForKind kind={item.kind} />
          </span>
        </A4PaperSheet>
        {item.unread ? (
          <ArchiveUnreadDot className="workspace-doc-vault-card__unread" />
        ) : null}
      </span>
      <span className="workspace-doc-vault-card__copy">
        <span className="workspace-doc-vault-card__title" title={primary}>
          {primary}
        </span>
        {createdAt ? (
          <span className="workspace-doc-vault-card__meta" title={createdAt}>
            {createdAt}
          </span>
        ) : null}
      </span>
    </button>
  );
}
