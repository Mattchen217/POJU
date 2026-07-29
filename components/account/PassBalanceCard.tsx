"use client";

import { useState, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { AccountBuySheet } from "@/components/account/AccountBuySheet";
import { PassDetailSheet } from "@/components/account/PassDetailSheet";
import type { PurchaseRow } from "@/components/account/PurchaseHistoryList";
import type { UsageRow } from "@/components/account/UsageHistoryList";

type Props = {
  flexBalance: number;
  purchases: PurchaseRow[];
  usage: UsageRow[];
  onAccountChanged: () => void;
  loading?: boolean;
  /** Active / existing subscription — skip 3–5 buy tips when true */
  hasSubscription?: boolean;
};

function formatUnits(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  return String(Math.floor(n));
}

function formatWhen(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("button, a, input, textarea, select, label"));
}

export function PassBalanceCard({
  flexBalance,
  purchases,
  usage,
  onAccountChanged,
  loading = false,
  hasSubscription = false,
}: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [buyOpen, setBuyOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const flexPurchases = purchases.filter((p) => p.plan_type === "flex_pass");
  const flexUsage = usage.filter((u) => u.pass_source === "flex");
  const purchaseCount = flexPurchases.length;
  const usedCount = flexUsage.length;
  const lastPurchase = flexPurchases[0]?.created_at
    ? formatWhen(flexPurchases[0].created_at, locale)
    : null;

  function openDetail() {
    if (loading) return;
    setDetailOpen(true);
  }

  function onCardActivate(e: MouseEvent) {
    if (isInteractiveTarget(e.target)) return;
    openDetail();
  }

  return (
    <>
      <section className="acct-strip">
        <h3 className="acct-strip__title">{t("passAllocation")}</h3>
        <div
          className={`acct-strip__body acct-strip__body--interactive${loading ? " is-loading" : ""}`}
          onClick={onCardActivate}
        >
          <div className="acct-strip__row acct-strip__row--hero">
            <div className="acct-hero" aria-label={t("unitsAvailable")}>
              <p className={`acct-hero__value${loading ? " is-loading" : ""}`}>
                {loading ? "—" : formatUnits(flexBalance)}
              </p>
              <p className="acct-hero__label">{t("unitsAvailable")}</p>
            </div>

            <div className="acct-strip__meta">
              <div className="acct-facts acct-facts--compact">
                <div className="acct-fact">
                  <span className="acct-fact__label">{t("passPurchaseCountLabel")}</span>
                  <span className={`acct-fact__value${loading ? " is-loading" : ""}`}>
                    {loading ? "—" : t("passPurchaseCount", { n: purchaseCount })}
                  </span>
                </div>
                <div className="acct-fact">
                  <span className="acct-fact__label">{t("passUsedCountLabel")}</span>
                  <span className={`acct-fact__value${loading ? " is-loading" : ""}`}>
                    {loading ? "—" : t("passUsedCount", { n: usedCount })}
                  </span>
                </div>
                <div className="acct-fact acct-fact--wide">
                  <span className="acct-fact__label">{t("passLastPurchaseLabel")}</span>
                  <span className={`acct-fact__value acct-fact__value--muted${loading ? " is-loading" : ""}`}>
                    {loading ? "—" : (lastPurchase ?? t("passLastPurchaseNone"))}
                  </span>
                </div>
              </div>
              <p className="acct-strip__note">{t("passCardHint")}</p>
            </div>

            <div className="acct-strip__rail">
              <button
                type="button"
                className="acct-btn acct-btn--gold"
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  setBuyOpen(true);
                }}
              >
                {t("acquirePass")}
              </button>
            </div>
          </div>
        </div>

        <div className="acct-strip__foot">
          <button
            type="button"
            className="acct-text-link"
            disabled={loading}
            onClick={() => setDetailOpen(true)}
          >
            {t("viewDetails")}
          </button>
        </div>
      </section>

      <AccountBuySheet
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        mode="flex"
        hasSubscription={hasSubscription}
      />
      <PassDetailSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        flexBalance={flexBalance}
        purchases={purchases}
        usage={usage}
        onBuyPass={() => setBuyOpen(true)}
        onBalanceChanged={onAccountChanged}
      />
    </>
  );
}
