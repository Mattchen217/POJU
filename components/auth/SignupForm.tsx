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

type Props = {
  initialNext?: string | null;
};

export function SignupForm({ initialNext = null }: Props) {
  const t = useTranslations("auth.signup");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const inFlight = useRef(false);
  // Default landing. Start CTA passes next=/app (localized) via query string.
  const next = safeNextPath(initialNext, "/");
  // Pause auto-leave while OTP modal is open — a leftover signup session used
  // to fire SIGNED_IN and bounce → /app → /login, closing the modal instantly.
  useRedirectIfSignedIn(next, { enabled: !otpOpen });

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <p>
          {t("hasAccount")}{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`}>{t("goLogin")}</Link>
        </p>
      }
    >
      <OAuthButtons nextPath={next} />
      <AuthErrorText code={error} email={lastEmail} nextPath={next} />
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
          // Never enter the app from send-code alone — OTP modal verifies next.
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
