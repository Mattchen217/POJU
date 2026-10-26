"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { fetchSeatInviteAbsoluteUrl } from "@/lib/passes/resolve-seat-invite";

import "@/components/auth/auth.css";

type Props = {
  open: boolean;
  replace?: boolean;
  onClose: () => void;
  onBound: () => void;
};

type View = "login" | "signup";

/**
 * Same LoginForm / SignupForm as the site auth pages — title/subtitle only differ.
 * Binding fills seat 2; the current browser session must stay on seat A.
 */
export function BindSeatModal({ open, replace = false, onClose, onBound }: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [view, setView] = useState<View>("login");
  const [inviteAbsoluteUrl, setInviteAbsoluteUrl] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const resolveBindInvite = useCallback(async (): Promise<
    { ok: true; url: string } | { ok: false; error: string }
  > => {
    const result = await fetchSeatInviteAbsoluteUrl({ locale, replace });
    if (!result.ok) {
      setInviteError(result.error);
      setInviteAbsoluteUrl("");
      return { ok: false, error: result.error };
    }
    setInviteAbsoluteUrl(result.absoluteUrl);
    setInviteError(null);
    return { ok: true, url: result.absoluteUrl };
  }, [locale, replace]);

  useEffect(() => {
    if (!open) return;
    setView("login");
    setInviteAbsoluteUrl("");
    setInviteError(null);
    void resolveBindInvite();
  }, [open, resolveBindInvite]);

  if (!open) return null;

  const title = replace ? t("changeBoundAccountTitle") : t("bindSeatTitle");
  const subtitle = replace ? t("changeBoundAccountHint") : t("bindSeatPageSubtitle");

  function finish() {
    onBound();
    onClose();
  }

  const bindOpts = {
    title,
    subtitle,
    replace,
    bindInviteAbsoluteUrl: inviteAbsoluteUrl,
    inviteError,
    resolveBindInvite,
    onBound: finish,
    onCancel: onClose,
  };

  return (
    <div className="bind-seat-auth-shell" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bind-seat-auth-shell__inner">
        {view === "login" ? (
          <LoginForm
            bindSeat={{
              ...bindOpts,
              onGoSignup: () => setView("signup"),
            }}
          />
        ) : (
          <SignupForm
            bindSeat={{
              ...bindOpts,
              onGoLogin: () => setView("login"),
            }}
          />
        )}
      </div>
    </div>
  );
}
