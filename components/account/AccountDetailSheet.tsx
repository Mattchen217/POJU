"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: ReactNode;
  /** Optional sticky footer below the scrollable body (e.g. Pass detail CTAs). */
  footer?: ReactNode;
  /** Extra class on the sheet panel (e.g. acct-sheet--pass-detail for wider chrome). */
  sheetClassName?: string;
};

export function AccountDetailSheet({
  open,
  onClose,
  title,
  titleId,
  children,
  footer,
  sheetClassName,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sheetClass = ["acct-sheet", sheetClassName].filter(Boolean).join(" ");

  return (
    <div
      className="acct-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={sheetClass}>
        <div className="acct-sheet__head">
          <h2 id={titleId} className="acct-sheet__title">
            {title}
          </h2>
          <button type="button" className="acct-sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="acct-sheet__body pchat-scrollbar">{children}</div>
        {footer ? <div className="acct-sheet__sticky-footer">{footer}</div> : null}
      </div>
    </div>
  );
}