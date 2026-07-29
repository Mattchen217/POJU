"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { AccountDetailSheet } from "@/components/account/AccountDetailSheet";
import { startPassCheckout } from "@/lib/passes/start-checkout";

type Props = {
  open: boolean;
  onClose: () => void;
  /** flex — buy Passes; subscribe — change plan (Personal / Team) */
  mode: "flex" | "subscribe";
  /** Current subscription plan — locks that option when switching */
  currentPlan?: "personal" | "team" | null;
  /** Already-scheduled next-cycle plan */
  pendingPlan?: "personal" | "team" | null;
  /** Period end for next-cycle messaging */
  periodEnd?: string | null;
  /** When true, skip subscribe tip on flex qty 3–5 */
  hasSubscription?: boolean;
  /** Called after a plan switch is scheduled (or cleared) */
  onPlanScheduled?: () => void;
};

const FLEX_UNIT_USD = 9.99;

function formatPeriodEnd(iso: string | null | undefined, locale: string): string {
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

/**
 * Account-page checkout sheet — same chrome as PASS / subscription details.
 */
export function AccountBuySheet({
  open,
  onClose,
  mode,
  currentPlan = null,
  pendingPlan = null,
  periodEnd = null,
  hasSubscription = false,
  onPlanScheduled,
}: Props) {
  const t = useTranslations("passPurchase");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"flex" | "personal" | "team" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSubTip, setShowSubTip] = useState(false);
  /** Confirm next-cycle switch before writing pending_plan */
  const [switchConfirm, setSwitchConfirm] = useState<"personal" | "team" | null>(null);
  const [switchDone, setSwitchDone] = useState<"personal" | "team" | null>(null);

  useEffect(() => {
    if (!open) return;
    setQty(1);
    setBusy(null);
    setError(null);
    setShowSubTip(false);
    setSwitchConfirm(null);
    setSwitchDone(null);
  }, [open, mode]);

  async function checkout(
    plan: "flex_pass" | "personal_plan" | "team_plan",
    quantity?: number,
  ) {
    if (busy) return;
    setBusy(plan === "flex_pass" ? "flex" : plan === "personal_plan" ? "personal" : "team");
    setError(null);
    const result = await startPassCheckout(
      plan === "flex_pass"
        ? { plan: "flex_pass", quantity: Math.max(1, quantity ?? 1) }
        : { plan },
      locale,
    );
    if (!result.ok && !result.loginRequired) {
      setError(t("checkoutFailed"));
      setBusy(null);
    }
  }

  function onFlexPay() {
    if (busy) return;
    if (!hasSubscription && qty >= 3 && qty <= 5) {
      setShowSubTip(true);
      return;
    }
    void checkout("flex_pass", qty);
  }

  function onSelectPlan(plan: "personal" | "team") {
    if (busy || plan === currentPlan) return;
    // Existing subscribers: schedule for next cycle — never checkout immediately
    if (currentPlan) {
      setSwitchConfirm(plan);
      setError(null);
      return;
    }
    void checkout(plan === "personal" ? "personal_plan" : "team_plan");
  }

  async function confirmPlanSwitch() {
    if (!switchConfirm || busy) return;
    setBusy(switchConfirm);
    setError(null);
    try {
      const res = await fetch("/api/account/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pending_plan: switchConfirm }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(tAccount("planChangeError"));
        return;
      }
      setSwitchDone(switchConfirm);
      setSwitchConfirm(null);
      onPlanScheduled?.();
    } catch {
      setError(tAccount("planChangeError"));
    } finally {
      setBusy(null);
    }
  }

  async function cancelPendingSwitch() {
    if (busy) return;
    setBusy("personal");
    setError(null);
    try {
      const res = await fetch("/api/account/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pending_plan: null }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(tAccount("planChangeError"));
        return;
      }
      setSwitchDone(null);
      onPlanScheduled?.();
    } catch {
      setError(tAccount("planChangeError"));
    } finally {
      setBusy(null);
    }
  }

  const total = (Math.max(1, qty) * FLEX_UNIT_USD).toFixed(2);
  const title =
    mode === "flex"
      ? t("titleFlexOnly")
      : currentPlan
        ? t("titleSwitchPlan")
        : t("titleChoose");
  const qtyLabel = qty === 1 ? t("qtyOne", { n: qty }) : t("qtyMany", { n: qty });
  const periodLabel = formatPeriodEnd(periodEnd, locale);
  const effectivePending = switchDone ?? pendingPlan;

  function planName(plan: "personal" | "team"): string {
    return plan === "personal" ? t("personalTitle") : t("teamTitle");
  }

  return (
    <AccountDetailSheet
      open={open}
      onClose={onClose}
      title={title}
      titleId={mode === "flex" ? "acct-buy-flex-title" : "acct-buy-plan-title"}
    >
      {mode === "flex" ? (
        showSubTip ? (
          <div className="acct-sheet-panel">
            <p className="acct-sheet-panel__name">{t("u3_title")}</p>
            <p className="acct-sheet-panel__body">{t("u3_body", { n: qty, total })}</p>
            <button
              type="button"
              className="acct-btn acct-btn--gold acct-btn--gold-stack"
              disabled={busy !== null}
              onClick={() => void checkout("personal_plan")}
            >
              <span className="acct-btn__title">
                {busy === "personal" ? t("working") : t("u3_upgrade")}
              </span>
              {busy === "personal" ? null : <span className="acct-btn__price">$29.90</span>}
            </button>
            <button
              type="button"
              className="acct-btn acct-btn--outline"
              disabled={busy !== null}
              onClick={() => void checkout("flex_pass", qty)}
            >
              {busy === "flex" ? t("working") : t("u3_keep", { n: qty, total })}
            </button>
            <button
              type="button"
              className="acct-text-link"
              disabled={busy !== null}
              onClick={() => setShowSubTip(false)}
            >
              {t("adjustQty")}
            </button>
          </div>
        ) : (
          <div className="acct-sheet-panel">
            <p className="acct-sheet__section-label">{t("flexLab")}</p>
            <p className="acct-buy-price">
              <span className="acct-buy-price__cur">$</span>
              <span className="acct-buy-price__num">9.99</span>
              <span className="acct-buy-price__unit">{t("flexUnit")}</span>
            </p>
            <p className="acct-sheet-panel__name">{t("flexTitle")}</p>
            <p className="acct-metric__hint">{t("flexBadge")}</p>

            <div className="acct-price-qty" role="group" aria-label={t("quantity")}>
              <button
                type="button"
                disabled={busy !== null || qty <= 1}
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                aria-label={t("qtyMinus")}
              >
                −
              </button>
              <span className="acct-price-qty__value">{qtyLabel}</span>
              <button
                type="button"
                disabled={busy !== null || qty >= 99}
                onClick={() => setQty((n) => Math.min(99, n + 1))}
                aria-label={t("qtyPlus")}
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="acct-btn acct-btn--gold acct-btn--gold-stack"
              disabled={busy !== null}
              onClick={onFlexPay}
            >
              <span className="acct-btn__title">{busy === "flex" ? t("working") : t("flexCta")}</span>
              <span className="acct-btn__price">${total}</span>
            </button>
          </div>
        )
      ) : switchDone || (currentPlan && switchConfirm) ? (
        <div className="acct-sheet-panel">
          {switchDone ? (
            <>
              <p className="acct-sheet-panel__name">{tAccount("planChangeScheduledTitle")}</p>
              <p className="acct-sheet-panel__body">
                {tAccount("planChangeScheduledBody", {
                  plan: planName(switchDone),
                  date: periodLabel,
                  current: currentPlan ? planName(currentPlan) : "—",
                })}
              </p>
              <button type="button" className="acct-btn acct-btn--gold" onClick={onClose}>
                {tAccount("refundDone")}
              </button>
            </>
          ) : switchConfirm ? (
            <>
              <p className="acct-sheet-panel__name">{tAccount("planChangeConfirmTitle")}</p>
              <p className="acct-sheet-panel__body">
                {tAccount("planChangeConfirmBody", {
                  plan: planName(switchConfirm),
                  date: periodLabel,
                  current: currentPlan ? planName(currentPlan) : "—",
                })}
              </p>
              <button
                type="button"
                className="acct-btn acct-btn--gold"
                disabled={busy !== null}
                onClick={() => void confirmPlanSwitch()}
              >
                {busy ? t("working") : tAccount("planChangeConfirmCta")}
              </button>
              <button
                type="button"
                className="acct-text-link"
                disabled={busy !== null}
                onClick={() => setSwitchConfirm(null)}
              >
                {t("adjustQty")}
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="acct-sheet-panel acct-sheet-panel--plans">
          {effectivePending && currentPlan ? (
            <p className="acct-sheet-panel__body">
              {tAccount("planChangePendingBanner", {
                plan: planName(effectivePending),
                date: periodLabel,
              })}
            </p>
          ) : null}

          <div className={`acct-buy-plan${currentPlan === "personal" ? " is-current" : ""}`}>
            <div className="acct-buy-plan__head">
              <p className="acct-sheet__section-label">{t("subLab")}</p>
              {currentPlan === "personal" ? (
                <span className="acct-badge">{tAccount("currentPlan")}</span>
              ) : effectivePending === "personal" ? (
                <span className="acct-badge">{tAccount("pendingPlanBadge")}</span>
              ) : null}
            </div>
            <p className="acct-buy-price">
              <span className="acct-buy-price__cur">$</span>
              <span className="acct-buy-price__num">29.90</span>
              <span className="acct-buy-price__unit">{t("subUnit")}</span>
            </p>
            <p className="acct-sheet-panel__name">{t("personalTitle")}</p>
            <p className="acct-metric__hint">{t("personalBadge")}</p>
            <p className="acct-buy-bonus">{t("personalBonus")}</p>
            <button
              type="button"
              className="acct-btn acct-btn--gold acct-btn--gold-stack"
              disabled={busy !== null || currentPlan === "personal"}
              aria-disabled={currentPlan === "personal"}
              onClick={() => onSelectPlan("personal")}
            >
              <span className="acct-btn__title">
                {currentPlan === "personal"
                  ? tAccount("currentPlanLocked")
                  : busy === "personal"
                    ? t("working")
                    : t("personalTitle")}
              </span>
              {currentPlan === "personal" ? null : <span className="acct-btn__price">$29.90</span>}
            </button>
          </div>

          <div className={`acct-buy-plan${currentPlan === "team" ? " is-current" : ""}`}>
            <div className="acct-buy-plan__head">
              <p className="acct-sheet__section-label">{t("subLab")}</p>
              {currentPlan === "team" ? (
                <span className="acct-badge">{tAccount("currentPlan")}</span>
              ) : effectivePending === "team" ? (
                <span className="acct-badge">{tAccount("pendingPlanBadge")}</span>
              ) : null}
            </div>
            <p className="acct-buy-price">
              <span className="acct-buy-price__cur">$</span>
              <span className="acct-buy-price__num">59.90</span>
              <span className="acct-buy-price__unit">{t("subUnit")}</span>
            </p>
            <p className="acct-sheet-panel__name">{t("teamTitle")}</p>
            <p className="acct-metric__hint">{t("teamBadge")}</p>
            <p className="acct-buy-bonus">{t("teamBonus")}</p>
            <button
              type="button"
              className="acct-btn acct-btn--gold acct-btn--gold-stack"
              disabled={busy !== null || currentPlan === "team"}
              aria-disabled={currentPlan === "team"}
              onClick={() => onSelectPlan("team")}
            >
              <span className="acct-btn__title">
                {currentPlan === "team"
                  ? tAccount("currentPlanLocked")
                  : busy === "team"
                    ? t("working")
                    : t("teamTitle")}
              </span>
              {currentPlan === "team" ? null : <span className="acct-btn__price">$59.90</span>}
            </button>
          </div>

          {currentPlan ? <p className="acct-empty">{tAccount("changePlanHint")}</p> : null}

          {effectivePending && currentPlan ? (
            <button
              type="button"
              className="acct-text-link"
              disabled={busy !== null}
              onClick={() => void cancelPendingSwitch()}
            >
              {tAccount("planChangeCancelPending")}
            </button>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="acct-alert acct-alert--center" role="alert">
          {error}
        </p>
      ) : null}
    </AccountDetailSheet>
  );
}
