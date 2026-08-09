"use client";

import { useState, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { AccountBuySheet } from "@/components/account/AccountBuySheet";
import type { PurchaseRow } from "@/components/account/PurchaseHistoryList";
import { SubscriptionDetailSheet } from "@/components/account/SubscriptionDetailSheet";
import type { UsageRow } from "@/components/account/UsageHistoryList";

type Subscription = {
  status: string;
  plan: string | null;
  pending_plan?: "personal" | "team" | null;
  current_period_end: string | null;
  remaining?: number;
  quota?: number;
  /** Unused Passes kept from a prior plan after immediate upgrade/downgrade */
  carryover?: number;
  carryover_source_plan?: "personal" | "team" | null;
};

type Props = {
  subscription: Subscription;
  purchases: PurchaseRow[];
  usage: UsageRow[];
  onAccountChanged: () => void;
  loading?: boolean;
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

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("button, a, input, textarea, select, label"));
}

export function SubscriptionCard({
  subscription,
  purchases,
  usage,
  onAccountChanged,
  loading = false,
}: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [detailOpen, setDetailOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const planLabel =
    subscription.plan === "personal"
      ? t("planPersonal")
      : subscription.plan === "team"
        ? t("planTeam")
        : t("planNone");

  const remaining = typeof subscription.remaining === "number" ? subscription.remaining : 0;
  const quota = typeof subscription.quota === "number" ? subscription.quota : 0;
  const carryover = typeof subscription.carryover === "number" ? subscription.carryover : 0;
  const carryoverPlan =
    subscription.carryover_source_plan === "personal" ||
    subscription.carryover_source_plan === "team"
      ? subscription.carryover_source_plan
      : null;
  const showUsage =
    subscription.status === "active" || quota > 0 || remaining > 0 || carryover > 0;
  const hasSub = subscription.status === "active" || Boolean(subscription.plan);
  const isActive = subscription.status === "active";
  const pct = quota > 0 ? Math.max(0, Math.min(100, Math.round((remaining / quota) * 100))) : 0;
  const carryoverPlanLabel =
    carryoverPlan === "personal"
      ? t("planPersonal")
      : carryoverPlan === "team"
        ? t("planTeam")
        : t("priorPlan");

  function openDetails() {
    if (loading) return;
    if (hasSub) setDetailOpen(true);
    else setSubscribeOpen(true);
  }

  function onCardActivate(e: MouseEvent) {
    if (isInteractiveTarget(e.target)) return;
    openDetails();
  }

  return (
    <>
      <section className="acct-strip">
        <h3 className="acct-strip__title">{t("subsystemStatus")}</h3>
        <div
          className={`acct-strip__body acct-strip__body--interactive${loading ? " is-loading" : ""}`}
          onClick={onCardActivate}
        >
          <div className="acct-strip__row acct-strip__row--hero">
            <div className="acct-hero" aria-label={t("coreQuota")}>
              {loading || showUsage || hasSub ? (
                <>
                  <p className={`acct-hero__value acct-hero__value--ratio${loading ? " is-loading" : ""}`}>
                    {loading ? (
                      "—"
                    ) : (
                      <>
                        {remaining}
                        <span className="acct-hero__sep">/</span>
                        {quota > 0 ? quota : "—"}
                        <span className="acct-hero__unit"> PASS</span>
                      </>
                    )}
                  </p>
                  <p className="acct-hero__label">
                    {loading
                      ? t("coreQuota")
                      : t("currentPlanQuota", { plan: planLabel })}
                  </p>
                  {!loading && quota > 0 ? (
                    <div className="acct-hero__bar">
                      <div className="acct-progress" aria-hidden>
                        <div className="acct-progress__bar" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {!loading && carryover > 0 ? (
                    <>
                      <p className="acct-hero__carryover">
                        {t("priorPlanRemaining", {
                          plan: carryoverPlanLabel,
                          n: carryover,
                        })}
                      </p>
                      <p className="acct-hero__available">
                        {t("subscriptionAvailable", {
                          n: remaining + carryover,
                          current: remaining,
                          prior: carryover,
                        })}
                      </p>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="acct-hero__value acct-hero__value--muted">—</p>
                  <p className="acct-hero__label">{t("coreQuota")}</p>
                </>
              )}
            </div>

            <div className="acct-strip__meta">
              <div className="acct-facts acct-facts--compact">
                <div className="acct-fact">
                  <span className="acct-fact__label">{t("planLabel")}</span>
                  <span className={`acct-fact__value${loading ? " is-loading" : ""}`}>
                    {loading ? "—" : planLabel}
                  </span>
                </div>
                <div className="acct-fact">
                  <span className="acct-fact__label">{t("renewsOn")}</span>
                  <span
                    className={`acct-fact__value acct-fact__value--muted${loading ? " is-loading" : ""}`}
                  >
                    {loading ? "—" : formatPeriodEnd(subscription.current_period_end, locale)}
                  </span>
                </div>
              </div>
              {!loading && !hasSub ? <p className="acct-strip__note">{t("subCardHint")}</p> : null}
              {!loading &&
              (subscription.pending_plan === "personal" || subscription.pending_plan === "team") ? (
                <p className="acct-strip__note">
                  {t("planChangePendingBanner", {
                    plan:
                      subscription.pending_plan === "personal"
                        ? t("planPersonal")
                        : t("planTeam"),
                    date: formatPeriodEnd(subscription.current_period_end, locale),
                  })}
                </p>
              ) : null}
            </div>

            <div className="acct-strip__rail">
              {loading ? (
                <span className="acct-btn acct-btn--gold" style={{ opacity: 0.45, pointerEvents: "none" }}>
                  {t("subscribeCta")}
                </span>
              ) : hasSub ? (
                <span className={`acct-badge${isActive ? "" : " acct-badge--muted"}`}>
                  {isActive
                    ? t("statusActive")
                    : subscription.status === "canceled"
                      ? t("statusCanceled")
                      : planLabel}
                </span>
              ) : (
                <button
                  type="button"
                  className="acct-btn acct-btn--gold"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSubscribeOpen(true);
                  }}
                >
                  {t("subscribeCta")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="acct-strip__foot">
          <button
            type="button"
            className="acct-text-link"
            disabled={loading}
            onClick={openDetails}
          >
            {hasSub ? t("manageSubscription") : t("viewDetails")}
          </button>
        </div>
      </section>

      {hasSub ? (
        <SubscriptionDetailSheet
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          subscription={{
            status: subscription.status,
            plan: subscription.plan,
            pending_plan: subscription.pending_plan ?? null,
            current_period_end: subscription.current_period_end,
            remaining,
            quota,
            carryover,
            carryover_source_plan: carryoverPlan,
          }}
          purchases={purchases}
          usage={usage}
          onChangePlan={() => setSubscribeOpen(true)}
          onSubscriptionChanged={onAccountChanged}
        />
      ) : null}

      <AccountBuySheet
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        mode="subscribe"
        currentPlan={
          subscription.plan === "personal" || subscription.plan === "team"
            ? subscription.plan
            : null
        }
        pendingPlan={
          subscription.pending_plan === "personal" || subscription.pending_plan === "team"
            ? subscription.pending_plan
            : null
        }
        periodEnd={subscription.current_period_end}
        onPlanScheduled={onAccountChanged}
      />
    </>
  );
}
