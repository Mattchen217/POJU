"use client";

import { useEffect, useRef, useState } from "react";
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
  onAfterSelect?: () => void;
  /** Collapsed rail: gavel icon only; menu opens beside the rail. */
  compact?: boolean;
};

/**
 * Bottom-rail legal row — menu opens upward (same pattern as language switcher).
 */
export function WorkspaceLegalMenu({ onAfterSelect, compact = false }: Props) {
  const t = useTranslations("workspace");
  const tNav = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  function close() {
    setOpen(false);
    onAfterSelect?.();
  }

  return (
    <div
      ref={rootRef}
      className={`workspace-legal-row${open ? " is-open" : ""}${compact ? " is-compact" : ""}`}
    >
      <button
        type="button"
        className="workspace-legal-row__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("tabs.legal")}
        data-tooltip={compact ? t("tabs.legal") : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {compact ? (
          <span className="workspace-sidebar__icon" aria-hidden>
            <span className="material-symbols-outlined">gavel</span>
          </span>
        ) : (
          <>
            <span className="workspace-legal-row__label">{t("tabs.legal")}</span>
            <span className="workspace-legal-row__chevron" aria-hidden>
              {">"}
            </span>
          </>
        )}
      </button>

      {open ? (
        <ul role="menu" className="workspace-legal-row__menu" aria-label={t("legalTitle")}>
          {LEGAL_LINKS.map((item) => (
            <li key={item.href} role="none">
              <Link
                href={item.href}
                role="menuitem"
                className="workspace-legal-row__option"
                onClick={close}
              >
                {tNav(item.key)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
