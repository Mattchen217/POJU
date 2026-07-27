"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

type Props = {
  password: string;
};

function scorePassword(password: string): 0 | 1 | 2 | 3 {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;
  return Math.min(3, score) as 0 | 1 | 2 | 3;
}

export function PasswordStrengthHint({ password }: Props) {
  const t = useTranslations("auth.strength");
  const score = useMemo(() => scorePassword(password), [password]);
  if (!password) return null;

  const labels = [t("weak"), t("fair"), t("good"), t("strong")] as const;

  return (
    <div className="auth-strength" aria-live="polite">
      <div className="auth-strength__label">
        {t("label")}: <strong>{labels[score]}</strong>
      </div>
      <div className="auth-strength__bars" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= score ? "is-on" : undefined} />
        ))}
      </div>
    </div>
  );
}
