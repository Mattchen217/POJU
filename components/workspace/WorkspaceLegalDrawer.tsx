"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

const LEGAL_LINKS = [
  { href: "/disclaimer", key: "disclaimer" as const },
  { href: "/privacy", key: "privacy" as const },
  { href: "/terms", key: "terms" as const },
  { href: "/refund", key: "refund" as const },
  { href: "/cookies", key: "cookies" as const },
  { href: "/contact", key: "contact" as const },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function WorkspaceLegalDrawer({ open, onClose }: Props) {
  const t = useTranslations("workspace");
  const tNav = useTranslations("nav");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="workspace-legal-drawer" role="presentation">
      <button
        type="button"
        className="workspace-legal-drawer__backdrop"
        aria-label={t("legalClose")}
        onClick={onClose}
      />
      <div
        className="workspace-legal-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-legal-title"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="workspace-legal-title" className="text-base font-semibold tracking-wide">
            {t("legalTitle")}
          </h2>
          <button
            type="button"
            className="workspace-topbar__menu-btn"
            aria-label={t("legalClose")}
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              close
            </span>
          </button>
        </div>
        <nav className="workspace-legal-drawer__list" aria-label={t("legalTitle")}>
          {LEGAL_LINKS.map((item) => (
            <Link key={item.href} href={item.href} onClick={onClose}>
              {tNav(item.key)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
