"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { PasswordStrengthHint } from "@/components/auth/PasswordStrengthHint";
import { Link } from "@/i18n/navigation";
import { navigateAfterAuth } from "@/lib/auth/auth-helpers";
import { postAuthJson } from "@/lib/auth/post-auth-json";

const emailSchema = z.object({
  email: z.string().email().max(254),
});

const passwordSchema = z
  .object({
    password: z.string().min(8).max(128),
    confirm: z.string().min(8).max(128),
  })
  .refine((v) => v.password === v.confirm, {
    message: "password_mismatch",
    path: ["confirm"],
  });

type EmailValues = z.infer<typeof emailSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
type Step = "email" | "otp" | "password" | "done";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const tReset = useTranslations("auth.reset");
  const tFields = useTranslations("auth.fields");
  const tErr = useTranslations("auth.errors");
  const tSignup = useTranslations("auth.signup");
  const locale = useLocale();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setInterval(() => setResendLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendLeft]);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const password = passwordForm.watch("password") ?? "";

  async function sendCode(nextEmail: string) {
    if (inFlight.current || resendLeft > 0) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await postAuthJson("/api/auth/forgot-password", {
        email: nextEmail,
        locale,
      });
      if (!ok) {
        setError(data.error ?? "send_failed");
        return;
      }
      setEmail(nextEmail);
      setOtp("");
      setStep("otp");
      setResendLeft(60);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function verifyCode(token: string) {
    if (inFlight.current || token.length !== 6 || !email) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await postAuthJson("/api/auth/verify-recovery", {
        email,
        token,
      });
      if (!ok) {
        setError(data.error ?? "invalid_code");
        return;
      }
      setStep("password");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function savePassword(values: PasswordValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await postAuthJson("/api/auth/update-password", {
        password: values.password,
        confirm: values.confirm,
      });
      if (!ok) {
        setError(data.error ?? "unauthorized");
        return;
      }
      setStep("done");
      window.setTimeout(() => navigateAfterAuth("/login"), 1200);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title={step === "password" || step === "done" ? tReset("title") : t("title")}
      subtitle={
        step === "otp"
          ? t("otpSubtitle", { email })
          : step === "password" || step === "done"
            ? tReset("subtitle")
            : t("subtitle")
      }
      footer={
        <p>
          <Link href="/login">{t("backLogin")}</Link>
        </p>
      }
    >
      {step === "done" ? <p className="auth-success">{tReset("success")}</p> : null}
      <AuthErrorText code={error} />

      {step === "email" ? (
        <form
          className="auth-form"
          onSubmit={emailForm.handleSubmit(async ({ email: next }) => {
            await sendCode(next.trim().toLowerCase());
          })}
          noValidate
        >
          <label className="auth-field">
            <span>{tFields("email")}</span>
            <input
              type="email"
              autoComplete="email"
              placeholder={tFields("emailPlaceholder")}
              disabled={busy}
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email ? <em>{tErr("invalid_email")}</em> : null}
          </label>
          <button type="submit" className="auth-btn auth-btn--primary" disabled={busy}>
            {busy ? t("submitting") : t("submit")}
          </button>
        </form>
      ) : null}

      {step === "otp" ? (
        <div className="auth-form">
          <OtpCodeInput
            value={otp}
            onChange={setOtp}
            disabled={busy}
            onComplete={(code) => void verifyCode(code)}
          />
          {busy ? <p className="auth-otp-modal__status">{tSignup("verifying")}</p> : null}
          <div className="auth-links-row">
            <button
              type="button"
              className="auth-btn auth-btn--ghost"
              disabled={busy || resendLeft > 0}
              onClick={() => void sendCode(email)}
            >
              {tSignup("resendCode")}
              {resendLeft > 0 ? ` (${resendLeft}s)` : ""}
            </button>
            <button
              type="button"
              className="auth-btn auth-btn--ghost"
              disabled={busy}
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
              }}
            >
              {t("changeEmail")}
            </button>
          </div>
        </div>
      ) : null}

      {step === "password" ? (
        <form
          className="auth-form"
          onSubmit={passwordForm.handleSubmit((values) => void savePassword(values))}
          noValidate
        >
          <label className="auth-field">
            <span>{tFields("password")}</span>
            <div className="auth-field__control">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={tFields("passwordPlaceholder")}
                disabled={busy}
                {...passwordForm.register("password")}
              />
              <button
                type="button"
                className="auth-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? tFields("hidePassword") : tFields("showPassword")}
              >
                {showPassword ? tFields("hidePassword") : tFields("showPassword")}
              </button>
            </div>
            {passwordForm.formState.errors.password ? <em>{tErr("weak_password")}</em> : null}
          </label>
          <PasswordStrengthHint password={password} />
          <label className="auth-field">
            <span>{tFields("confirmPassword")}</span>
            <div className="auth-field__control">
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                disabled={busy}
                {...passwordForm.register("confirm")}
              />
              <button
                type="button"
                className="auth-field__toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-pressed={showConfirm}
                aria-label={showConfirm ? tFields("hidePassword") : tFields("showPassword")}
              >
                {showConfirm ? tFields("hidePassword") : tFields("showPassword")}
              </button>
            </div>
            {passwordForm.formState.errors.confirm ? <em>{tErr("password_mismatch")}</em> : null}
          </label>
          <button type="submit" className="auth-btn auth-btn--primary" disabled={busy}>
            {busy ? tReset("submitting") : tReset("submit")}
          </button>
        </form>
      ) : null}
    </AuthCard>
  );
}
