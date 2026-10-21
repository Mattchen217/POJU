"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { PasswordStrengthHint } from "@/components/auth/PasswordStrengthHint";

const schema = z
  .object({
    email: z.string().email().max(254),
    password: z.string().min(8).max(128),
    confirm: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.confirm != null && val.confirm !== val.password) {
      ctx.addIssue({ code: "custom", message: "password_mismatch", path: ["confirm"] });
    }
  });

export type EmailPasswordValues = z.infer<typeof schema> & { token?: string };

type Props = {
  mode: "login" | "signup";
  submitLabel: string;
  submittingLabel: string;
  disabled?: boolean;
  /** Signup: create user / (re)send OTP. Never logs the user in. */
  onSendCode?: (values: {
    email: string;
    password: string;
    confirm?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Login submit, or signup OTP verify (called automatically when 6 digits entered). */
  onSubmit: (values: EmailPasswordValues) => Promise<void>;
};

const ERROR_CODES = [
  "invalid_payload",
  "invalid_email",
  "invalid_credentials",
  "email_not_confirmed",
  "email_taken",
  "weak_password",
  "password_mismatch",
  "rate_limited",
  "invalid_code",
  "auth_failed",
  "server_error",
  "send_failed",
  "confirm_email_required",
] as const;

function PasswordVisibilityToggle({
  visible,
  onToggle,
  showLabel,
  hideLabel,
}: {
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <button
      type="button"
      className="auth-field__toggle"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={visible ? hideLabel : showLabel}
    >
      {visible ? hideLabel : showLabel}
    </button>
  );
}

function isKnownError(code: string): code is (typeof ERROR_CODES)[number] {
  return (ERROR_CODES as readonly string[]).includes(code);
}

export function EmailPasswordForm({
  mode,
  submitLabel,
  submittingLabel,
  disabled,
  onSendCode,
  onSubmit,
}: Props) {
  const t = useTranslations("auth.fields");
  const tErr = useTranslations("auth.errors");
  const tSignup = useTranslations("auth.signup");
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendLeft, setResendLeft] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirm: mode === "signup" ? "" : undefined },
  });

  const password = watch("password") ?? "";
  const signupNeedsCode = mode === "signup" && Boolean(onSendCode);
  const busy = submitting || sendingCode || Boolean(disabled);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setInterval(() => setResendLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendLeft]);

  async function sendCode() {
    if (!onSendCode || sendingCode || submitting || disabled || resendLeft > 0) return;
    const fields = ["email", "password", "confirm"] as const;
    const valid = await trigger(fields as unknown as (keyof z.infer<typeof schema>)[]);
    if (!valid) return;
    const values = getValues();
    setSendingCode(true);
    setSendError(null);
    try {
      const result = await onSendCode({
        email: values.email,
        password: values.password,
        confirm: values.confirm,
      });
      if (!result.ok) {
        setSendError(result.error ?? "send_failed");
        return;
      }
      setOtpOpen(true);
      setOtp("");
      setResendLeft(60);
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyOtp(token: string) {
    if (!signupNeedsCode || submitting || token.length !== 6) return;
    const values = getValues();
    setSubmitting(true);
    setSendError(null);
    try {
      await onSubmit({ ...values, token });
    } catch (err) {
      const code = err instanceof Error ? err.message : "invalid_code";
      setSendError(isKnownError(code) ? code : "invalid_code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        className="auth-form"
        onSubmit={handleSubmit(async (values) => {
          if (busy) return;
          if (signupNeedsCode) {
            // Signup completes via OTP modal only — never via this submit.
            void sendCode();
            return;
          }
          setSubmitting(true);
          setSendError(null);
          try {
            await onSubmit(values);
          } finally {
            setSubmitting(false);
          }
        })}
        noValidate
      >
        <label className="auth-field">
          <span>{t("email")}</span>
          <input
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            disabled={busy}
            {...register("email")}
          />
          {errors.email ? <em>{tErr("invalid_email")}</em> : null}
        </label>

        <label className="auth-field">
          <span>{t("password")}</span>
          <div className="auth-field__control">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={t("passwordPlaceholder")}
              disabled={busy}
              {...register("password")}
            />
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
            />
          </div>
          {errors.password ? <em>{tErr("weak_password")}</em> : null}
        </label>

        {mode === "signup" ? (
          <>
            <PasswordStrengthHint password={password} />
            <label className="auth-field">
              <span>{t("confirmPassword")}</span>
              <div className="auth-field__control">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  disabled={busy}
                  {...register("confirm", { required: true })}
                />
                <PasswordVisibilityToggle
                  visible={showConfirm}
                  onToggle={() => setShowConfirm((v) => !v)}
                  showLabel={t("showPassword")}
                  hideLabel={t("hidePassword")}
                />
              </div>
              {errors.confirm ? <em>{tErr("password_mismatch")}</em> : null}
            </label>
          </>
        ) : null}

        {signupNeedsCode ? (
          <div className="auth-verify-block">
            <button
              type="button"
              className="auth-btn auth-btn--primary"
              disabled={busy || resendLeft > 0}
              onClick={() => void sendCode()}
            >
              {sendingCode ? tSignup("sendingCode") : tSignup("sendCode")}
            </button>
            {sendError && !otpOpen ? (
              <em className="auth-inline-error">
                {sendError === "code_required"
                  ? tSignup("codeRequired")
                  : tErr(isKnownError(sendError) ? sendError : "send_failed")}
              </em>
            ) : null}
          </div>
        ) : (
          <button type="submit" className="auth-btn auth-btn--primary" disabled={busy}>
            {submitting ? submittingLabel : submitLabel}
          </button>
        )}
      </form>

      {signupNeedsCode && otpOpen ? (
        <div
          className="auth-otp-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-otp-modal-title"
        >
          <div className="auth-otp-modal__panel">
            <h2 id="auth-otp-modal-title" className="auth-otp-modal__title">
              {tSignup("otpModalTitle")}
            </h2>
            <p className="auth-otp-modal__hint">{tSignup("otpModalHint")}</p>
            <OtpCodeInput
              value={otp}
              onChange={setOtp}
              disabled={busy}
              onComplete={(code) => void verifyOtp(code)}
            />
            {submitting ? <p className="auth-otp-modal__status">{tSignup("verifying")}</p> : null}
            {sendError ? (
              <em className="auth-inline-error">
                {tErr(isKnownError(sendError) ? sendError : "invalid_code")}
              </em>
            ) : null}
            <div className="auth-otp-modal__actions">
              <button
                type="button"
                className="auth-btn auth-btn--ghost"
                disabled={busy || resendLeft > 0}
                onClick={() => void sendCode()}
              >
                {tSignup("resendCode")}
                {resendLeft > 0 ? ` (${resendLeft}s)` : ""}
              </button>
              <button
                type="button"
                className="auth-btn auth-btn--ghost"
                disabled={busy}
                onClick={() => {
                  setOtpOpen(false);
                  setOtp("");
                  setSendError(null);
                }}
              >
                {tSignup("otpModalClose")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
