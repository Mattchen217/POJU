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
  showSpendOrder?: boolean;
  showPersonal?: boolean;
  showFlex?: boolean;
  personalCtaLabel?: string;
  personalBonusLabel?: string;
  personalLabLabel?: string;
  footnoteMode?: "flex" | "subscription" | "both";
  personalDisabled?: boolean;
  className?: string;
};

/**
 * Shared Pricing panel twin of landing `#v2-pricing` dual cards.
 * Used inside PassPurchaseModal (center portal) and thin wrappers.
 * No assent checkbox — footnotes only (Payments lock).
 */
export function UnifiedPricingPanel({
  qty,
  onQtyChange,
  busy,
  onBuyFlex,
  onSubscribePersonal,
  showSpendOrder = true,
  showPersonal = true,
  showFlex = true,
  personalCtaLabel,
  personalBonusLabel,
  personalLabLabel,
  footnoteMode = "both",
  personalDisabled = false,
  className,
}: Props) {
  const t = useTranslations("passPurchase");
  const safeQty = Math.max(1, Math.min(99, qty));
  const total = (safeQty * FLEX_UNIT_USD).toFixed(2);
  const flexCta =
    busy === "flex"
      ? t("working")
      : safeQty === 1
        ? t("flexCtaTotalOne", { total })
        : t("flexCtaTotalMany", { n: safeQty, total });

  return (
    <div className={`unified-pricing-panel${className ? ` ${className}` : ""}`}>
      {showSpendOrder ? <p className="pass-buy__sub">{t("spendOrder")}</p> : null}

      <div
        className={`pass-buy__grid${!showPersonal || !showFlex ? " pass-buy__grid--single" : ""}`}
      >
        {showFlex ? (
          <article className="pass-buy-card v2-price-card-twin">
            <p className="pass-buy-card__lab">{t("flexLab")}</p>
            <p className="pass-buy-card__price">
              <span className="pass-buy-card__cur">$</span>
              <span className="pass-buy-card__num">19.99</span>
              <span className="pass-buy-card__unit">{t("flexUnit")}</span>
            </p>
            <h3 className="pass-buy-card__name">{t("flexTitle")}</h3>
            <p className="pass-buy-card__badge">{t("flexBadge")}</p>
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
            <button
              type="button"
              className="pass-buy-card__cta pass-buy-card__cta--stack"
              disabled={busy !== null}
              onClick={() => onBuyFlex(safeQty)}
            >
              <span className="pass-buy-card__cta-title">{flexCta}</span>
              {busy === "flex" ? null : (
                <span className="pass-buy-card__cta-price">${total}</span>
              )}
            </button>
          </article>
        ) : null}

        {showPersonal ? (
          <article className="pass-buy-card pass-buy-card--sub v2-price-card-twin">
            <p className="pass-buy-card__lab">{personalLabLabel ?? t("subLab")}</p>
            <p className="pass-buy-card__price">
              <span className="pass-buy-card__cur">$</span>
              <span className="pass-buy-card__num">59.99</span>
              <span className="pass-buy-card__unit">{t("subUnit")}</span>
            </p>
            <h3 className="pass-buy-card__name">{t("personalTitle")}</h3>
            <p className="pass-buy-card__badge">{t("personalBadge")}</p>
            <p className="pass-buy-card__bonus">{personalBonusLabel ?? t("personalBonus")}</p>
            <button
              type="button"
              className="pass-buy-card__cta pass-buy-card__cta--primary pass-buy-card__cta--stack"
              disabled={busy !== null || personalDisabled}
              onClick={() => onSubscribePersonal()}
            >
              <span className="pass-buy-card__cta-title">
                {busy === "personal"
                  ? t("working")
                  : personalDisabled
                    ? t("alreadyOnPlan")
                    : (personalCtaLabel ?? t("personalCta"))}
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
