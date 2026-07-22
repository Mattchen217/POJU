"use client";

import { useLocale, useTranslations } from "next-intl";

import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { GlyphCardIcon, SyncroRadarIcon } from "@/components/workspace/workspace-engine-icons";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";
import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";

/** Max profile cards before the card list scrolls (add-new stays pinned below). */
export const WORKSPACE_POJU_PROFILE_SCROLL_LIMIT = 3;

type ProductKey = "poju" | "match" | "syncro" | "glyph";

const PRODUCT_SLOTS: { key: ProductKey; usageKey: ProductKey }[] = [
  { key: "poju", usageKey: "poju" },
  { key: "match", usageKey: "match" },
  { key: "syncro", usageKey: "syncro" },
  { key: "glyph", usageKey: "glyph" },
];

type Props = {
  profiles: StoredProfileSummary[];
  onSelect: (summary: StoredProfileSummary) => void;
  onAddNew: () => void;
  onDelete: (profileId: string) => void;
};

function padClock(n: number): string {
  return String(n).padStart(2, "0");
}

function formatBirthLine(p: StoredProfileSummary): string {
  const hour =
    typeof p.hour === "number" ? p.hour : HOUR_PERIOD_INFO[p.hour_period].representative_hour;
  const minute = typeof p.minute === "number" ? p.minute : 0;
  return `${p.birth_date} · ${padClock(hour)}:${padClock(minute)} · ${p.gender}`;
}

function formatCreatedAt(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function ProductUsageIcon({
  product,
  count,
}: {
  product: ProductKey | null;
  count: number;
}) {
  if (!product || count <= 0) {
    return <span className="workspace-poju-card__product workspace-poju-card__product--empty" aria-hidden />;
  }

  return (
    <span className="workspace-poju-card__product" title={`${product} ×${count}`}>
      <span className="workspace-poju-card__product-icon" aria-hidden>
        {product === "poju" ? (
          <span className="material-symbols-outlined">self_improvement</span>
        ) : null}
        {product === "match" ? <span className="material-symbols-outlined">group</span> : null}
        {product === "syncro" ? <SyncroRadarIcon className="workspace-poju-card__glyph-svg" /> : null}
        {product === "glyph" ? <GlyphCardIcon className="workspace-poju-card__glyph-svg" /> : null}
      </span>
      <span className="workspace-poju-card__product-count" aria-hidden>
        ×{count}
      </span>
    </span>
  );
}

/** Always 4 slots; used products pack left so unused stay on the right. */
function productSlotsForProfile(p: StoredProfileSummary): Array<{ key: ProductKey | null; count: number }> {
  const used = PRODUCT_SLOTS.filter((slot) => (p.used_in_products[slot.usageKey] ?? 0) > 0).map(
    (slot) => ({
      key: slot.key as ProductKey | null,
      count: p.used_in_products[slot.usageKey] ?? 0,
    }),
  );
  return Array.from({ length: 4 }, (_, i) => used[i] ?? { key: null, count: 0 });
}

/**
 * Returning-user list: scrollable cards + pinned “Enter new info” at frame bottom.
 * Single-row cards: birth · created · product icons · delete.
 */
export function WorkspacePojuProfileRecords({ profiles, onSelect, onAddNew, onDelete }: Props) {
  const t = useTranslations("session_prep");
  const locale = useLocale();
  const scrollable = profiles.length > WORKSPACE_POJU_PROFILE_SCROLL_LIMIT;

  return (
    <div
      className={`workspace-poju-records${scrollable ? " is-scrollable" : " is-fit"}`}
      data-profile-count={profiles.length}
    >
      <WorkspaceScrollArea
        className="workspace-poju-records__scroll"
        viewportClassName="workspace-poju-records__viewport"
        fixedThumbPx={52}
      >
        <div className="workspace-poju-records__stack">
          {profiles.map((p) => {
            return (
              <div
                key={p.profile_id}
                className="workspace-poju-profile-card"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p);
                  }
                }}
              >
                <div className="workspace-poju-card__row">
                  <span className="workspace-poju-card__birth">{formatBirthLine(p)}</span>
                  <span className="workspace-poju-card__created">
                    {t("created_at", { date: formatCreatedAt(p.created_at, locale) })}
                  </span>
                  <div className="workspace-poju-card__products" aria-label="product usage">
                    {productSlotsForProfile(p).map((slot, i) => (
                      <ProductUsageIcon key={`${p.profile_id}-slot-${i}`} product={slot.key} count={slot.count} />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="workspace-poju-card__delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(p.profile_id);
                    }}
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </WorkspaceScrollArea>

      <button type="button" className="add-new-card-button workspace-poju-add-new" onClick={onAddNew}>
        <span className="plus-icon">+</span>
        <span>{t("enter_new_info")}</span>
      </button>
    </div>
  );
}
