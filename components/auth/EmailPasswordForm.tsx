"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

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

export type EmailPasswordValues = z.infer<typeof schema>;

type Props = {
  mode: "login" | "signup";
  submitLabel: string;
  submittingLabel: string;
  disabled?: boolean;
  onSubmit: (values: EmailPasswordValues) => Promise<void>;
};

export function EmailPasswordForm({
  mode,
  submitLabel,
  submittingLabel,
  disabled,
  onSubmit,
}: Props) {
  const t = useTranslations("auth.fields");
  const tErr = useTranslations("auth.errors");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmailPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirm: mode === "signup" ? "" : undefined },
  });

  const password = watch("password") ?? "";

  return (
    <form
      className="auth-form"
      onSubmit={handleSubmit(async (values) => {
        if (submitting || disabled) return;
        setSubmitting(true);
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
          disabled={submitting || disabled}
          {...register("email")}
        />
        {errors.email ? <em>{tErr("invalid_email")}</em> : null}
      </label>

      <label className="auth-field">
        <span>{t("password")}</span>
        <input
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={t("passwordPlaceholder")}
          disabled={submitting || disabled}
          {...register("password")}
        />
        {errors.password ? <em>{tErr("weak_password")}</em> : null}
      </label>

      {mode === "signup" ? (
        <>
          <PasswordStrengthHint password={password} />
          <label className="auth-field">
            <span>{t("confirmPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              disabled={submitting || disabled}
              {...register("confirm", { required: true })}
            />
            {errors.confirm ? <em>{tErr("password_mismatch")}</em> : null}
          </label>
        </>
      ) : null}

      <button type="submit" className="auth-btn auth-btn--primary" disabled={submitting || disabled}>
        {submitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
