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
    <div className="workspace-glass-card flex flex-col gap-3">
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#71717a)]">
        {t("subscription")}
      </p>
      {showUsage ? (
        <p className="m-0 text-4xl font-semibold tabular-nums text-[#f2ca50]">
          {remaining}/{quota > 0 ? quota : "—"}
        </p>
      ) : null}
      <p className="m-0 text-sm text-[var(--ws-text-secondary,#a1a1aa)]">{t("subPassHint")}</p>
      <div className="flex flex-col gap-1 text-sm text-[var(--ws-text-body,#e0e2e8)]">
        <p className="m-0">
          <span className="text-[var(--ws-text-secondary,#a1a1aa)]">{t("planLabel")}: </span>
          {planLabel}
        </p>
        <p className="m-0">
          <span className="text-[var(--ws-text-secondary,#a1a1aa)]">{t("statusLabel")}: </span>
          {statusLabel}
        </p>
        <p className="m-0">
          <span className="text-[var(--ws-text-secondary,#a1a1aa)]">{t("renewsOn")}: </span>
          {formatPeriodEnd(subscription.current_period_end, locale)}
        </p>
      </div>
      {showManage ? (
        <button
          type="button"
          className="workspace-link-btn self-start border-0 cursor-pointer"
          disabled={busy}
          onClick={() => void openPortal()}
        >
          {busy ? t("openingPortal") : t("manageSubscription")}
        </button>
      ) : (
        <Link href="/#v2-pricing" className="workspace-link-btn self-start">
          {t("subscribeCta")}
        </Link>
      )}
      {error ? (
        <p className="m-0 text-xs text-[#fca5a5]" role="alert">
          {t("portalError")}
        </p>
      ) : null}
    </div>
  );
}
