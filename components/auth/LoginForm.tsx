"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useRedirectIfSignedIn } from "@/components/auth/use-redirect-if-signed-in";
import { Link } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { navigateAfterAuth, safeNextPath } from "@/lib/auth/auth-helpers";

export type LoginBindSeatOpts = {
  title: string;
  subtitle?: string;
  replace?: boolean;
  /**
   * Absolute invite URL for OAuth bind (copy-only). Empty string while loading.
   * Never causes OAuth into the current browser.
   */
  bindInviteAbsoluteUrl: string;
  onBound: () => void;
  onCancel: () => void;
  /** Switch to signup form (same overlay) — mirrors login page footer link. */
  onGoSignup: () => void;
};

type Props = {
  initialNext?: string | null;
  initialError?: string | null;
  /** Reuse this login card for household seat bind (title override + bind APIs). */
  bindSeat?: LoginBindSeatOpts | null;
};

export function LoginForm({
  initialNext = null,
  initialError = null,
  bindSeat = null,
}: Props) {
  const t = useTranslations("auth.login");
  const [error, setError] = useState<string | null>(initialError);
  const [lastEmail, setLastEmail] = useState("");
  const inFlight = useRef(false);
  const next = safeNextPath(initialNext, "/");
  useRedirectIfSignedIn(next, { enabled: !bindSeat });

  return (
    <AuthCard
      title={bindSeat?.title ?? t("title")}
      subtitle={bindSeat?.subtitle ?? t("subtitle")}
      onClose={bindSeat?.onCancel}
      footer={
        <p>
          {t("noAccount")}{" "}
          {bindSeat ? (
            <button type="button" className="auth-inline-link" onClick={bindSeat.onGoSignup}>
              {t("goSignup")}
            </button>
          ) : (
            <Link href={`/signup?next=${encodeURIComponent(next)}`}>{t("goSignup")}</Link>
          )}
        </p>
      }
    >
      <OAuthButtons
        nextPath={next}
        bindInviteAbsoluteUrl={bindSeat ? bindSeat.bindInviteAbsoluteUrl : null}
      />
      <AuthErrorText code={error} email={lastEmail} nextPath={next} />
      <EmailPasswordForm
        mode="login"
        submitLabel={t("submit")}
        submittingLabel={t("submitting")}
        onSubmit={async ({ email, password }) => {
          if (inFlight.current) return;
          inFlight.current = true;
          setError(null);
          setLastEmail(email);
          try {
            if (bindSeat) {
              const { ok, data } = await postAuthJson("/api/household/bind-seat", {
                email,
                password,
                replace: bindSeat.replace === true,
              });
              if (!ok) {
                setError(data.error ?? "auth_failed");
                return;
              }
              bindSeat.onBound();
              return;
            }
            const { ok, data } = await postAuthJson("/api/auth/login", { email, password });
            if (!ok) {
              setError(data.error ?? "auth_failed");
              return;
            }
            navigateAfterAuth(next);
          } finally {
            inFlight.current = false;
          }
        }}
      />
      <div className="auth-links-row">
        <Link
          href="/forgot-password"
          className="auth-btn auth-btn--ghost"
          target={bindSeat ? "_blank" : undefined}
          rel={bindSeat ? "noreferrer" : undefined}
        >
          {t("forgot")}
        </Link>
        <Link
          href="/verify"
          className="auth-btn auth-btn--ghost"
          target={bindSeat ? "_blank" : undefined}
          rel={bindSeat ? "noreferrer" : undefined}
        >
          {t("otpEntry")}
        </Link>
      </div>
    </AuthCard>
  );
}
