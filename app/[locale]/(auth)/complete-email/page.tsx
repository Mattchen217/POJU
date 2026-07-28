"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { Link, useRouter } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/auth/auth-helpers";
import { OAUTH_POPUP_MESSAGE_TYPE } from "@/lib/auth/oauth-popup";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { userNeedsEmail } from "@/lib/auth/user-identity";

function CompleteEmailForm() {
  const t = useTranslations("auth.completeEmail");
  const tFields = useTranslations("auth.fields");
  const tLogin = useTranslations("auth.login");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, ready, signOut, refresh } = useAuthUser();
  const next = safeNextPath(searchParams.get("next"), "/app");
  const isPopup = searchParams.get("popup") === "1";

  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!userNeedsEmail(user)) {
      finishSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when session ready
  }, [ready, user]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setInterval(() => setResendLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendLeft]);

  function finishSuccess() {
    if (isPopup) {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: OAUTH_POPUP_MESSAGE_TYPE,
              status: "ok",
              next,
            },
            window.location.origin,
          );
        }
      } catch {
        /* ignore */
      }
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }
    router.replace(next);
    router.refresh();
  }

  async function sendEmail() {
    if (inFlight.current || !email.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await postAuthJson<{ already_complete?: boolean }>(
        "/api/auth/complete-email",
        {
          email: email.trim().toLowerCase(),
          next,
        },
      );
      if (!ok) {
        setError(data.error ?? "send_failed");
        return;
      }
      if (data.already_complete) {
        await refresh();
        finishSuccess();
        return;
      }
      setStep("code");
      setResendLeft(60);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function verify(token: string) {
    if (inFlight.current || token.length !== 6 || !email.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await postAuthJson("/api/auth/complete-email/verify", {
        email: email.trim().toLowerCase(),
        token,
      });
      if (!ok) {
        setError(data.error ?? "invalid_code");
        return;
      }
      await refresh();
      finishSuccess();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title={t("title")}
      subtitle={step === "email" ? t("subtitle") : t("codeSubtitle", { email })}
      footer={
        <p>
          <button
            type="button"
            className="auth-btn auth-btn--ghost"
            disabled={busy}
            onClick={() => {
              void signOut().then(() => {
                router.replace("/login");
                router.refresh();
              });
            }}
          >
            {t("logout")}
          </button>
          {" · "}
          <Link href="/login">{tLogin("title")}</Link>
        </p>
      }
    >
      <AuthErrorText code={error} />

      {step === "email" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void sendEmail();
          }}
        >
          <label className="auth-field">
            <span>{tFields("email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
              placeholder={tFields("emailPlaceholder")}
              disabled={busy}
              required
            />
          </label>
          <button type="submit" className="auth-btn auth-btn--primary" disabled={busy || !email}>
            {busy ? t("sending") : t("submit")}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <OtpCodeInput
            value={code}
            onChange={setCode}
            disabled={busy}
            onComplete={(c) => void verify(c)}
          />
          <button
            type="button"
            className="auth-btn auth-btn--primary"
            disabled={busy || code.length !== 6}
            onClick={() => void verify(code)}
          >
            {busy ? t("verifying") : t("verify")}
          </button>
          <button
            type="button"
            className="auth-btn auth-btn--ghost"
            disabled={busy || resendLeft > 0}
            onClick={() => void sendEmail()}
          >
            {resendLeft > 0 ? `${t("resend")} (${resendLeft})` : t("resend")}
          </button>
          <button
            type="button"
            className="auth-btn auth-btn--ghost"
            disabled={busy}
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            {t("changeEmail")}
          </button>
        </div>
      )}
    </AuthCard>
  );
}

export default function CompleteEmailPage() {
  return (
    <Suspense fallback={<div className="auth-card" aria-hidden />}>
      <CompleteEmailForm />
    </Suspense>
  );
}
