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

type Props = {
  initialNext?: string | null;
  initialError?: string | null;
};

export function LoginForm({ initialNext = null, initialError = null }: Props) {
  const t = useTranslations("auth.login");
  const [error, setError] = useState<string | null>(initialError);
  const [lastEmail, setLastEmail] = useState("");
  const inFlight = useRef(false);
  // Default home (landing). Start CTA / middleware pass next=/app (or /zh/app).
  const next = safeNextPath(initialNext, "/");
  useRedirectIfSignedIn(next);

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <p>
          {t("noAccount")}{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`}>{t("goSignup")}</Link>
        </p>
      }
    >
      <OAuthButtons nextPath={next} />
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
        <Link href="/forgot-password" className="auth-btn auth-btn--ghost">
          {t("forgot")}
        </Link>
        <Link href="/verify" className="auth-btn auth-btn--ghost">
          {t("otpEntry")}
        </Link>
      </div>
    </AuthCard>
  );
}
