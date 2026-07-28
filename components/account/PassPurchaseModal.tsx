"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { startPassCheckout } from "@/lib/passes/start-checkout";
import "@/styles/pass-purchase-modal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Why the modal opened — e.g. unlock blocked. */
  reason?: "insufficient" | "choose";
};

/**
 * Site-wide Pass gate modal: Buy Flex + Subscribe Personal.
 * Upper half only (title / price / badge / bonus) — no feature bullet lists.
 * Spend order is enforced server-side: subscription bucket → flex bucket.
 */
export function PassPurchaseModal({ open, onClose, reason = "insufficient" }: Props) {
  const t = useTranslations("passPurchase");
  const locale = useLocale();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"flex" | "personal" | "team" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
          {reason === "insufficient" ? t("titleInsufficient") : t("titleChoose")}
        </h2>
        <p className="pass-buy__sub">{t("spendOrder")}</p>

        <div className="pass-buy__grid">
          {/* 1 · Buy Flex */}
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
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                aria-label={t("qtyMinus")}
              >
                −
              </button>
              <span className="pass-buy-card__qty-val">{qty}</span>
              <button
                type="button"
                className="pass-buy-card__qty-btn"
                disabled={busy !== null || qty >= 99}
                onClick={() => setQty((n) => Math.min(99, n + 1))}
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

          {/* 2 · Subscribe Personal */}
          <article className="pass-buy-card pass-buy-card--sub">
            <p className="pass-buy-card__lab">{t("subLab")}</p>
            <p className="pass-buy-card__price">
              <span className="pass-buy-card__cur">$</span>
              <span className="pass-buy-card__num">29.90</span>
              <span className="pass-buy-card__unit">{t("subUnit")}</span>
            </p>
            <h3 className="pass-buy-card__name">{t("personalTitle")}</h3>
            <p className="pass-buy-card__badge">{t("personalBadge")}</p>
            <p className="pass-buy-card__bonus">{t("personalBonus")}</p>
            <button
              type="button"
              className="pass-buy-card__cta pass-buy-card__cta--primary"
              disabled={busy !== null}
              onClick={() => void checkout("personal_plan")}
            >
              {busy === "personal" ? t("working") : t("personalCta")}
            </button>
          </article>
        </div>

        {error ? (
          <p className="pass-buy__err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
