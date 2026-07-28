"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useRedirectIfSignedIn } from "@/components/auth/use-redirect-if-signed-in";
import { Link, useRouter } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { safeNextPath } from "@/lib/auth/auth-helpers";

function LoginForm() {
  const t = useTranslations("auth.login");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const inFlight = useRef(false);
  const next = safeNextPath(searchParams.get("next"), "/app");
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
      <AuthErrorText code={error} />
      <EmailPasswordForm
        mode="login"
        submitLabel={t("submit")}
        submittingLabel={t("submitting")}
        onSubmit={async ({ email, password }) => {
          if (inFlight.current) return;
          inFlight.current = true;
          setError(null);
          try {
            const { ok, data } = await postAuthJson("/api/auth/login", { email, password });
            if (!ok) {
              setError(data.error ?? "auth_failed");
              return;
            }
            router.replace(next);
            router.refresh();
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-card" aria-hidden />}>
      <LoginForm />
    </Suspense>
  );
}
