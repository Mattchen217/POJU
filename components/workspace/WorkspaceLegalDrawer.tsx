"use client";

import { useEffect } from "react";

import { Link } from "@/i18n/navigation";

const LEGAL_LINKS = [
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/contact", label: "Contact" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function WorkspaceLegalDrawer({ open, onClose }: Props) {
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
        aria-label="Close legal"
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
            Legal & Policies
          </h2>
          <button
            type="button"
            className="workspace-topbar__menu-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              close
            </span>
          </button>
        </div>
        <nav className="workspace-legal-drawer__list" aria-label="Legal links">
          {LEGAL_LINKS.map((item) => (
            <Link key={item.href} href={item.href} onClick={onClose}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
