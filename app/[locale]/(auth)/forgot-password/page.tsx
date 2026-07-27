"use client";

import { Suspense, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { Link } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";

const schema = z.object({
  email: z.string().email().max(254),
});

type Values = z.infer<typeof schema>;

function ForgotForm() {
  const t = useTranslations("auth.forgot");
  const tFields = useTranslations("auth.fields");
  const tErr = useTranslations("auth.errors");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <p>
          <Link href="/login">{t("backLogin")}</Link>
        </p>
      }
    >
      {done ? <p className="auth-success">{t("success")}</p> : null}
      <AuthErrorText code={error} />
      {!done ? (
        <form
          className="auth-form"
          onSubmit={handleSubmit(async ({ email }) => {
            if (inFlight.current) return;
            inFlight.current = true;
            setSubmitting(true);
            setError(null);
            try {
              const { ok, data } = await postAuthJson("/api/auth/forgot-password", { email });
              if (!ok) {
                setError(data.error ?? "send_failed");
                return;
              }
              setDone(true);
            } finally {
              inFlight.current = false;
              setSubmitting(false);
            }
          })}
          noValidate
        >
          <label className="auth-field">
            <span>{tFields("email")}</span>
            <input
              type="email"
              autoComplete="email"
              placeholder={tFields("emailPlaceholder")}
              disabled={submitting}
              {...register("email")}
            />
            {errors.email ? <em>{tErr("invalid_email")}</em> : null}
          </label>
          <button type="submit" className="auth-btn auth-btn--primary" disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </button>
        </form>
      ) : null}
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-card" aria-hidden />}>
      <ForgotForm />
    </Suspense>
  );
}
