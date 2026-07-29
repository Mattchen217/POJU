"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { AccountDetailSheet } from "@/components/account/AccountDetailSheet";
import { PassRefundSheet } from "@/components/account/PassRefundSheet";
import type { PurchaseRow } from "@/components/account/PurchaseHistoryList";
import type { UsageRow } from "@/components/account/UsageHistoryList";

type Props = {
  open: boolean;
  onClose: () => void;
  flexBalance: number;
  purchases: PurchaseRow[];
  usage: UsageRow[];
  onBuyPass: () => void;
  onBalanceChanged: () => void;
};

function formatWhen(iso: string, locale: string, withTime: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(withTime
        ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
        : {}),
    }).format(d);
  } catch {
    return iso.slice(0, withTime ? 19 : 10);
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

export function PassDetailSheet({
  open,
  onClose,
  flexBalance,
  purchases,
  usage,
  onBuyPass,
  onBalanceChanged,
}: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [refundOpen, setRefundOpen] = useState(false);

  const flexPurchases = purchases.filter((p) => p.plan_type === "flex_pass");
  const flexUsage = usage.filter((u) => u.pass_source === "flex");

  return (
    <>
      <AccountDetailSheet open={open} onClose={onClose} title={t("passDetailTitle")} titleId="pass-detail-title">
        <div className="acct-sheet-panel acct-sheet-panel--detail">
          <div className="acct-sheet-panel__block">
            <p className="acct-sheet__section-label">{t("unitsAvailable")}</p>
            <p className="acct-metric__value acct-metric__value--accent">{flexBalance}</p>
            <p className="acct-metric__hint">{t("passBalance")}</p>
          </div>

          <div className="acct-sheet-panel__block acct-sheet-panel__block--wide">
            <p className="acct-sheet__section-label">{t("acquisitionLog")}</p>
            {flexPurchases.length === 0 ? (
              <p className="acct-empty">{t("purchaseEmpty")}</p>
            ) : (
              <div className="acct-table-wrap acct-table-wrap--capped pchat-scrollbar">
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
                    {flexPurchases.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8)}</td>
                        <td className="acct-table__muted">{formatWhen(row.created_at, locale, false)}</td>
                        <td className="acct-table__accent acct-table__right">+{row.quantity} PASS</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="acct-sheet-panel__block acct-sheet-panel__block--wide">
            <p className="acct-sheet__section-label">{t("flexUsageTitle")}</p>
            {flexUsage.length === 0 ? (
              <p className="acct-empty">{t("usageEmpty")}</p>
            ) : (
              <div className="acct-table-wrap acct-table-wrap--capped pchat-scrollbar">
                <table className="acct-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("colTimestamp")}</th>
                      <th scope="col">{t("colOperation")}</th>
                      <th scope="col">{t("colCost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flexUsage.map((row) => (
                      <tr key={row.id}>
                        <td className="acct-table__muted">{formatWhen(row.created_at, locale, true)}</td>
                        <td className="acct-table__accent">{productLabel(row.product, t)}</td>
                        <td>{t("usageCostPass")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="acct-sheet-panel__actions">
            <button
              type="button"
              className="acct-btn acct-btn--gold"
              onClick={() => {
                onClose();
                onBuyPass();
              }}
            >
              {t("acquirePass")}
            </button>
            <button
              type="button"
              className="acct-btn acct-btn--outline"
              disabled={flexBalance < 1}
              onClick={() => setRefundOpen(true)}
            >
              {t("requestRefund")}
            </button>
          </div>
        </div>
      </AccountDetailSheet>

      <PassRefundSheet
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        flexBalance={flexBalance}
        onRefunded={() => {
          setRefundOpen(false);
          onClose();
          onBalanceChanged();
        }}
      />
    </>
  );
}
