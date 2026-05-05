"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";

import { routing } from "@/i18n/routing";

type LocaleCode = (typeof routing.locales)[number];

/** 下拉项顺序与文案：各语言自称（默认站点语言为英语，见 `i18n/routing.ts`） */
const LOCALE_OPTIONS: { code: LocaleCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
];

export function MarketingLanguageSwitcher({
  onAfterSelect,
}: {
  /** 选择语言后回调（例如关闭移动端抽屉） */
  onAfterSelect?: () => void;
}) {
  const locale = useLocale() as LocaleCode;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("language");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const currentLabel =
    LOCALE_OPTIONS.find((o) => o.code === locale)?.label ?? "English";

  const select = (code: LocaleCode) => {
    if (code !== locale) router.replace(pathname, { locale: code });
    setOpen(false);
    onAfterSelect?.();
  };

  return (
    <div ref={rootRef} className="relative z-[80] flex items-center">
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t("aria")}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="flex items-center gap-2 rounded-full bg-white/[0.07] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.1] sm:gap-2 sm:px-3 sm:py-1.5"
        >
          <span className="min-w-0 truncate text-[13px] font-medium text-text-primary sm:text-[14px]">
            {currentLabel}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-text-secondary transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {open ? (
          <ul
            role="listbox"
            className="absolute right-0 top-[calc(100%+0.35rem)] z-[90] min-w-[10.5rem] overflow-hidden rounded-xl bg-[#14121f]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
          >
            {LOCALE_OPTIONS.map((opt) => {
              const selected = opt.code === locale;
              return (
                <li key={opt.code} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => select(opt.code)}
                    className={`flex w-full items-center px-3 py-2 text-left text-[13px] sm:text-[14px] ${
                      selected
                        ? "bg-white/12 text-text-primary"
                        : "text-text-secondary hover:bg-white/8 hover:text-text-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
