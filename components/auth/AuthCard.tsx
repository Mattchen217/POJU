"use client";

import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: Props) {
  return (
    <div className="auth-card">
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
