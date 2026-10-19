"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

import {
  UnifiedPricingPanel,
  type UnifiedPricingBusy,
} from "@/components/account/UnifiedPricingPanel";
import { startPassCheckout } from "@/lib/passes/start-checkout";
import {
  stashPendingPaywallUnlock,
  type PendingPaywallUnlockInput,
} from "@/lib/passes/pending-paywall-unlock";
import "@/styles/pass-purchase-modal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  reason?: "insufficient" | "choose";
  /**
   * full — Flex + Personal (Pricing twin; default Buy everywhere)
   * flex — Flex only (account Acquire PASS)
   * subscribe — plan switch / subscribe (Personal; Team gated off)
   */
  variant?: "full" | "flex" | "subscribe";
  unlockAfterPurchase?: PendingPaywallUnlockInput;
  currentPlan?: "personal" | "team" | null;
};

const TEAM_CHECKOUT_ENABLED = false;

/**
 * Site-wide Pass Buy / Subscribe modal — center portal + UnifiedPricingPanel.
 * Checkout → startPassCheckout → /api/checkout/create → mock/success confirm → creditPassesFromCheckout.
 * No per-purchase assent checkbox (first-login DisclaimerModal covers must-agree).
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
  const [busy, setBusy] = useState<UnifiedPricingBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceFlex, setForceFlex] = useState(false);
  const [detectedPlan, setDetectedPlan] = useState<"personal" | "team" | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQty(1);
    setBusy(null);
    setError(null);
    setForceFlex(false);
  }, [open]);

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
          subscription?: { plan?: string | null };
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

  // Escape + light focus trap
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    const focusables = () =>
      sheet
        ? Array.from(
            sheet.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];
    const first = focusables()[0];
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheet) return;
      const list = focusables();
      if (list.length === 0) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (i <= 0) {
          e.preventDefault();
          list[list.length - 1]?.focus();
        }
      } else if (i === list.length - 1) {
        e.preventDefault();
        list[0]?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

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
    if (plan === "team_plan" && !TEAM_CHECKOUT_ENABLED) {
      setError("Family/Team plan is not available.");
      return;
    }
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

  const total = (Math.max(1, qty) * 19.99).toFixed(2);
  const showFlex = variant === "full" || variant === "flex";
  // Default Buy UI: always Flex + Personal (no Team). Already-on-plan disables Personal CTA.
  let showPersonal = false;
  if (variant === "subscribe") {
    showPersonal = currentPlan !== "personal";
  } else if (variant === "full") {
    showPersonal = true;
  } else if (tip === "u3") {
    showPersonal = true;
  }

  const isDowngrade = variant === "full" && currentPlan === "team";
  const personalDisabled = variant === "full" && currentPlan === "personal";

  const title =
    variant === "flex"
      ? t("titleFlexOnly")
      : variant === "subscribe"
        ? t("titleSwitchPlan")
        : reason === "insufficient"
          ? t("titleInsufficient")
          : t("titleChoose");

  return createPortal(
    <div
      className="pass-buy-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="pass-buy-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pass-buy-title"
      >
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

        {tip ? (
          <div className="pass-buy-tip" role="status">
            <p className="pass-buy-tip__title">{t(`${tip}_title`)}</p>
            <p className="pass-buy-tip__body">{t(`${tip}_body`, { n: qty, total })}</p>
            <div className="pass-buy-tip__actions">
              <button
                type="button"
                className="pass-buy-card__cta pass-buy-card__cta--primary"
                disabled={busy !== null}
                onClick={() => void checkout("personal_plan")}
              >
                {busy === "personal" ? t("working") : t(`${tip}_upgrade`)}
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
          <UnifiedPricingPanel
            qty={qty}
            onQtyChange={(n) => {
              setForceFlex(false);
              setQty(n);
            }}
            busy={busy}
            onBuyFlex={(n) => void checkout("flex_pass", n)}
            onSubscribePersonal={() => void checkout("personal_plan")}
            showSpendOrder={variant === "full" || variant === "subscribe"}
            showFlex={showFlex}
            showPersonal={showPersonal}
            personalDisabled={personalDisabled}
            personalLabLabel={isDowngrade ? t("downgradeLab") : undefined}
            personalBonusLabel={isDowngrade ? t("personalSwitchBonus") : undefined}
            personalCtaLabel={isDowngrade ? t("personalSwitchCta") : undefined}
            footnoteMode={
              variant === "flex" ? "flex" : variant === "subscribe" ? "subscription" : "both"
            }
          />
        )}

        {error ? (
          <p className="pass-buy__err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
