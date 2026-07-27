"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Close control — defaults to home. */
  showClose?: boolean;
  closeHref?: string;
};

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  showClose = true,
  closeHref = "/",
}: Props) {
  const t = useTranslations("auth.brand");
  const closeLabel = t("close");

  return (
    <div className="auth-card">
      {showClose ? (
        <Link href={closeHref} className="auth-card__close" aria-label={closeLabel} title={closeLabel}>
          <span aria-hidden="true">×</span>
        </Link>
      ) : null}
      <div className="auth-card__brand">
        <Link href="/" className="auth-card__logo" aria-label="Eastern OS home">
          <img src="/v2/LOGO.png" alt="Eastern OS" className="auth-card__logo-img" />
        </Link>
      </div>
      <h1 className="auth-card__title">{title}</h1>
      {subtitle ? <p className="auth-card__subtitle">{subtitle}</p> : null}
      <div className="auth-card__body">{children}</div>
      {footer ? <div className="auth-card__footer">{footer}</div> : null}
    </div>
  );
}
