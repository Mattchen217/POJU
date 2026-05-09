"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname, useRouter } from "@/i18n/navigation";

import {
  MARKETING_LOCALE_COMPACT_LABEL,
  MARKETING_LOCALE_OPTIONS,
  type MarketingLocaleCode,
} from "@/lib/i18n/marketing-locale-options";

export function MarketingLanguageSwitcher({
  onAfterSelect,
  compact = false,
}: {
  onAfterSelect?: () => void;
  compact?: boolean;
}) {
  const locale = useLocale() as MarketingLocaleCode;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("language");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  const currentLabel = compact
    ? MARKETING_LOCALE_COMPACT_LABEL[locale] ?? "EN"
    : MARKETING_LOCALE_OPTIONS.find((o) => o.code === locale)?.label ?? "English";

  const select = (code: MarketingLocaleCode) => {
    if (code !== locale) {
      router.replace(pathname, { locale: code });
    }
    setOpen(false);
    onAfterSelect?.();
  };

  // Mobile: use native details/summary to avoid JS click-chain issues on some phone browsers.
  if (compact) {
    return (
      <details className="relative">
        <summary className="flex h-12 cursor-pointer list-none touch-manipulation items-center gap-1 px-1 py-0 text-[13px] font-medium uppercase leading-none tracking-wide text-text-primary marker:content-[''] [-webkit-tap-highlight-color:transparent] [&::-webkit-details-marker]:hidden">
          <span className="text-[13px] text-text-secondary" aria-hidden>
            ▶
          </span>
          <span>{MARKETING_LOCALE_COMPACT_LABEL[locale] ?? "EN"}</span>
        </summary>
        <ul className="absolute right-0 top-[calc(100%+0.35rem)] z-[2000] min-w-[9rem] overflow-hidden rounded-xl bg-[#14121f]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
          {MARKETING_LOCALE_OPTIONS.map((opt) => {
            const selected = opt.code === locale;
            return (
              <li key={opt.code}>
                <Link
                  href={pathname}
                  locale={opt.code}
                  prefetch={false}
                  className={`flex w-full items-center px-3 py-2 text-left text-[13px] ${
                    selected
                      ? "bg-white/12 text-text-primary"
                      : "text-text-secondary hover:bg-white/8 hover:text-text-primary"
                  }`}
                  aria-current={selected ? "page" : undefined}
                >
                  <span className="mr-2 w-8 font-mono text-xs text-text-dim">
                    {MARKETING_LOCALE_COMPACT_LABEL[opt.code]}
                  </span>
                  {opt.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    );
  }

  return (
    <div ref={rootRef} className="relative z-[60] flex items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("aria")}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={`flex min-h-[44px] touch-manipulation items-center px-1 py-1.5 text-left [-webkit-tap-highlight-color:transparent] ${
          compact ? "gap-1.5" : "gap-2 sm:gap-2 sm:px-3"
        }`}
      >
        <span className={`min-w-0 truncate font-medium text-text-primary ${compact ? "text-[12px] uppercase tracking-wide" : "text-[13px] sm:text-[14px]"}`}>
          {currentLabel}
        </span>
        <ChevronDown
          className={`pointer-events-none shrink-0 text-text-secondary transition-transform duration-200 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className={`absolute right-0 top-[calc(100%+0.35rem)] z-[2000] overflow-hidden rounded-xl bg-[#14121f]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md ${
            compact ? "min-w-[9rem]" : "min-w-[10.5rem]"
          }`}
        >
          {MARKETING_LOCALE_OPTIONS.map((opt) => {
            const selected = opt.code === locale;
            return (
              <li key={opt.code} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => select(opt.code)}
                  className={`flex w-full touch-manipulation items-center px-3 py-2 text-left text-[13px] sm:text-[14px] ${
                    selected
                      ? "bg-white/12 text-text-primary"
                      : "text-text-secondary hover:bg-white/8 hover:text-text-primary"
                  }`}
                >
                  <span className="mr-2 w-8 font-mono text-xs text-text-dim">
                    {MARKETING_LOCALE_COMPACT_LABEL[opt.code]}
                  </span>
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
