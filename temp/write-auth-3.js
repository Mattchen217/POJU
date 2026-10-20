const fs = require("fs");
const path = require("path");
function write(rel, content) {
  fs.writeFileSync(path.join("D:/POJU/pojulife", rel), content, "utf8");
  console.log("wrote", rel);
}

write("components/auth/EmailPasswordForm.tsx", `"use client";

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
  /** Signup: create user / (re)send OTP. Return error code on failure. */
  onSendCode?: (values: {
    email: string;
    password: string;
    confirm?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onSubmit: (values: EmailPasswordValues) => Promise<void>;
};

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
  const [codeSent, setCodeSent] = useState(false);
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

  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setInterval(() => setResendLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendLeft]);

  async function sendCode() {
    if (!onSendCode || sendingCode || submitting || disabled || resendLeft > 0) return;
    const fields =
      mode === "signup"
        ? (["email", "password", "confirm"] as const)
        : (["email", "password"] as const);
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
      setCodeSent(true);
      setOtp("");
      setResendLeft(60);
    } finally {
      setSendingCode(false);
    }
  }

  const busy = submitting || sendingCode || Boolean(disabled);
  const signupNeedsCode = mode === "signup" && Boolean(onSendCode);

  return (
    <form
      className="auth-form"
      onSubmit={handleSubmit(async (values) => {
        if (busy) return;
        if (signupNeedsCode) {
          if (!codeSent) {
            setSendError("code_required");
            return;
          }
          if (otp.length !== 6) {
            setSendError("invalid_code");
            return;
          }
        }
        setSubmitting(true);
        setSendError(null);
        try {
          await onSubmit({
            ...values,
            token: signupNeedsCode ? otp : undefined,
          });
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
          disabled={busy || (signupNeedsCode && codeSent)}
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
            disabled={busy || (signupNeedsCode && codeSent)}
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
                disabled={busy || (signupNeedsCode && codeSent)}
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
          {!codeSent ? (
            <button
              type="button"
              className="auth-btn auth-btn--secondary"
              disabled={busy || resendLeft > 0}
              onClick={() => void sendCode()}
            >
              {sendingCode ? tSignup("sendingCode") : tSignup("sendCode")}
            </button>
          ) : (
            <>
              <p className="auth-verify-block__hint">{tSignup("codeSentHint")}</p>
              <OtpCodeInput value={otp} onChange={setOtp} disabled={busy} />
              <button
                type="button"
                className="auth-btn auth-btn--ghost"
                disabled={busy || resendLeft > 0}
                onClick={() => void sendCode()}
              >
                {tSignup("resendCode")}
                {resendLeft > 0 ? \` (\${resendLeft}s)\` : ""}
              </button>
            </>
          )}
          {sendError ? (
            <em className="auth-inline-error">
              {sendError === "code_required"
                ? tSignup("codeRequired")
                : tErr(
                    (
                      [
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
                      ] as const
                    ).includes(sendError as never)
                      ? (sendError as "send_failed")
                      : "send_failed",
                  )}
            </em>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        className="auth-btn auth-btn--primary"
        disabled={busy || (signupNeedsCode && (!codeSent || otp.length !== 6))}
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
`);

write("components/auth/AuthErrorText.tsx", `"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/auth/auth-helpers";

type Props = {
  code?: string | null;
  className?: string;
  /** When set, email_not_confirmed shows a finish-verify CTA. */
  email?: string | null;
  nextPath?: string | null;
};

export function AuthErrorText({ code, className, email, nextPath }: Props) {
  const t = useTranslations("auth.errors");
  if (!code) return null;
  const known = [
    "invalid_payload",
    "invalid_email",
    "invalid_credentials",
    "email_not_confirmed",
    "email_taken",
    "weak_password",
    "password_mismatch",
    "rate_limited",
    "invalid_code",
    "oauth_failed",
    "oauth_redirect_blocked",
    "link_expired",
    "unauthorized",
    "auth_failed",
    "server_error",
    "send_failed",
    "checkout_failed",
  ] as const;
  const key = (known as readonly string[]).includes(code) ? code : "auth_failed";
  const next = safeNextPath(nextPath, "/");
  const verifyHref = (() => {
    const q = new URLSearchParams({ mode: "signup", next });
    if (email) q.set("email", email.trim().toLowerCase());
    return \`/verify?\${q.toString()}\`;
  })();

  return (
    <div className={["auth-error", className].filter(Boolean).join(" ")} role="alert">
      <p className="auth-error__text">{t(key)}</p>
      {key === "email_not_confirmed" ? (
        <p className="auth-error__cta">
          <Link href={verifyHref}>{t("finishVerifyCta")}</Link>
        </p>
      ) : null}
    </div>
  );
}
`);

write("app/not-found.tsx", `import Link from "next/link";

import { GlassCard } from "@/components/ui/GlassCard";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <GlassCard variant="elevated" padding="lg" className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Path not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This page does not exist in the current Eastern OS universe map.
        </p>
        <Link href="/" className="glass-btn glass-btn-primary mt-5 inline-flex">
          Return Home
        </Link>
      </GlassCard>
    </div>
  );
}
`);

console.log("components done");
