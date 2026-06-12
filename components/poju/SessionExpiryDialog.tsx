"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { getSessionDaysLeft } from "@/lib/poju/expiry-reminder";

type SessionExpiryDialogProps = {
  sessionId: string;
  expiresAt: string;
  open: boolean;
  mode: "warning" | "expired";
  paymentBusy?: boolean;
  onDismiss: (opts: { snooze: boolean }) => void;
  onExtend: (opts: { snooze: boolean }) => void | Promise<void>;
};

export function SessionExpiryDialog({
  sessionId,
  expiresAt,
  open,
  mode,
  paymentBusy = false,
  onDismiss,
  onExtend,
}: SessionExpiryDialogProps) {
  const t = useTranslations("poju.expiry");
  const [dontRemind, setDontRemind] = useState(false);

  if (!open) return null;

  const daysLeft = Math.max(getSessionDaysLeft(expiresAt), 0);
  const bodyKey = mode === "expired" ? "dialog_body_expired" : "dialog_body_warning";

  return (
    <div
      className="pchat-expiry-overlay"
      role="presentation"
      data-session-id={sessionId}
    >
      <div
        className="pchat-expiry-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pchat-expiry-title"
        aria-describedby="pchat-expiry-desc"
      >
        <h2 id="pchat-expiry-title" className="pchat-expiry-dialog__title">
          {mode === "expired" ? t("dialog_title_expired") : t("dialog_title_warning")}
        </h2>
        <p id="pchat-expiry-desc" className="pchat-expiry-dialog__body">
          {t(bodyKey, { days: daysLeft, price: t("price") })}
        </p>

        <div className="pchat-expiry-dialog__actions">
          <button
            type="button"
            className="pchat-expiry-dialog__primary"
            disabled={paymentBusy}
            onClick={() => void onExtend({ snooze: dontRemind })}
          >
            {paymentBusy ? t("redirecting_payment") : t("extend_30_paid", { price: t("price") })}
          </button>
          {mode === "warning" ? (
            <button
              type="button"
              className="pchat-expiry-dialog__secondary"
              disabled={paymentBusy}
              onClick={() => onDismiss({ snooze: dontRemind })}
            >
              {t("acknowledge")}
            </button>
          ) : null}
        </div>

        {mode === "warning" ? (
          <label className="pchat-expiry-dialog__check">
            <input
              type="checkbox"
              checked={dontRemind}
              onChange={(e) => setDontRemind(e.target.checked)}
              disabled={paymentBusy}
            />
            <span>{t("dont_remind")}</span>
          </label>
        ) : null}
      </div>
    </div>
  );
}
