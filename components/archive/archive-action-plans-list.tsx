"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import { listArchive, type ArchiveSummary } from "@/lib/archive/archive-service";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";

type FilterKey = "all" | "poju" | "glyph" | "syncro" | "match";

function dayLabel(ts: number): "Today" | "Yesterday" | "Earlier" {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (x === today) return "Today";
  if (x === yesterday) return "Yesterday";
  return "Earlier";
}

export function ArchiveActionPlansList() {
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
      let list = await listArchive({
        product: filter === "all" ? undefined : filter,
      });
      if (list.length === 0) {
        await new Promise((r) => window.setTimeout(r, 150));
        list = await listArchive({
          product: filter === "all" ? undefined : filter,
        });
      }
      setItems(list);
    } catch (e) {
      console.error("[archive] list failed:", e);
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

  const grouped = useMemo(() => {
    const buckets: Record<"Today" | "Yesterday" | "Earlier", ArchiveSummary[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const item of items) {
      buckets[dayLabel(new Date(item.created_at).getTime())].push(item);
    }
    return buckets;
  }, [items]);

  const filterOptions = [
    { key: "all" as const, label: t("filter_all") },
    { key: "poju" as const, label: "POJU" },
    { key: "glyph" as const, label: "Glyph" },
    { key: "syncro" as const, label: "Syncro" },
    { key: "match" as const, label: "Match" },
  ];

  return (
    <section className="archive-vault-section mb-12">
      <h2 className="mb-4 border-l-2 border-[#d0bcff]/30 pl-2 font-['Inter'] text-[12px] font-medium uppercase tracking-[0.05em] text-[#958ea0]">
        {t("section_title")}
      </h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setFilter(opt.key)}
            className={`rounded-full border px-4 py-1.5 text-[12px] uppercase tracking-[0.05em] ${
              filter === opt.key
                ? "border-[#d0bcff]/30 bg-[#d0bcff]/12 text-[#d0bcff]"
                : "border-[#494454]/20 bg-[#2c2832]/50 text-[#cbc3d7]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#cbc3d7]/70">{t("loading")}</p>
      ) : loadError ? (
        <p className="text-sm text-amber-200/90">{t("load_error")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm leading-relaxed text-[#cbc3d7]/80">{t("empty_message")}</p>
      ) : (
        <div className="space-y-8">
          {(["Today", "Yesterday", "Earlier"] as const).map((bucket) =>
            grouped[bucket].length > 0 ? (
              <div key={bucket}>
                <h3 className="mb-3 text-[12px] uppercase tracking-wider text-[#958ea0]">{bucket}</h3>
                <div className="space-y-3">
                  {grouped[bucket].map((item) => (
                    <ArchiveVaultCard key={item.archive_id} item={item} />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

function ArchiveVaultCard({ item }: { item: ArchiveSummary }) {
  const icon =
    item.product === "poju"
      ? "⭐"
      : item.product === "glyph"
        ? "🌿"
        : item.product === "syncro"
          ? "🧭"
          : item.product === "match"
            ? "👥"
            : "📄";

  return (
    <Link
      href={`/archive/${item.archive_id}`}
      className="archive-card flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-[rgba(30,30,34,0.6)] p-4 text-left transition-colors hover:bg-[#2c2832]/80"
    >
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[18px] text-[#e7e0ed]">{item.title}</div>
        <div className="mt-1 text-[12px] text-[#cbc3d7]/60">
          {new Date(item.created_at).toLocaleDateString()} · {item.product}
        </div>
      </div>
    </Link>
  );
}
