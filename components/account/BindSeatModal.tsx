"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { postAuthJson } from "@/lib/auth/post-auth-json";

import "@/styles/session-prep.css";
import "@/components/auth/auth.css";

type Props = {
  open: boolean;
  /** Replace existing seat B with a new account. */
  replace?: boolean;
  onClose: () => void;
  onBound: () => void;
};

type Mode = "login" | "signup";

/**
 * Bind / replace seat B with the same login/signup UX (OAuth + email/password + OTP).
 * Email paths bind without switching the current session.
 * OAuth uses invite accept URL (open in private window if needed).
 */
export function BindSeatModal({ open, replace = false, onClose, onBound }: Props) {
  const t = useTranslations("account");
  const tLogin = useTranslations("auth.login");
  const tSignup = useTranslations("auth.signup");
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const inFlight = useRef(false);

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const ensureInvite = useCallback(async () => {
    const res = await fetch("/api/household/invite-seat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replace }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      invite_path?: string;
      token?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "invite_failed");
    }
    const path = data.invite_path
      ? `/${locale}${data.invite_path}`
      : data.token
        ? `/${locale}/account/household/accept?token=${encodeURIComponent(data.token)}`
        : null;
    const token =
      data.token ??
      (data.invite_path?.includes("token=")
        ? decodeURIComponent(data.invite_path.split("token=")[1] ?? "")
        : "");
    setInvitePath(path);
    setInviteToken(token || null);
    return { path, token: token || null };
  }, [locale, replace]);

  useEffect(() => {
    if (!open) {
      stopPoll();
      return;
    }
    setError(null);
    setCopied(false);
    setMode("login");
    void ensureInvite().catch((e) => {
      setError(e instanceof Error ? e.message : "invite_failed");
    });
    return () => stopPoll();
  }, [open, ensureInvite, stopPoll]);

  function startPolling() {
    stopPoll();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const res = await fetch("/api/household/me", { credentials: "same-origin" });
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            household?: { peer_bound?: boolean } | null;
            seats?: Array<{ role: string; email: string | null }>;
          };
          const seatB = data.seats?.find((s) => s.role === "seat_b");
          if (data.ok && data.household?.peer_bound && seatB?.email) {
            stopPoll();
            onBound();
            onClose();
          }
        } catch {
          /* ignore */
        }
      })();
    }, 2500);
  }

  async function copyInviteLink() {
    try {
      const ensured = invitePath
        ? { path: invitePath, token: inviteToken }
        : await ensureInvite();
      if (!ensured.path) return;
      const absolute = `${window.location.origin}${ensured.path}`;
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      startPolling();
    } catch {
      setError("invite_failed");
    }
  }

  if (!open) return null;

  const oauthNext = invitePath ?? `/${locale}/account/household/accept`;

  return (
    <div
      className="confirm-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={replace ? t("changeBoundAccountTitle") : t("bindSeatTitle")}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopPoll();
          onClose();
        }
      }}
    >
      <div className="confirm-dialog bind-seat-dialog" tabIndex={-1}>
        <div className="confirm-dialog__header">
          <h2>{replace ? t("changeBoundAccountTitle") : t("bindSeatTitle")}</h2>
          <button
            type="button"
            className="confirm-dialog__back-link"
            onClick={() => {
              stopPoll();
              onClose();
            }}
          >
            {t("bindSeatCancel")}
          </button>
        </div>

        <p className="description">
          {replace ? t("changeBoundAccountHint") : t("bindSeatHintFull")}
        </p>

        <div className="bind-seat-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "is-active" : undefined}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            {tLogin("title")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "is-active" : undefined}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            {tSignup("title")}
          </button>
        </div>

        <div className="bind-seat-auth auth-card__body">
          <OAuthButtons nextPath={oauthNext} />
          <p className="bind-seat-oauth-note">{t("bindSeatOAuthNote")}</p>
          <div className="bind-seat-invite-row">
            <button type="button" className="acct-text-link" onClick={() => void copyInviteLink()}>
              {copied ? t("bindSeatLinkCopied") : t("bindSeatCopyLink")}
            </button>
          </div>

          <AuthErrorText code={error} email={lastEmail} nextPath={oauthNext} />

          {mode === "login" ? (
            <EmailPasswordForm
              mode="login"
              submitLabel={t("bindSeatSubmitLogin")}
              submittingLabel={t("bindSeatWorking")}
              onSubmit={async ({ email, password }) => {
                if (inFlight.current) return;
                inFlight.current = true;
                setError(null);
                setLastEmail(email);
                try {
                  const { ok, data } = await postAuthJson("/api/household/bind-seat", {
                    email,
                    password,
                    replace,
                  });
                  if (!ok) {
                    setError(data.error ?? "auth_failed");
                    return;
                  }
                  onBound();
                  onClose();
                } finally {
                  inFlight.current = false;
                }
              }}
            />
          ) : (
            <EmailPasswordForm
              mode="signup"
              submitLabel={t("bindSeatSubmitSignup")}
              submittingLabel={t("bindSeatWorking")}
              onSendCode={async ({ email, password }) => {
                setError(null);
                setLastEmail(email);
                const { ok, data } = await postAuthJson<{
                  needs_verification?: boolean;
                  email_send_warning?: boolean;
                  error?: string;
                }>("/api/auth/signup", { email, password, locale });
                if (!ok) {
                  setError(data.error ?? "auth_failed");
                  return { ok: false, error: data.error ?? "auth_failed" };
                }
                if (data.email_send_warning) setError("send_failed");
                return { ok: true };
              }}
              onSubmit={async ({ email, token }) => {
                if (inFlight.current) return;
                if (!token || token.length !== 6) {
                  setError("invalid_code");
                  throw new Error("invalid_code");
                }
                inFlight.current = true;
                setError(null);
                setLastEmail(email);
                try {
                  const { ok, data } = await postAuthJson("/api/household/bind-seat-verify", {
                    email,
                    token,
                    replace,
                  });
                  if (!ok) {
                    setError(data.error ?? "invalid_code");
                    throw new Error(data.error ?? "invalid_code");
                  }
                  onBound();
                  onClose();
                } finally {
                  inFlight.current = false;
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
