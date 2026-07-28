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

function SignupForm() {
  const t = useTranslations("auth.signup");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
      <AuthErrorText code={error} />
      <EmailPasswordForm
        mode="signup"
        submitLabel={t("submit")}
        submittingLabel={t("submitting")}
        onSubmit={async ({ email, password }) => {
          if (inFlight.current) return;
          inFlight.current = true;
          setError(null);
          try {
            const { ok, data } = await postAuthJson<{
              needs_verification?: boolean;
              email?: string;
              error?: string;
            }>("/api/auth/signup", { email, password });
            if (!ok) {
              setError(data.error ?? "auth_failed");
              return;
            }
            if (data.needs_verification !== false) {
              const q = new URLSearchParams({
                email,
                mode: "signup",
                next,
              });
              router.push(`/verify?${q.toString()}`);
              return;
            }
            router.replace(next);
            router.refresh();
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
