"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { AccountIdentityCard } from "@/components/account/AccountIdentityCard";
import { BillingInvoicesCard } from "@/components/account/BillingInvoicesCard";
import { PASSES_CREDITED_EVENT } from "@/components/account/WorkspaceCheckoutConfirm";
import { DangerZoneCard } from "@/components/account/DangerZoneCard";
import { PassBalanceCard } from "@/components/account/PassBalanceCard";
import { PurchaseHistoryList, type PurchaseRow } from "@/components/account/PurchaseHistoryList";
import { SubscriptionCard } from "@/components/account/SubscriptionCard";
import { UsageHistoryList, type UsageRow } from "@/components/account/UsageHistoryList";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuthUser } from "@/lib/auth/use-auth-user";

type AccountSummary = {
  ok: boolean;
  email?: string | null;
  has_stripe_customer?: boolean;
  notify_pass_low?: boolean;
  notify_marketing?: boolean;
  pass_balance?: number;
  flex_balance?: number;
  sub_balance?: number;
  sub_quota?: number;
  subscription?: {
    status: string;
    plan: string | null;
    pending_plan?: "personal" | "team" | null;
    current_period_end: string | null;
    remaining?: number;
    quota?: number;
  };
  purchases?: PurchaseRow[];
  usage?: UsageRow[];
  error?: string;
};

export function ProfilePanel() {
  const t = useTranslations("workspace.profile");
  const tAccount = useTranslations("account");
  const router = useRouter();
  const { user, email, ready, signOut } = useAuthUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const inFlight = useRef(false);

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);

  const loadSummary = useCallback(() => {
    if (!user) {
      setSummary(null);
      return;
    }
    setSummaryError(false);
    void fetch("/api/account/summary", { credentials: "same-origin" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as AccountSummary;
        if (!res.ok || !data.ok) {
          setSummaryError(true);
          return;
        }
        setSummary(data);
      })
      .catch(() => {
        setSummaryError(true);
      });
  }, [user]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const onCredited = () => {
      loadSummary();
    };
    window.addEventListener(PASSES_CREDITED_EVENT, onCredited);
    return () => window.removeEventListener(PASSES_CREDITED_EVENT, onCredited);
  }, [loadSummary]);

  /** Shells show immediately; numbers/lists fill when summary arrives. */
  const dataLoading = Boolean(user) && !summary && !summaryError;

  return (
    <div className="workspace-panel acct-mgt">
      <header className="acct-mgt__header">
        <h2 className="acct-mgt__title">{tAccount("credentialsTitle")}</h2>
        <p className="acct-mgt__subtitle">{tAccount("credentialsSubtitle")}</p>
      </header>

      {!ready ? (
        <div className="acct-card">
          <p className="acct-empty">…</p>
        </div>
      ) : !user ? (
        <div className="acct-card acct-guest">
          <p className="acct-card__label">{t("accountSection")}</p>
          <p className="acct-empty">{t("accountBody")}</p>
          <div className="acct-guest__actions">
            <Link href="/login?next=/app" className="acct-btn acct-btn--primary" style={{ width: "auto" }}>
              {t("loginCta")}
            </Link>
            <Link href="/signup?next=/app" className="acct-btn acct-btn--ghost">
              {t("signupCta")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {summaryError && !summary ? (
            <div className="acct-card flex flex-col gap-2">
              <p className="acct-alert">{tAccount("loadError")}</p>
              <button type="button" className="acct-btn acct-btn--ghost self-start" onClick={() => loadSummary()}>
                {tAccount("retry")}
              </button>
            </div>
          ) : null}

          <div className="acct-mgt__stack">
            <AccountIdentityCard
              user={user}
              email={email}
              signingOut={loggingOut}
              totalPassBalance={summary?.pass_balance ?? 0}
              loadingBalance={dataLoading}
              onSignOut={async () => {
                if (inFlight.current) return;
                inFlight.current = true;
                setLoggingOut(true);
                try {
                  await signOut();
                  router.refresh();
                } finally {
                  inFlight.current = false;
                  setLoggingOut(false);
                }
              }}
            />

            <PassBalanceCard
              loading={dataLoading}
              flexBalance={summary?.flex_balance ?? summary?.pass_balance ?? 0}
              purchases={summary?.purchases ?? []}
              usage={summary?.usage ?? []}
              hasSubscription={
                summary?.subscription?.status === "active" || Boolean(summary?.subscription?.plan)
              }
              onAccountChanged={loadSummary}
            />
            <SubscriptionCard
              loading={dataLoading}
              subscription={{
                status: summary?.subscription?.status ?? "none",
                plan: summary?.subscription?.plan ?? null,
                pending_plan: summary?.subscription?.pending_plan ?? null,
                current_period_end: summary?.subscription?.current_period_end ?? null,
                remaining: summary?.subscription?.remaining ?? summary?.sub_balance ?? 0,
                quota: summary?.subscription?.quota ?? summary?.sub_quota ?? 0,
              }}
              purchases={summary?.purchases ?? []}
              usage={summary?.usage ?? []}
              onAccountChanged={loadSummary}
            />
            <UsageHistoryList loading={dataLoading} usage={summary?.usage ?? []} />
            <PurchaseHistoryList loading={dataLoading} purchases={summary?.purchases ?? []} />
            <BillingInvoicesCard
              loading={dataLoading}
              hasStripeCustomer={Boolean(summary?.has_stripe_customer)}
            />
            <DangerZoneCard
              onDeleted={() => {
                setSummary(null);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
