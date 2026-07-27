"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { PasswordStrengthHint } from "@/components/auth/PasswordStrengthHint";
import { Link, useRouter } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";

const schema = z
  .object({
    password: z.string().min(8).max(128),
    confirm: z.string().min(8).max(128),
  })
  .refine((v) => v.password === v.confirm, {
    message: "password_mismatch",
    path: ["confirm"],
  });

type Values = z.infer<typeof schema>;

function ResetForm() {
  const t = useTranslations("auth.reset");
  const tFields = useTranslations("auth.fields");
  const tErr = useTranslations("auth.errors");
  const searchParams = useSearchParams();
  const router = useRouter();
  const linkError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    linkError === "link_expired" || linkError === "oauth_failed" ? linkError : null,
  );
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const password = watch("password") ?? "";

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <p>
          <Link href="/login">{t("backToLogin")}</Link>
        </p>
      }
    >
      {done ? <p className="auth-success">{t("success")}</p> : null}
      <AuthErrorText code={error} />
      {!done ? (
        <form
          className="auth-form"
          onSubmit={handleSubmit(async ({ password: nextPassword }) => {
            if (inFlight.current) return;
            inFlight.current = true;
            setSubmitting(true);
            setError(null);
            try {
              const { ok, data } = await postAuthJson("/api/auth/update-password", {
                password: nextPassword,
                confirm: nextPassword,
              });
              if (!ok) {
                setError(data.error ?? "unauthorized");
                return;
              }
              setDone(true);
              window.setTimeout(() => {
                router.replace("/login");
              }, 1200);
            } finally {
              inFlight.current = false;
              setSubmitting(false);
            }
          })}
          noValidate
        >
          <label className="auth-field">
            <span>{tFields("password")}</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={tFields("passwordPlaceholder")}
              disabled={submitting}
              {...register("password")}
            />
            {errors.password ? <em>{tErr("weak_password")}</em> : null}
          </label>
          <PasswordStrengthHint password={password} />
          <label className="auth-field">
            <span>{tFields("confirmPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              disabled={submitting}
              {...register("confirm")}
            />
            {errors.confirm ? <em>{tErr("password_mismatch")}</em> : null}
          </label>
          <button type="submit" className="auth-btn auth-btn--primary" disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </button>
        </form>
      ) : null}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-card" aria-hidden />}>
      <ResetForm />
    </Suspense>
  );
}
