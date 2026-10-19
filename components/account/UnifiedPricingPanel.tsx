"use client";

import { useTranslations } from "next-intl";

import { CheckoutLegalFootnotes } from "@/components/account/CheckoutLegalFootnotes";

export const FLEX_UNIT_USD = 19.99;
export const PERSONAL_USD = 59.99;

export type UnifiedPricingBusy = "flex" | "personal" | "team" | null;

type Props = {
  qty: number;
  onQtyChange: (next: number) => void;
  busy: UnifiedPricingBusy;
  onBuyFlex: (qty: number) => void;
  onSubscribePersonal: () => void;
  /** @deprecated Spend order is not on landing Pricing twin; default false. */
  showSpendOrder?: boolean;
  showPersonal?: boolean;
  showFlex?: boolean;
  /** When true, Subscription card is hidden (already subscribed). */
  hideSubscription?: boolean;
  /** Active Personal/Team entitlement — hides Subscription card on non-landing Buy. */
  subscribed?: boolean;
  personalCtaLabel?: string;
  footnoteMode?: "flex" | "subscription" | "both";
  personalDisabled?: boolean;
  className?: string;
};

/**
 * Shared Pricing panel twin of landing `#v2-pricing` dual cards + starry chrome.
 * Non-landing: pass `subscribed` / `hideSubscription` to show Buy Pass only.
 * Landing HTML stays always dual. No assent checkbox — footnotes only.
 */
export function UnifiedPricingPanel({
  qty,
  onQtyChange,
  busy,
  onBuyFlex,
  onSubscribePersonal,
  showSpendOrder = false,
  showPersonal = true,
  showFlex = true,
  hideSubscription = false,
  subscribed = false,
  personalCtaLabel,
  footnoteMode = "both",
  personalDisabled = false,
  className,
}: Props) {
  const t = useTranslations("passPurchase");
  const safeQty = Math.max(1, Math.min(99, qty));
  const total = (safeQty * FLEX_UNIT_USD).toFixed(2);
  const flexCtaLabel =
    busy === "flex"
      ? t("working")
      : safeQty === 1
        ? t("flexCtaLabel")
        : t("flexCtaLabelMany", { n: safeQty });
  const flexFeatures = t.raw("flexFeatures") as string[];
  const personalFeatures = t.raw("personalFeatures") as string[];
  const personalBonusFeature = t("personalBonusFeature");
  const showSub = showPersonal && !hideSubscription && !subscribed;

  return (
    <div className={`unified-pricing-panel${className ? ` ${className}` : ""}`}>
      {showSpendOrder ? <p className="pass-buy__sub">{t("spendOrder")}</p> : null}

      <div
        className={`pass-buy__grid${!showSub || !showFlex ? " pass-buy__grid--single" : ""}`}
      >
        {showFlex ? (
          <article className="pass-buy-card v2-price-card-twin" data-plan="flex">
            <div className="pass-buy-card__top">
              <div className="pass-buy-card__icon" aria-hidden="true">
                <span className="material-symbols-outlined">confirmation_number</span>
              </div>
              <p className="pass-buy-card__amount">
                <span className="pass-buy-card__amount-price">$19.99</span>
                <span className="pass-buy-card__amount-unit">{t("flexUnit")}</span>
              </p>
            </div>
            <h3 className="pass-buy-card__name">{t("flexTitle")}</h3>
            <p className="pass-buy-card__badge">{t("flexBadge")}</p>
            <div className="pass-buy-card__meta">
              <span className="pass-buy-card__meta-lab">{t("quantity")}</span>
              <div className="pass-buy-card__qty" role="group" aria-label={t("quantity")}>
                <button
                  type="button"
                  className="pass-buy-card__qty-btn"
                  disabled={busy !== null || safeQty <= 1}
                  onClick={() => onQtyChange(Math.max(1, safeQty - 1))}
                  aria-label={t("qtyMinus")}
                >
                  −
                </button>
                <span className="pass-buy-card__qty-val">
                  {safeQty === 1 ? t("qtyOne", { n: safeQty }) : t("qtyMany", { n: safeQty })}
                </span>
                <button
                  type="button"
                  className="pass-buy-card__qty-btn"
                  disabled={busy !== null || safeQty >= 99}
                  onClick={() => onQtyChange(Math.min(99, safeQty + 1))}
                  aria-label={t("qtyPlus")}
                >
                  +
                </button>
              </div>
            </div>
            <ul className="pass-buy-card__list">
              {(Array.isArray(flexFeatures) ? flexFeatures : []).map((line, i) => (
                <li key={`flex-f-${i}`} className="pass-buy-card__feature">
                  <span className="pass-buy-card__feature-dot" aria-hidden="true" />
                  <span className="pass-buy-card__feature-text">{line}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="pass-buy-card__cta pass-buy-card__cta--stack"
              disabled={busy !== null}
              onClick={() => onBuyFlex(safeQty)}
            >
              <span className="pass-buy-card__cta-title">{flexCtaLabel}</span>
              {busy === "flex" ? null : (
                <span className="pass-buy-card__cta-price">${total}</span>
              )}
            </button>
          </article>
        ) : null}

        {showSub ? (
          <article
            className="pass-buy-card pass-buy-card--sub v2-price-card-twin"
            data-plan="personal"
          >
            <div className="pass-buy-card__top">
              <div className="pass-buy-card__icon" aria-hidden="true">
                <span className="material-symbols-outlined">subscriptions</span>
              </div>
              <p className="pass-buy-card__amount">
                <span className="pass-buy-card__amount-price">$59.99</span>
                <span className="pass-buy-card__amount-unit">{t("subUnit")}</span>
              </p>
            </div>
            <h3 className="pass-buy-card__name">{t("personalTitle")}</h3>
            <p className="pass-buy-card__badge">{t("personalBadge")}</p>
            <div className="pass-buy-card__meta">
              <span className="pass-buy-card__meta-lab">{t("allocation")}</span>
              <span className="pass-buy-card__meta-val">{t("personalPassCount")}</span>
            </div>
            <ul className="pass-buy-card__list">
              {(Array.isArray(personalFeatures) ? personalFeatures : []).map((line, i) => (
                <li key={`sub-f-${i}`} className="pass-buy-card__feature">
                  <span className="pass-buy-card__feature-dot" aria-hidden="true" />
                  <span className="pass-buy-card__feature-text">{line}</span>
                </li>
              ))}
              {personalBonusFeature ? (
                <li className="pass-buy-card__feature is-bonus">
                  <span className="pass-buy-card__feature-dot" aria-hidden="true" />
                  <span className="pass-buy-card__feature-text">{personalBonusFeature}</span>
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              className="pass-buy-card__cta pass-buy-card__cta--stack"
              disabled={busy !== null || personalDisabled}
              onClick={() => onSubscribePersonal()}
            >
              <span className="pass-buy-card__cta-title">
                {busy === "personal" ? t("working") : personalDisabled ? t("alreadyOnPlan") : (personalCtaLabel ?? t("personalCta"))}
              </span>
              {busy === "personal" || personalDisabled ? null : (
                <span className="pass-buy-card__cta-price">${PERSONAL_USD.toFixed(2)}</span>
              )}
            </button>
          </article>
        ) : null}
      </div>

      <CheckoutLegalFootnotes mode={footnoteMode} />
    </div>
  );
}
