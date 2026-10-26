"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import "@/styles/session-prep.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onBound: () => void;
};

/**
 * Bind second subscription seat: email + password (existing login or new register).
 * Does not switch the current signed-in session.
 */
export function BindSeatModal({ open, onClose, onBound }: Props) {
  const t = useTranslations("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/household/bind-seat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(mapBindError(data.error, t));
        return;
      }
      setEmail("");
      setPassword("");
      onBound();
      onClose();
    } catch {
      setError(t("bindSeatNetworkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="confirm-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("bindSeatTitle")}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="confirm-dialog" style={{ maxWidth: 420 }}>
        <div className="confirm-dialog__header">
          <h2>{t("bindSeatTitle")}</h2>
          <button
            type="button"
            className="confirm-dialog__back-link"
            disabled={busy}
            onClick={onClose}
          >
            {t("bindSeatCancel")}
          </button>
        </div>
        <p className="description">{t("bindSeatHint")}</p>
        <label className="bind-seat-field">
          <span>{t("bindSeatEmail")}</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="bind-seat-field">
          <span>{t("bindSeatPassword")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="bind-seat-error">{error}</p> : null}
        <div className="dialog-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="primary"
            disabled={busy || !email.trim() || password.length < 8}
            onClick={() => void submit()}
          >
            {busy ? t("bindSeatWorking") : t("bindSeatSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}

function mapBindError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (code) {
    case "invalid_credentials":
      return t("bindSeatBadCredentials");
    case "cannot_bind_self":
      return t("bindSeatSelf");
    case "already_full":
      return t("bindSeatFull");
    case "already_in_household":
      return t("bindSeatTaken");
    case "no_subscription":
      return t("bindSeatNoSub");
    case "only_seat_a_can_bind":
      return t("bindSeatNotOwner");
    default:
      return t("bindSeatFailed");
  }
}
