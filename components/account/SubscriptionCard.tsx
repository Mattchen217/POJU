"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type Subscription = {
  status: string;
  plan: string | null;
  current_period_end: string | null;
  remaining?: number;
  quota?: number;
};

type Props = {
  subscription: Subscription;
};

function formatPeriodEnd(iso: string | null, locale: string): string {
  if (!iso) return "—";
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

export function SubscriptionCard({ subscription }: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planLabel =
    subscription.plan === "personal"
      ? t("planPersonal")
      : subscription.plan === "team"
        ? t("planTeam")
        : t("planNone");

  const statusLabel =
    subscription.status === "active"
      ? t("statusActive")
      : subscription.status === "canceled"
        ? t("statusCanceled")
        : t("statusNone");

  const remaining = typeof subscription.remaining === "number" ? subscription.remaining : 0;
  const quota = typeof subscription.quota === "number" ? subscription.quota : 0;
  const showUsage = subscription.status === "active" || quota > 0 || remaining > 0;
  const showManage = subscription.status === "active" || Boolean(subscription.plan);
  const pct = quota > 0 ? Math.max(0, Math.min(100, Math.round((remaining / quota) * 100))) : 0;

  async function openPortal() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ locale }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        portal_url?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.portal_url) {
        setError(data.error ?? "portal_failed");
        return;
      }
      window.location.href = data.portal_url;
    } catch {
      setError("portal_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="acct-card acct-mgt__span-4">
      <div className="acct-sub__head">
        <p className="acct-card__label" style={{ marginBottom: 0 }}>
          {t("subsystemStatus")}
        </p>
        <span className={`acct-badge${subscription.status === "active" ? "" : " acct-badge--muted"}`}>
          {statusLabel}
        </span>
      </div>

      <div className="acct-sub__rows">
        <div className="acct-sub__row">
          <span className="acct-sub__row-label">{t("planLabel")}</span>
          <span className="acct-sub__row-value">{planLabel.toUpperCase()}</span>
        </div>
        <div className="acct-sub__row">
          <span className="acct-sub__row-label">{t("renewsOn")}</span>
          <span className="acct-sub__row-value acct-sub__row-value--muted">
            {formatPeriodEnd(subscription.current_period_end, locale)}
          </span>
        </div>

        {showUsage ? (
          <div className="acct-sub__quota">
            <span className="acct-sub__quota-value">
              {remaining}/{quota > 0 ? quota : "—"}
            </span>
            <span className="acct-sub__quota-label">{t("coreQuota")}</span>
          </div>
        ) : (
          <p className="acct-empty">{t("subPassHint")}</p>
        )}
      </div>

      {showUsage && quota > 0 ? (
        <div className="acct-progress" aria-hidden>
          <div className="acct-progress__bar" style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      {showManage ? (
        <button
          type="button"
          className="acct-btn acct-btn--ghost self-start"
          disabled={busy}
          onClick={() => void openPortal()}
        >
          {busy ? t("openingPortal") : t("manageSubscription")}
        </button>
      ) : (
        <Link href="/#v2-pricing" className="acct-btn acct-btn--ghost self-start">
          {t("subscribeCta")}
        </Link>
      )}

      {error ? (
        <p className="acct-alert" role="alert">
          {t("portalError")}
        </p>
      ) : null}
    </article>
  );
}
