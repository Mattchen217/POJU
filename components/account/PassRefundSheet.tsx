"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { AccountDetailSheet } from "@/components/account/AccountDetailSheet";

type Props = {
  open: boolean;
  onClose: () => void;
  flexBalance: number;
  onRefunded: () => void;
};

function formatMoney(cents: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale.startsWith("zh") ? "zh-CN" : locale, {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

/**
 * Path A refund UI: qty stepper + dollar CTA + double confirm.
 * Cap = purchased (flex) remaining only.
 */
export function PassRefundSheet({ open, onClose, flexBalance, onRefunded }: Props) {
  const t = useTranslations("account");
  const tPass = useTranslations("passPurchase");
  const locale = useLocale();
  const max = Math.max(0, Math.floor(flexBalance));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQty(max > 0 ? 1 : 0);
    setBusy(false);
    setError(null);
    setAmountCents(null);
    setConfirmOpen(false);
  }, [open, max]);

  useEffect(() => {
    if (!open || qty < 1 || qty > max) {
      setAmountCents(null);
      return;
    }
    let cancelled = false;
    setQuoteBusy(true);
    void (async () => {
      try {
        const res = await fetch("/api/account/pass-refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ quantity: qty, preview: true }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          amount_cents?: number;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || typeof data.amount_cents !== "number") {
          setAmountCents(null);
          setError(data.error ?? "quote_failed");
          return;
        }
        setError(null);
        setAmountCents(data.amount_cents);
      } catch {
        if (!cancelled) {
          setAmountCents(null);
          setError("quote_failed");
        }
      } finally {
        if (!cancelled) setQuoteBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, qty, max]);

  const moneyLabel = useMemo(() => {
    if (amountCents == null) return "—";
    return formatMoney(amountCents, locale);
  }, [amountCents, locale]);

  async function confirmRefund() {
    if (busy || qty < 1 || qty > max || amountCents == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/pass-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ quantity: qty }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "refund_failed");
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      onRefunded();
      onClose();
    } catch {
      setError("refund_failed");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const qtyLabel = qty === 1 ? tPass("qtyOne", { n: qty }) : tPass("qtyMany", { n: qty });
  const primaryDisabled = busy || quoteBusy || qty < 1 || qty > max || amountCents == null;

  return (
    <>
      <AccountDetailSheet
        open={open}
        onClose={onClose}
        title={t("refundTitle")}
        titleId="pass-refund-title"
      >
        <div className="acct-sheet-panel">
          {max < 1 ? (
            <>
              <p className="acct-empty">{t("refundNone")}</p>
              <button type="button" className="acct-btn acct-btn--outline" onClick={onClose}>
                {t("refundDone")}
              </button>
            </>
          ) : (
            <>
              <p className="acct-sheet__section-label">{t("refundQtyLabel")}</p>
              <p className="acct-metric__hint">{t("refundQtyHint", { max })}</p>

              <div className="acct-price-qty" role="group" aria-label={t("refundQtyLabel")}>
                <button
                  type="button"
                  disabled={busy || qty <= 1}
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  aria-label={t("refundQtyMinus")}
                >
                  −
                </button>
                <span className="acct-price-qty__value">{qtyLabel}</span>
                <button
                  type="button"
                  disabled={busy || qty >= max}
                  onClick={() => setQty((n) => Math.min(max, n + 1))}
                  aria-label={t("refundQtyPlus")}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="acct-btn acct-btn--gold acct-btn--gold-stack"
                disabled={primaryDisabled}
                onClick={() => setConfirmOpen(true)}
              >
                <span className="acct-btn__title">
                  {quoteBusy ? t("refundWorking") : t("refundPrimaryCta", { amount: moneyLabel })}
                </span>
              </button>

              <button type="button" className="acct-text-link" disabled={busy} onClick={onClose}>
                {t("refundCancel")}
              </button>

              {error ? (
                <p className="acct-alert" role="alert">
                  {t("refundError")}
                </p>
              ) : null}
            </>
          )}
        </div>
      </AccountDetailSheet>

      <AccountDetailSheet
        open={confirmOpen}
        onClose={() => { if (!busy) setConfirmOpen(false); }}
        title={t("refundConfirmTitle")}
        titleId="pass-refund-confirm-title"
      >
        <div className="acct-sheet-panel">
          <p className="acct-metric__hint">{t("refundConfirmBody")}</p>
          <p className="acct-metric__value acct-metric__value--accent">{moneyLabel}</p>
          <button
            type="button"
            className="acct-btn acct-btn--gold"
            disabled={busy || amountCents == null}
            onClick={() => void confirmRefund()}
          >
            {busy ? t("refundWorking") : t("refundConfirmCta")}
          </button>
          <button
            type="button"
            className="acct-text-link"
            disabled={busy}
            onClick={() => setConfirmOpen(false)}
          >
            {t("refundCancel")}
          </button>
        </div>
      </AccountDetailSheet>
    </>
  );
}
