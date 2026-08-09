"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { startPassCheckout } from "@/lib/passes/start-checkout";
import {
  stashPendingPaywallUnlock,
  type PendingPaywallUnlockInput,
} from "@/lib/passes/pending-paywall-unlock";
import "@/styles/pass-purchase-modal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Why the modal opened — e.g. unlock blocked. */
  reason?: "insufficient" | "choose";
  /**
   * full — buy flex + subscribe/upgrade (paywalls)
   * flex — account “Acquire PASS”: flex qty only, with 3/6 upgrade tips
   * subscribe — switch plan: Personal + Team
   */
  variant?: "full" | "flex" | "subscribe";
  /**
   * When set (paywall buy flows), re-stash before redirect so return-to-page
   * can auto-spend 1 Pass and finish unlock.
   */
  unlockAfterPurchase?: PendingPaywallUnlockInput;
  /** Override detected plan (tests / account sheets). */
  currentPlan?: "personal" | "team" | null;
};

const FLEX_UNIT_USD = 9.99;

/**
 * Site-wide Pass gate modal.
 * Exhausted Personal → Flex buy OR upgrade to Team (20).
 * Exhausted Team → Flex buy OR downgrade to Personal (7).
 * No sub → Flex + Personal first subscribe.
 * Spend order (server): carryover → subscription → flex.
 */
