const fs = require("fs");
const path = require("path");
function write(rel, content) {
  // bracket paths need careful join
  const p = path.join("D:/POJU/pojulife", rel);
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel);
}

write("app/[locale]/(auth)/signup/page.tsx", `"use client";

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

/** Prefer full navigation when \`next\` carries a query (avoids i18n path+search 404s). */
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
          <Link href={\`/login?next=\${encodeURIComponent(next)}\`}>{t("goLogin")}</Link>
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
            existing_unconfirmed?: boolean;
            email?: string;
            error?: string;
          }>("/api/auth/signup", { email, password });
          if (!ok) {
            // Confirmed duplicate — do not open OTP UI.
            return { ok: false, error: data.error ?? "auth_failed" };
          }
          // Confirm-email off: session already established — finish without OTP.
          if (data.needs_verification === false) {
            goNext(router, next);
            return { ok: false, error: undefined };
          }
          return { ok: true };
        }}
        onSubmit={async ({ email, token }) => {
          if (inFlight.current) return;
          if (!token || token.length !== 6) {
            setError("invalid_code");
            return;
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
              return;
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
`);

write("app/[locale]/(auth)/login/page.tsx", `"use client";

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

function goNext(router: ReturnType<typeof useRouter>, next: string) {
  if (next.includes("?")) {
    window.location.assign(next);
    return;
  }
  router.replace(next);
  router.refresh();
}

function LoginForm() {
  const t = useTranslations("auth.login");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(searchParams.get("error"));
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
          {t("noAccount")}{" "}
          <Link href={\`/signup?next=\${encodeURIComponent(next)}\`}>{t("goSignup")}</Link>
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
            goNext(router, next);
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
`);

console.log("pages done");
