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
      second: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return iso.slice(0, 19);
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
    <article className="acct-card acct-card--ledger acct-mgt__span-6">
      <p className="acct-card__label">{t("operationalLedger")}</p>
      {usage.length === 0 ? (
        <p className="acct-empty">{t("usageEmpty")}</p>
      ) : (
        <div className="acct-table-wrap">
          <table className="acct-table">
            <thead>
              <tr>
                <th scope="col">{t("colTimestamp")}</th>
                <th scope="col">{t("colOperation")}</th>
                <th scope="col">{t("colCost")}</th>
                <th scope="col">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.id}>
                  <td className="acct-table__muted">{formatWhen(row.created_at, locale)}</td>
                  <td className="acct-table__accent">
                    {productLabel(row.product, t)}
                    {row.description ? (
                      <span className="acct-table__muted"> · {row.description}</span>
                    ) : null}
                  </td>
                  <td>{t("usageCostPass")}</td>
                  <td>
                    <span className="acct-table__ok">{t("usageSuccess")}</span>
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
