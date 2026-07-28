"use client";

import { useLocale, useTranslations } from "next-intl";

export type UsageRow = {
  id: string;
  product: string;
  ref_id: string;
  description: string | null;
  created_at: string;
};

type Props = {
  usage: UsageRow[];
};

function formatWhen(iso: string, locale: string): string {
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
    return iso.slice(0, 16);
  }
}

function productLabel(product: string, t: (k: string) => string): string {
  if (product === "atmos") return t("productAtmos");
  if (product === "pivot") return t("productPivot");
  if (product === "match") return t("productMatch");
  if (product === "syncro") return t("productSyncro");
  if (product === "glyph") return t("productGlyph");
  return product;
}

export function UsageHistoryList({ usage }: Props) {
  const t = useTranslations("account");
  const locale = useLocale();

  return (
    <div className="workspace-glass-card flex flex-col gap-3">
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#71717a)]">
        {t("usageHistory")}
      </p>
      {usage.length === 0 ? (
        <p className="m-0 text-sm text-[var(--ws-text-secondary,#a1a1aa)]">{t("usageEmpty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {usage.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-0.5 border-b border-[rgba(255,255,255,0.06)] pb-2 text-sm last:border-0"
            >
              <span className="text-[var(--ws-text,#e0e2e8)]">{productLabel(row.product, t)}</span>
              <span className="text-xs text-[var(--ws-text-muted,#71717a)]">
                {formatWhen(row.created_at, locale)}
                {row.description ? ` · ${row.description}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
