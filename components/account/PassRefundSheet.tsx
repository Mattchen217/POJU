"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { AccountDetailSheet } from "@/components/account/AccountDetailSheet";

type Props = {
  open: boolean;
  onClose: () => void;
  flexBalance: number;
  onRefunded: () => void;
};

export function PassRefundSheet({ open, onClose, flexBalance, onRefunded }: Props) {
  const t = useTranslations("account");
  const tPass = useTranslations("passPurchase");
  const max = Math.max(0, Math.floor(flexBalance));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQty(max > 0 ? 1 : 0);
    setBusy(false);
    setError(null);
  }, [open, max]);

  async function confirmRefund() {
    if (busy || qty < 1 || qty > max) return;
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
        return;
      }
      onRefunded();
      onClose();
    } catch {
      setError("refund_failed");
    } finally {
      setBusy(false);
    }
  }

  const qtyLabel = qty === 1 ? tPass("qtyOne", { n: qty }) : tPass("qtyMany", { n: qty });

  return (
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
              disabled={busy || qty < 1 || qty > max}
              onClick={() => void confirmRefund()}
            >
              <span className="acct-btn__title">{busy ? t("refundWorking") : t("refundConfirm")}</span>
            </button>

            <button type="button" className="acct-text-link" disabled={busy} onClick={onClose}>
              {t("deleteCancel")}
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
  );
}
