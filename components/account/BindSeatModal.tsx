"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";

import "@/components/auth/auth.css";

type Props = {
  open: boolean;
  replace?: boolean;
  onClose: () => void;
  onBound: () => void;
};

type View = "login" | "signup";

/**
 * Full-site login/signup card for binding seat B — same LoginForm / SignupForm,
 * only the title changes. No custom tabs.
 */
export function BindSeatModal({ open, replace = false, onClose, onBound }: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [view, setView] = useState<View>("login");
  /** Empty until invite token is ready — never send OAuth to accept without token. */
  const [oauthNext, setOauthNext] = useState("");

  const ensureInvite = useCallback(async () => {
    const res = await fetch("/api/household/invite-seat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replace }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      invite_path?: string;
      token?: string;
    };
    if (!res.ok || !data.ok) return;
    const path = data.invite_path
      ? `/${locale}${data.invite_path}`
      : data.token
        ? `/${locale}/account/household/accept?token=${encodeURIComponent(data.token)}`
        : null;
    if (path && path.includes("token=")) setOauthNext(path);
  }, [locale, replace]);

  useEffect(() => {
    if (!open) return;
    setView("login");
    setOauthNext("");
    void ensureInvite();
  }, [open, ensureInvite]);

  if (!open) return null;

  const title = replace ? t("changeBoundAccountTitle") : t("bindSeatTitle");
  const subtitle = replace ? t("changeBoundAccountHint") : t("bindSeatPageSubtitle");

  function finish() {
    onBound();
    onClose();
  }

  return (
    <div className="bind-seat-auth-shell" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bind-seat-auth-shell__inner">
        {view === "login" ? (
          <LoginForm
            bindSeat={{
              title,
              subtitle,
              replace,
              oauthNextPath: oauthNext,
              onBound: finish,
              onCancel: onClose,
              onGoSignup: () => setView("signup"),
            }}
          />
        ) : (
          <SignupForm
            bindSeat={{
              title,
              subtitle,
              replace,
              oauthNextPath: oauthNext,
              onBound: finish,
              onCancel: onClose,
              onGoLogin: () => setView("login"),
            }}
          />
        )}
      </div>
    </div>
  );
}
