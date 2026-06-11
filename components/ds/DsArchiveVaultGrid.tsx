"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import { DsBand } from "@/components/ds/primitives";
import { listArchive, type ArchiveSummary } from "@/lib/archive/archive-service";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import pIcon from "@/assets/icons/P.png";
import gIcon from "@/assets/icons/G.png";
import sIcon from "@/assets/icons/S.png";
import matchIcon from "@/assets/icons/match.png";

type FilterKey = "all" | "poju" | "glyph" | "syncro" | "match";

/** Latest records shown on the All tab (newest first). */
const ALL_TAB_LATEST_LIMIT = 6;

type ProductMeta = {
  label: string;
  icon: StaticImageData;
  ring: string;
  glow: string;
  tag: string;
};

const PRODUCT_META: Record<Exclude<FilterKey, "all">, ProductMeta> = {
  poju: {
    label: "POJU",
    icon: pIcon,
    ring: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    glow: "rgba(139,92,246,0.4)",
    tag: "#c4b5fd",
  },
  glyph: {
    label: "Glyph",
    icon: gIcon,
    ring: "linear-gradient(135deg, rgba(251,191,36,0.6), rgba(217,70,239,0.6))",
    glow: "rgba(251,191,36,0.3)",
    tag: "#fcd34d",
  },
  syncro: {
    label: "Syncro",
    icon: sIcon,
    ring: "linear-gradient(135deg, rgba(34,211,238,0.6), rgba(30,58,138,0.7))",
    glow: "rgba(34,211,238,0.35)",
    tag: "#7dd3fc",
  },
  match: {
    label: "Match",
    icon: matchIcon,
    ring: "linear-gradient(135deg, rgba(244,114,182,0.6), rgba(157,23,77,0.7))",
    glow: "rgba(244,114,182,0.35)",
    tag: "#fbcfe8",
  },
};

/** DS archive.jsx — filter pills + product ring card grid */
export function DsArchiveVaultGrid() {
  const t = useTranslations("archiveVault");
  const locale = useLocale();
  const [items, setItems] = useState<ArchiveSummary[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const query = {
        product: filter === "all" ? undefined : filter,
        limit: filter === "all" ? ALL_TAB_LATEST_LIMIT : undefined,
      } as const;

      let list = await listArchive(query);
      if (list.length === 0) {
        await new Promise((r) => window.setTimeout(r, 150));
        list = await listArchive(query);
      }
      setItems(list);
    } catch (e) {
      console.error("[archive-ds] list failed:", e);
      setItems([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load, locale]);

  useEffect(() => {
    const onRefresh = () => {
      void load();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener(ARCHIVE_UPDATED_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("pageshow", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(ARCHIVE_UPDATED_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("pageshow", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const filterOptions = useMemo(
    () =>
      [
        { key: "all" as const, label: t("filter_all") },
        { key: "poju" as const, label: "POJU" },
        { key: "glyph" as const, label: "Glyph" },
        { key: "syncro" as const, label: "Syncro" },
        { key: "match" as const, label: "Match" },
      ] as const,
    [t],
  );

  return (
    <DsBand id="archive-vault-ds">
      <div className="ds-archive-filters">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setFilter(opt.key)}
            className={`pj-nav-item ${filter === opt.key ? "active" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-7 text-sm text-[var(--pj-text-muted)]">{t("loading")}</p>
      ) : loadError ? (
        <p className="mt-7 text-sm text-amber-200/90">{t("load_error")}</p>
      ) : items.length === 0 ? (
        <p className="mt-7 text-sm leading-relaxed text-[var(--pj-text-secondary)]">{t("empty_message")}</p>
      ) : (
        <div className="ds-grid-auto-260 mt-7">
          {items.map((item) => (
            <DsArchiveCard key={item.archive_id} item={item} />
          ))}
        </div>
      )}
    </DsBand>
  );
}

function DsArchiveCard({ item }: { item: ArchiveSummary }) {
  const meta = PRODUCT_META[item.product as Exclude<FilterKey, "all">] ?? PRODUCT_META.poju;
  const dateLabel = new Date(item.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/archive/${item.archive_id}`} className="ds-glass-card ds-archive-card">
      <div className="ds-archive-card__top">
        <span className="ds-archive-card__product">
          <span
            className="ds-archive-card__ring"
            style={{ background: meta.ring, boxShadow: `0 0 16px ${meta.glow}` }}
          >
            <Image src={meta.icon} alt="" width={24} height={24} className="h-[70%] w-[70%] object-contain" />
          </span>
          <span className="ds-archive-card__label" style={{ color: meta.tag }}>
            {meta.label}
          </span>
        </span>
        <span className="ds-archive-card__date">{dateLabel}</span>
      </div>
      <div>
        <p className="m-0 text-base font-semibold leading-snug text-[var(--pj-text-primary)]">{item.title}</p>
        <p className="mt-1.5 text-[13px] text-[var(--pj-text-secondary)]">{item.product}</p>
      </div>
      <span className="ds-archive-card__open" style={{ color: meta.tag }}>
        Open →
      </span>
    </Link>
  );
}
