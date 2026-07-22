"use client";

import { useTranslations } from "next-intl";

type Props = {
  /** Optional registered email; falls back to placeholder until auth ships. */
  email?: string | null;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  active?: boolean;
};

/** Account row: person icon + email only. Click opens Profile panel. */
export function WorkspaceAccountPlaceholder({
  email,
  compact = false,
  className,
  onClick,
  active = false,
}: Props) {
  const t = useTranslations("workspace");
  const displayEmail = (email?.trim() || t("emailPlaceholder")).trim();
  const classes = [
    "workspace-account-chip",
    onClick ? "workspace-account-chip--button" : "",
    active ? "is-active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className="material-symbols-outlined workspace-account-chip__icon" aria-hidden>
        person
      </span>
      {!compact ? (
        <span className="workspace-account-chip__email">{displayEmail}</span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        title={displayEmail}
        aria-label={displayEmail}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        data-tooltip={displayEmail}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={classes} title={displayEmail}>
      {inner}
    </div>
  );
}
