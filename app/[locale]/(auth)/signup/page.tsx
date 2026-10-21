"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useRedirectIfSignedIn } from "@/components/auth/use-redirect-if-signed-in";
import { Link, useRouter } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { safeNextPath } from "@/lib/auth/auth-helpers";

/** Prefer full navigation when `next` carries a query (avoids i18n path+search 404s). */
function goNext(router: ReturnType<typeof useRouter>, next: string) {
  if (next.includes("?")) {
    window.location.assign(next);
    return;
  }
  router.replace(next);
  router.refresh();
}

function SignupForm() {
  const t = useTranslations("auth.signup");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const inFlight = useRef(false);
  const next = safeNextPath(searchParams.get("next"), "/");
  useRedirectIfSignedIn(next);

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
            goNext(router, next);
          } finally {
            inFlight.current = false;
          }
        }}
      />
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="auth-card" aria-hidden />}>
      <SignupForm />
    </Suspense>
  );
}
