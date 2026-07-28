"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { AccountIdentityCard } from "@/components/account/AccountIdentityCard";
import { BillingInvoicesCard } from "@/components/account/BillingInvoicesCard";
import { CheckoutConfirmBanner } from "@/components/account/CheckoutConfirmBanner";
import { DangerZoneCard } from "@/components/account/DangerZoneCard";
import { NotificationPrefsCard } from "@/components/account/NotificationPrefsCard";
import { PassBalanceCard } from "@/components/account/PassBalanceCard";
import { PurchaseHistoryList, type PurchaseRow } from "@/components/account/PurchaseHistoryList";
import { SubscriptionCard } from "@/components/account/SubscriptionCard";
import { UsageHistoryList, type UsageRow } from "@/components/account/UsageHistoryList";
import { WorkspaceAccountPlaceholder } from "@/components/workspace/WorkspaceAccountPlaceholder";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";
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
  const tWs = useTranslations("workspace");
  const router = useRouter();
  const { user, email, ready, signOut } = useAuthUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const inFlight = useRef(false);

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  const loadSummary = useCallback(() => {
    if (!user) {
      setSummary(null);
      return;
    }
    setSummaryBusy(true);
    setSummaryError(false);
    void fetch("/api/account/summary", { credentials: "same-origin" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as AccountSummary;
        if (!res.ok || !data.ok) {
          setSummaryError(true);
          setSummary(null);
          return;
        }
        setSummary(data);
      })
      .catch(() => {
        setSummaryError(true);
        setSummary(null);
      })
      .finally(() => setSummaryBusy(false));
  }, [user]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="workspace-panel">
      <h2 className="workspace-panel__headline">{t("headline")}</h2>
      <p className="workspace-panel__guidance">{t("guidance")}</p>

      {!ready ? (
        <div className="workspace-glass-card mb-4">
          <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">…</p>
        </div>
      ) : user ? (
        <AccountIdentityCard
          user={user}
          email={email}
          signingOut={loggingOut}
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
      ) : (
        <div className="workspace-glass-card mb-4 flex flex-col gap-4">
          <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
            {t("accountSection")}
          </p>
          <WorkspaceAccountPlaceholder email={tWs("guest")} />
          <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">{t("accountBody")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/login?next=/app" className="workspace-link-btn">
              {t("loginCta")}
            </Link>
            <Link href="/signup?next=/app" className="workspace-link-btn">
              {t("signupCta")}
            </Link>
          </div>
        </div>
      )}

      {user ? (
        <div className="mb-4 flex flex-col gap-4">
          <Suspense fallback={null}>
            <CheckoutConfirmBanner onCredited={loadSummary} />
          </Suspense>
          {summaryBusy && !summary ? (
            <p className="m-0 text-sm text-[var(--ws-text-secondary,#a1a1aa)]">{tAccount("loading")}</p>
          ) : null}
          {summaryError ? (
            <div className="workspace-glass-card flex flex-col gap-2">
              <p className="m-0 text-sm text-[#fca5a5]">{tAccount("loadError")}</p>
              <button
                type="button"
                className="workspace-link-btn self-start border-0 cursor-pointer"
                onClick={() => loadSummary()}
              >
                {tAccount("retry")}
              </button>
            </div>
          ) : null}
          {summary ? (
            <>
              <PassBalanceCard
                flexBalance={summary.flex_balance ?? summary.pass_balance ?? 0}
                totalBalance={summary.pass_balance}
              />
              <SubscriptionCard
                subscription={{
                  status: summary.subscription?.status ?? "none",
                  plan: summary.subscription?.plan ?? null,
                  current_period_end: summary.subscription?.current_period_end ?? null,
                  remaining:
                    summary.subscription?.remaining ?? summary.sub_balance ?? 0,
                  quota: summary.subscription?.quota ?? summary.sub_quota ?? 0,
                }}
              />
              <BillingInvoicesCard hasStripeCustomer={Boolean(summary.has_stripe_customer)} />
              <NotificationPrefsCard
                initial={{
                  notify_pass_low: summary.notify_pass_low ?? true,
                  notify_marketing: summary.notify_marketing ?? false,
                }}
              />
              <PurchaseHistoryList purchases={summary.purchases ?? []} />
              <UsageHistoryList usage={summary.usage ?? []} />
              <DangerZoneCard
                onDeleted={() => {
                  setSummary(null);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

      <div className="workspace-glass-card flex flex-col gap-4">
        <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
          {t("slotsSection")}
        </p>
        <WorkspaceProfileSlotBar showAddAffordance />
        <Link href="/profile/setup" className="workspace-link-btn self-start">
          {t("setupCta")}
        </Link>
      </div>
    </div>
  );
}