export function PassPurchaseModal({
  open,
  onClose,
  reason = "insufficient",
  variant = "full",
  unlockAfterPurchase,
  currentPlan: currentPlanProp,
}: Props) {
  const t = useTranslations("passPurchase");
  const locale = useLocale();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"flex" | "personal" | "team" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** After tip: user chose to keep flex checkout */
  const [forceFlex, setForceFlex] = useState(false);
  const [detectedPlan, setDetectedPlan] = useState<"personal" | "team" | null>(null);

  useEffect(() => {
    if (!open) return;
    if (currentPlanProp === "personal" || currentPlanProp === "team") {
      setDetectedPlan(currentPlanProp);
      return;
    }
    if (currentPlanProp === null) {
      setDetectedPlan(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/account/summary", { credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as {
          subscription?: { plan?: string | null; status?: string };
        };
        if (cancelled) return;
        const plan = data.subscription?.plan;
        setDetectedPlan(plan === "personal" || plan === "team" ? plan : null);
      } catch {
        if (!cancelled) setDetectedPlan(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentPlanProp]);

  const currentPlan = currentPlanProp !== undefined ? currentPlanProp : detectedPlan;

  const tip = useMemo(() => {
    if (variant !== "flex" || forceFlex) return null;
    if (qty >= 6) return "u6" as const;
    if (qty >= 3) return "u3" as const;
    return null;
  }, [variant, qty, forceFlex]);

  if (!open) return null;

  async function checkout(
    plan: "flex_pass" | "personal_plan" | "team_plan",
    quantity?: number,
  ) {
    if (busy) return;
    setBusy(plan === "flex_pass" ? "flex" : plan === "personal_plan" ? "personal" : "team");
    setError(null);
    if (unlockAfterPurchase) {
      stashPendingPaywallUnlock(unlockAfterPurchase);
    }
    const result = await startPassCheckout(
      plan === "flex_pass"
        ? { plan: "flex_pass", quantity: Math.max(1, quantity ?? 1) }
        : { plan },
      locale,
    );
    if (!result.ok && !result.loginRequired) {
      setError(
        result.error === "already_on_plan" ? t("alreadyOnPlan") : t("checkoutFailed"),
      );
      setBusy(null);
    }
  }

  const total = (Math.max(1, qty) * FLEX_UNIT_USD).toFixed(2);
  const showFlex = variant === "full" || variant === "flex";

  /** Paywall / full: existing Personal → Team upgrade; Team → Personal downgrade; none → Personal */
  let showPersonal = false;
  let showTeam = false;
  if (variant === "subscribe") {
    showPersonal = currentPlan !== "personal";
    showTeam = currentPlan !== "team";
  } else if (variant === "full") {
    if (currentPlan === "personal") {
      showTeam = true;
    } else if (currentPlan === "team") {
      showPersonal = true;
    } else {
      showPersonal = true;
    }
  } else if (tip === "u3") {
    showPersonal = true;
  } else if (tip === "u6") {
    showTeam = true;
  }

  const showSpendOrder = variant === "full";
  const isUpgrade = variant === "full" && currentPlan === "personal";
  const isDowngrade = variant === "full" && currentPlan === "team";

  const title =
    variant === "flex"
      ? t("titleFlexOnly")
      : variant === "subscribe"
        ? t("titleSwitchPlan")
        : isUpgrade
          ? t("titleUpgradeOrBuy")
          : isDowngrade
            ? t("titleDowngradeOrBuy")
            : reason === "insufficient"
              ? t("titleInsufficient")
              : t("titleChoose");

  return (
    <div
      className="pass-buy-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pass-buy-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="pass-buy-sheet">
        <button
          type="button"
          className="pass-buy-sheet__close"
          onClick={onClose}
          aria-label={t("close")}
        >
          ×
        </button>

        <p className="pass-buy__eyebrow">{t("eyebrow")}</p>
        <h2 id="pass-buy-title" className="pass-buy__title">
          {title}
        </h2>
        {showSpendOrder ? <p className="pass-buy__sub">{t("spendOrder")}</p> : null}
        {isUpgrade ? <p className="pass-buy__sub">{t("upgradeHint")}</p> : null}

        {tip ? (
          <div className="pass-buy-tip" role="status">
            <p className="pass-buy-tip__title">{t(`${tip}_title`)}</p>
            <p className="pass-buy-tip__body">
              {t(`${tip}_body`, { n: qty, total })}
            </p>
            <div className="pass-buy-tip__actions">
              <button
                type="button"
                className="pass-buy-card__cta pass-buy-card__cta--primary"
                disabled={busy !== null}
                onClick={() => void checkout(tip === "u3" ? "personal_plan" : "team_plan")}
              >
                {busy === (tip === "u3" ? "personal" : "team")
                  ? t("working")
                  : t(`${tip}_upgrade`)}
              </button>
              <button
                type="button"
                className="pass-buy-card__cta"
                disabled={busy !== null}
                onClick={() => void checkout("flex_pass", qty)}
              >
                {busy === "flex" ? t("working") : t(`${tip}_keep`, { n: qty, total })}
              </button>
              <button
                type="button"
                className="pass-buy-tip__back"
                disabled={busy !== null}
                onClick={() => setForceFlex(true)}
              >
                {t("adjustQty")}
              </button>
            </div>
          </div>
        ) : (
          <div className={`pass-buy__grid${variant === "flex" ? " pass-buy__grid--single" : ""}`}>
            {showFlex ? (
              <article className="pass-buy-card">
                <p className="pass-buy-card__lab">{t("flexLab")}</p>
                <p className="pass-buy-card__price">
                  <span className="pass-buy-card__cur">$</span>
                  <span className="pass-buy-card__num">9.99</span>
                  <span className="pass-buy-card__unit">{t("flexUnit")}</span>
                </p>
                <h3 className="pass-buy-card__name">{t("flexTitle")}</h3>
                <p className="pass-buy-card__badge">{t("flexBadge")}</p>
                <div className="pass-buy-card__qty" role="group" aria-label={t("quantity")}>
                  <button
                    type="button"
                    className="pass-buy-card__qty-btn"
                    disabled={busy !== null || qty <= 1}
                    onClick={() => {
                      setForceFlex(false);
                      setQty((n) => Math.max(1, n - 1));
                    }}
                    aria-label={t("qtyMinus")}
                  >
                    −
                  </button>
                  <span className="pass-buy-card__qty-val">{qty}</span>
                  <button
                    type="button"
                    className="pass-buy-card__qty-btn"
                    disabled={busy !== null || qty >= 99}
                    onClick={() => {
                      setForceFlex(false);
                      setQty((n) => Math.min(99, n + 1));
                    }}
                    aria-label={t("qtyPlus")}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="pass-buy-card__cta"
                  disabled={busy !== null}
                  onClick={() => void checkout("flex_pass", qty)}
                >
                  {busy === "flex" ? t("working") : t("flexCta")}
                </button>
              </article>
            ) : null}

            {showPersonal && variant !== "flex" ? (
              <article className="pass-buy-card pass-buy-card--sub">
                <p className="pass-buy-card__lab">
                  {isDowngrade ? t("downgradeLab") : t("subLab")}
                </p>
                <p className="pass-buy-card__price">
                  <span className="pass-buy-card__cur">$</span>
                  <span className="pass-buy-card__num">29.90</span>
                  <span className="pass-buy-card__unit">{t("subUnit")}</span>
                </p>
                <h3 className="pass-buy-card__name">{t("personalTitle")}</h3>
                <p className="pass-buy-card__badge">{t("personalBadge")}</p>
                <p className="pass-buy-card__bonus">
                  {isDowngrade ? t("personalSwitchBonus") : t("personalBonus")}
                </p>
                <button
                  type="button"
                  className="pass-buy-card__cta pass-buy-card__cta--primary"
                  disabled={busy !== null}
                  onClick={() => void checkout("personal_plan")}
                >
                  {busy === "personal"
                    ? t("working")
                    : isDowngrade
                      ? t("personalSwitchCta")
                      : t("personalCta")}
                </button>
              </article>
            ) : null}

            {showTeam && variant !== "flex" ? (
              <article className="pass-buy-card pass-buy-card--sub">
                <p className="pass-buy-card__lab">
                  {isUpgrade ? t("upgradeLab") : t("subLab")}
                </p>
                <p className="pass-buy-card__price">
                  <span className="pass-buy-card__cur">$</span>
                  <span className="pass-buy-card__num">59.90</span>
                  <span className="pass-buy-card__unit">{t("subUnit")}</span>
                </p>
                <h3 className="pass-buy-card__name">{t("teamTitle")}</h3>
                <p className="pass-buy-card__badge">{t("teamBadge")}</p>
                <p className="pass-buy-card__bonus">
                  {isUpgrade ? t("teamUpgradeBonus") : t("teamBonus")}
                </p>
                <button
                  type="button"
                  className="pass-buy-card__cta pass-buy-card__cta--primary"
                  disabled={busy !== null}
                  onClick={() => void checkout("team_plan")}
                >
                  {busy === "team"
                    ? t("working")
                    : isUpgrade
                      ? t("teamUpgradeCta")
                      : t("teamCta")}
                </button>
              </article>
            ) : null}
          </div>
        )}

        {error ? (
          <p className="pass-buy__err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
