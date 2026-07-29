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

function formatWhen(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

function planLabel(plan: string, t: (k: string) => string): string {
  if (plan === "flex_pass") return t("planFlex");
  if (plan === "personal") return t("planPersonal");
  if (plan === "team") return t("planTeam");
  return plan;
}

function shortTxn(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (clean.length <= 8) return `TXN_${clean}`;
  return `TXN_${clean.slice(0, 8)}`;
}

export function PurchaseHistoryList({ purchases }: Props) {
  const t = useTranslations("account");
  const locale = useLocale();

  return (
    <article className="acct-card acct-card--ledger acct-mgt__span-6">
      <p className="acct-card__label">{t("acquisitionLog")}</p>
      {purchases.length === 0 ? (
        <p className="acct-empty">{t("purchaseEmpty")}</p>
      ) : (
        <div className="acct-table-wrap">
          <table className="acct-table">
            <thead>
              <tr>
                <th scope="col">{t("colTxnId")}</th>
                <th scope="col">{t("colDate")}</th>
                <th scope="col" className="acct-table__right">
                  {t("colAmount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div>{shortTxn(row.id)}</div>
                    <div className="acct-table__muted">
                      {planLabel(row.plan_type, t)} · {row.status}
                    </div>
                  </td>
                  <td className="acct-table__muted">{formatWhen(row.created_at, locale)}</td>
                  <td className="acct-table__accent acct-table__right">
                    +{row.quantity} PASS
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
