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

/** Expanded row for non-baseline kinds: title snippet + Created date. */
function subtitleForItem(
  item: DocVaultItem,
  createdLabel: string,
): { short: string; full: string } {
  const birthOrSubject = item.subjectLabel.trim();
  const date = formatDateYmd(item.createdAt);
  const created = date ? `${createdLabel} ${date}` : "";
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
  const isBaseline = item.kind === "energy_matrix";
  const birthLine = item.subjectLabel.trim() || item.title.trim();
  const createdAt = formatCreatedAt(item.createdAt);
  const sub = isBaseline ? null : subtitleForItem(item, t("created"));
  const ariaBits = isBaseline
    ? [birthLine, createdAt, item.unread ? "unread" : ""].filter(Boolean)
    : [item.title, sub?.full, item.unread ? "unread" : ""].filter(Boolean);

  return (
    <button
      type="button"
      className={`workspace-doc-vault-card${isBaseline ? " workspace-doc-vault-card--baseline" : ""}${
        item.unread ? " is-unread" : ""
      }`}
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
      {isBaseline ? (
        <span className="workspace-doc-vault-card__copy">
          <span className="workspace-doc-vault-card__title" title={birthLine}>
            {birthLine}
          </span>
          {createdAt ? (
            <span className="workspace-doc-vault-card__meta" title={createdAt}>
              {createdAt}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="workspace-doc-vault-card__copy">
          <span className="workspace-doc-vault-card__title" title={item.title}>
            {item.title}
          </span>
          {sub?.short ? (
            <span className="workspace-doc-vault-card__sub" title={sub.full}>
              {sub.short}
            </span>
          ) : null}
        </span>
      )}
    </button>
  );
}
