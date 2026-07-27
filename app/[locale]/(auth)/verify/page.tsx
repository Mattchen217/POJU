"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Link, useRouter } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { safeNextPath } from "@/lib/auth/auth-helpers";

function VerifyForm() {
  const t = useTranslations("auth.verify");
  const tLogin = useTranslations("auth.login");
  const tFields = useTranslations("auth.fields");
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const mode = searchParams.get("mode") === "signup" ? "signup" : "email";
  const next = safeNextPath(searchParams.get("next"), "/app");
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendLeft, setResendLeft] = useState(mode === "signup" ? 60 : 0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setInterval(() => setResendLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendLeft]);

  async function verify(token: string) {
    if (inFlight.current || token.length !== 6 || !email) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const path = mode === "signup" ? "/api/auth/verify-signup" : "/api/auth/otp/verify";
      const { ok, data } = await postAuthJson(path, { email, token });
      if (!ok) {
        setError(data.error ?? "invalid_code");
        return;
      }
      router.replace(next);
      router.refresh();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function sendCode() {
    if (!email || resendLeft > 0 || inFlight.current) return;
    setError(null);
    const path = mode === "signup" ? "/api/auth/resend-signup" : "/api/auth/otp/send";
    const { ok, data } = await postAuthJson(path, { email });
    if (!ok) {
      setError(data.error ?? "send_failed");
      return;
    }
    setResendLeft(60);
  }

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle", { email: email || "…" })}
      footer={
        <p>
          <Link href="/login">{tLogin("title")}</Link>
        </p>
      }
    >
      {!emailParam ? (
        <label className="auth-field">
          <span>{tFields("email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
            placeholder={tFields("emailPlaceholder")}
            disabled={submitting}
          />
        </label>
      ) : null}

      <AuthErrorText code={error} />
      <OtpCodeInput value={code} onChange={setCode} disabled={submitting} onComplete={(c) => void verify(c)} />

      <button
        type="button"
        className="auth-btn auth-btn--primary"
        disabled={submitting || code.length !== 6 || !email}
        onClick={() => void verify(code)}
      >
        {submitting ? t("submitting") : t("submit")}
      </button>

      <div className="auth-links-row">
        <button type="button" className="auth-btn auth-btn--ghost" onClick={() => router.push("/login")}>
          {t("changeEmail")}
        </button>
        <button
          type="button"
          className="auth-btn auth-btn--ghost"
          disabled={resendLeft > 0 || !email}
          onClick={() => void sendCode()}
        >
          {t("resend")}
          {resendLeft > 0 ? ` (${resendLeft}s)` : ""}
        </button>
      </div>
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="auth-card" aria-hidden />}>
      <VerifyForm />
    </Suspense>
  );
}
