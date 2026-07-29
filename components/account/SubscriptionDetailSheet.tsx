"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { AccountDetailSheet } from "@/components/account/AccountDetailSheet";
import type { PurchaseRow } from "@/components/account/PurchaseHistoryList";
import type { UsageRow } from "@/components/account/UsageHistoryList";

type Subscription = {
  status: string;
  plan: string | null;
  pending_plan?: "personal" | "team" | null;
  current_period_end: string | null;
  remaining: number;
  quota: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  subscription: Subscription;
  purchases: PurchaseRow[];
  usage: UsageRow[];
  onChangePlan: () => void;
  onSubscriptionChanged: () => void;
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

function planLabel(plan: string, t: (k: string) => string): string {
  if (plan === "personal") return t("planPersonal");
  if (plan === "team") return t("planTeam");
  if (plan === "flex_pass") return t("planFlex");
  return plan;
}

export function SubscriptionDetailSheet({
  open,
  onClose,
  subscription,
  purchases,
  usage,
  onChangePlan,
  onSubscriptionChanged,
}: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [renewOn, setRenewOn] = useState(subscription.status === "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRenewOn(subscription.status === "active");
    setBusy(false);
    setError(null);
  }, [open, subscription.status]);

  const hasPlan = Boolean(subscription.plan) || subscription.status === "active" || subscription.status === "canceled";
  const subUsage = usage.filter((u) => u.pass_source === "sub");
  const subPurchases = purchases.filter((p) => p.plan_type === "personal" || p.plan_type === "team");
  const remaining = subscription.remaining;
  const quota = subscription.quota;
  const pct = quota > 0 ? Math.max(0, Math.min(100, Math.round((remaining / quota) * 100))) : 0;

  async function toggleRenew(next: boolean) {
    if (busy || !hasPlan) return;
    const prev = renewOn;
    setRenewOn(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ active: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setRenewOn(prev);
        setError(data.error ?? "toggle_failed");
        return;
      }
      onSubscriptionChanged();
    } catch {
      setRenewOn(prev);
      setError("toggle_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountDetailSheet
      open={open}
      onClose={onClose}
      title={t("subDetailTitle")}
      titleId="sub-detail-title"
    >
      <div className="acct-sheet__section">
        <div className="acct-renew acct-renew--quota">
          <div className="acct-renew__copy">
            <p className="acct-sheet__section-label">{t("coreQuota")}</p>
            <p className="acct-metric__value">
              {remaining}
              <span style={{ color: "var(--acct-dim)", fontWeight: 500 }}>/</span>
              {quota > 0 ? quota : "—"}
            </p>
            {quota > 0 ? (
              <div className="acct-metric__bar" style={{ maxWidth: "12rem", marginTop: "0.5rem" }}>
                <div className="acct-progress" aria-hidden>
                  <div className="acct-progress__bar" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ) : null}
            <p className="acct-metric__hint">
              {planLabel(subscription.plan ?? "", t)} · {subscription.status}
            </p>
            {subscription.pending_plan === "personal" || subscription.pending_plan === "team" ? (
              <p className="acct-metric__hint">
                {t("planChangePendingBanner", {
                  plan: planLabel(subscription.pending_plan, t),
                  date: formatWhen(subscription.current_period_end ?? "", locale, false),
                })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="acct-text-link"
            onClick={() => {
              onClose();
              onChangePlan();
            }}
          >
            {t("changePlan")}
          </button>
        </div>
      </div>

      <div className="acct-sheet__section">
        <p className="acct-sheet__section-label">{t("subUsageTitle")}</p>
        {subUsage.length === 0 ? (
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
                {subUsage.map((row) => (
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

      <div className="acct-sheet__section">
        <p className="acct-sheet__section-label">{t("subHistoryTitle")}</p>
        {subPurchases.length === 0 ? (
          <p className="acct-empty">{t("purchaseEmpty")}</p>
        ) : (
          <div className="acct-table-wrap acct-table-wrap--capped pchat-scrollbar">
            <table className="acct-table">
              <thead>
                <tr>
                  <th scope="col">{t("colTxnId")}</th>
                  <th scope="col">{t("colDate")}</th>
                  <th scope="col">{t("planLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {subPurchases.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8)}</td>
                    <td className="acct-table__muted">{formatWhen(row.created_at, locale, false)}</td>
                    <td className="acct-table__accent">
                      {planLabel(row.plan_type, t)} · {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="acct-sheet__section">
        <div className="acct-renew">
          <div className="acct-renew__copy">
            <p className="acct-sheet__section-label" style={{ marginBottom: "0.25rem" }}>
              {t("autoRenewLabel")}
            </p>
            <p className="acct-metric__hint">
              {renewOn ? t("autoRenewOnHint") : t("autoRenewOffHint")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={renewOn}
            aria-label={t("autoRenewLabel")}
            className={`acct-switch${renewOn ? " is-on" : ""}`}
            disabled={busy || !hasPlan}
            onClick={() => void toggleRenew(!renewOn)}
          >
            <span className="acct-switch__thumb" aria-hidden />
          </button>
        </div>
        {!hasPlan ? <p className="acct-empty">{t("autoRenewUnavailable")}</p> : null}
        {error ? (
          <p className="acct-alert" role="alert">
            {t("autoRenewError")}
          </p>
        ) : null}
      </div>
    </AccountDetailSheet>
  );
}
