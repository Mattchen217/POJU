"use client";

import { useLocale, useTranslations } from "next-intl";

export type PurchaseRow = {
  id: string;
  plan_type: string;
  quantity: number;
  amount_cents: number | null;
  currency: string | null;
  status: string;
  created_at: string;
};

type Props = {
  purchases: PurchaseRow[];
};

function formatMoney(cents: number | null, currency: string | null, locale: string): string {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat(locale.startsWith("zh") ? "zh-CN" : locale, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

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

function planLabel(plan: string, t: (k: string) => string): string {
  if (plan === "flex_pass") return t("planFlex");
  if (plan === "personal") return t("planPersonal");
  if (plan === "team") return t("planTeam");
  return plan;
}

export function PurchaseHistoryList({ purchases }: Props) {
  const t = useTranslations("account");
  const locale = useLocale();

  return (
    <div className="workspace-glass-card flex flex-col gap-3">
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#71717a)]">
        {t("purchaseHistory")}
      </p>
      {purchases.length === 0 ? (
        <p className="m-0 text-sm text-[var(--ws-text-secondary,#a1a1aa)]">{t("purchaseEmpty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {purchases.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[rgba(255,255,255,0.06)] pb-2 text-sm last:border-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[var(--ws-text,#e0e2e8)]">{planLabel(row.plan_type, t)}</span>
                <span className="text-xs text-[var(--ws-text-muted,#71717a)]">
                  {formatWhen(row.created_at, locale)} · ×{row.quantity} · {row.status}
                </span>
              </div>
              <span className="tabular-nums text-[#f2ca50]">
                {formatMoney(row.amount_cents, row.currency, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
