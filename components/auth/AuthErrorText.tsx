"use client";

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
    return `/verify?${q.toString()}`;
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
