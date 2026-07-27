"use client";

import { useTranslations } from "next-intl";

type Props = {
  code?: string | null;
  className?: string;
};

export function AuthErrorText({ code, className }: Props) {
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
    "link_expired",
    "unauthorized",
    "auth_failed",
    "server_error",
    "send_failed",
    "checkout_failed",
  ] as const;
  const key = (known as readonly string[]).includes(code) ? code : "auth_failed";
  return (
    <p className={["auth-error", className].filter(Boolean).join(" ")} role="alert">
      {t(key)}
    </p>
  );
}
