"use client";

import { A4PaperSheet, DeliveryBookGlyph, EnergyPortraitGlyph, EnergyReportGlyph } from "@/components/ui/A4PaperSheet";
import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import { useTranslations } from "next-intl";
import type { DocVaultItem, DocVaultKind } from "@/lib/workspace/doc-vault-types";

function GlyphForKind({ kind }: { kind: DocVaultKind }) {
  if (kind === "energy_matrix") {
    return <EnergyPortraitGlyph className="workspace-doc-vault-card__glyph" />;
  }
  if (kind === "pivot_delivery") {
    return <DeliveryBookGlyph className="workspace-doc-vault-card__glyph" />;
  }
  if (kind === "pivot_reminders") {
    return <EnergyReportGlyph className="workspace-doc-vault-card__glyph" />;
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

/** Expanded row: birth (baseline) or title snippet + Created time (SoT 15). */
function subtitleForItem(
  item: DocVaultItem,
  createdLabel: string,
): { short: string; full: string } {
  const birthOrSubject = item.subjectLabel.trim();
  const date = formatDateYmd(item.createdAt);
  const created = date ? `${createdLabel} ${date}` : "";
  if (item.kind === "energy_matrix") {
    const parts = [birthOrSubject || item.title, created].filter(Boolean);
    const full = parts.join(" · ");
    return { short: full, full };
  }
  // Delivery / 30-day: title snippet + Created (SoT 15)
  const titleBit = item.title.trim() || birthOrSubject;
  const parts = [titleBit, created].filter(Boolean);
  const full = parts.join(" · ");
  return { short: full, full };
}

type Props = {
  item: DocVaultItem;
  density?: "lg" | "md" | "sm";
  locale: string;
  onOpen: () => void;
};

/** List-row document entry: folded icon + title + user/date + unread. */
export function WorkspaceDocVaultCard({ item, locale, onOpen }: Props) {
  void locale;
  const t = useTranslations("workspace.docVault");
  const sub = subtitleForItem(item, t("created"));
  const ariaBits = [item.title, sub.full, item.unread ? "unread" : ""].filter(Boolean);

  return (
    <button
      type="button"
      className={`workspace-doc-vault-card${item.unread ? " is-unread" : ""}`}
      onClick={onOpen}
      aria-label={ariaBits.join(". ")}
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
        <span className="workspace-doc-vault-card__title" title={item.title}>
          {item.title}
        </span>
        {sub.short ? (
          <span className="workspace-doc-vault-card__sub" title={sub.full}>
            {sub.short}
          </span>
        ) : null}
      </span>
    </button>
  );
}
