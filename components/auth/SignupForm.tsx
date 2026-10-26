"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useRedirectIfSignedIn } from "@/components/auth/use-redirect-if-signed-in";
import { Link } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { navigateAfterAuth, safeNextPath } from "@/lib/auth/auth-helpers";

export type SignupBindSeatOpts = {
  title: string;
  subtitle?: string;
  replace?: boolean;
  oauthNextPath: string;
  onBound: () => void;
  onCancel: () => void;
  onGoLogin: () => void;
};

type Props = {
  initialNext?: string | null;
  bindSeat?: SignupBindSeatOpts | null;
};

export function SignupForm({ initialNext = null, bindSeat = null }: Props) {
  const t = useTranslations("auth.signup");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const inFlight = useRef(false);
  const next = safeNextPath(initialNext, "/");
  const oauthNext = bindSeat?.oauthNextPath ?? next;
  useRedirectIfSignedIn(next, { enabled: !bindSeat && !otpOpen });

  return (
    <AuthCard
      title={bindSeat?.title ?? t("title")}
      subtitle={bindSeat?.subtitle ?? t("subtitle")}
      onClose={bindSeat?.onCancel}
      footer={
        <p>
          {t("hasAccount")}{" "}
          {bindSeat ? (
            <button type="button" className="auth-inline-link" onClick={bindSeat.onGoLogin}>
              {t("goLogin")}
            </button>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(next)}`}>{t("goLogin")}</Link>
          )}
        </p>
      }
    >
      <OAuthButtons nextPath={oauthNext} />
      <AuthErrorText code={error} email={lastEmail} nextPath={oauthNext} />
      <EmailPasswordForm
        mode="signup"
        submitLabel={t("submit")}
        submittingLabel={t("submitting")}
        onOtpOpenChange={setOtpOpen}
        onSendCode={async ({ email, password }) => {
          setError(null);
          setLastEmail(email);
          const { ok, data } = await postAuthJson<{
            needs_verification?: boolean;
            email_send_warning?: boolean;
            email?: string;
            error?: string;
          }>("/api/auth/signup", { email, password, locale });
          if (!ok) {
            setError(data.error ?? "auth_failed");
            return { ok: false, error: data.error ?? "auth_failed" };
          }
          if (data.email_send_warning) {
            setError("send_failed");
          }
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
            if (bindSeat) {
              const { ok, data } = await postAuthJson("/api/household/bind-seat-verify", {
                email,
                token,
                replace: bindSeat.replace === true,
              });
              if (!ok) {
                setError(data.error ?? "invalid_code");
                throw new Error(data.error ?? "invalid_code");
              }
              bindSeat.onBound();
              return;
            }
            const { ok, data } = await postAuthJson("/api/auth/verify-signup", {
              email,
              token,
            });
            if (!ok) {
              setError(data.error ?? "invalid_code");
              throw new Error(data.error ?? "invalid_code");
            }
            navigateAfterAuth(next);
          } finally {
            inFlight.current = false;
          }
        }}
      />
    </AuthCard>
  );
}
