"use client";

import { useEffect, useRef, useState } from "react";

import { MARKETING_LOCALES, type MarketingLocale, useMarketingLocale } from "@/components/marketing/marketing-locale";

function shortLabel(code: MarketingLocale): string {
  if (code === "zh") return "中文";
  return code.toUpperCase();
}

export function MarketingLanguageSwitcher() {
  const { locale, setLocale } = useMarketingLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full bg-black/42 px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:bg-black/55 sm:text-[13px] md:py-2 md:text-[14px]"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-text-secondary">Lang</span>
        <span className="text-text-primary">{shortLabel(locale)}</span>
        <span className="text-text-dim" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 z-[60] mt-1 min-w-[10.5rem] rounded-lg bg-[#0b1022]/96 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
          aria-label="Language"
        >
          {MARKETING_LOCALES.map((item) => (
            <li key={item.code} role="option" aria-selected={item.code === locale}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12px] sm:text-[13px] ${
                  item.code === locale
                    ? "bg-white/10 text-text-primary"
                    : "text-text-secondary hover:bg-white/6 hover:text-text-primary"
                }`}
                onClick={() => {
                  setLocale(item.code);
                  setOpen(false);
                }}
              >
                <span>{item.label}</span>
                {item.code === locale ? <span className="text-purple-vivid">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
