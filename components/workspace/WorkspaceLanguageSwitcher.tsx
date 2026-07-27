"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";
import {
  MARKETING_LOCALE_COMPACT_LABEL,
  MARKETING_LOCALE_OPTIONS,
  type MarketingLocaleCode,
} from "@/lib/i18n/marketing-locale-options";

export const WORKSPACE_LOCALE_OPTIONS = MARKETING_LOCALE_OPTIONS.map((o) => ({
  code: o.code,
  label: o.label,
  short: MARKETING_LOCALE_COMPACT_LABEL[o.code],
}));

export type WorkspaceLocaleCode = MarketingLocaleCode;

function resolveWorkspaceLocale(locale: string): WorkspaceLocaleCode {
  const hit = WORKSPACE_LOCALE_OPTIONS.find((o) => o.code === locale);
  return hit?.code ?? "en";
}

type Props = {
  onAfterSelect?: () => void;
  /** Collapsed rail: show compact code only */
  compact?: boolean;
};

function WorkspaceLanguageSwitcherInner({ onAfterSelect, compact = false }: Props) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tLang = useTranslations("language");
  const t = useTranslations("workspace.language");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = resolveWorkspaceLocale(locale);
  const current = WORKSPACE_LOCALE_OPTIONS.find((o) => o.code === active)!;
  const compactLabel = current.short;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  function hrefForLocale(): string {
    if (pathname === "/app" || pathname.startsWith("/app")) {
      const tab = searchParams.get("tab");
      const archive = searchParams.get("archive");
      const q = new URLSearchParams();
      if (tab) q.set("tab", tab);
      if (archive) q.set("archive", archive);
      const qs = q.toString();
      return qs ? `/app?${qs}` : "/app";
    }
    return pathname;
  }

  function select(code: WorkspaceLocaleCode) {
    if (code !== locale) {
      router.replace(hrefForLocale(), { locale: code });
    }
    setOpen(false);
    onAfterSelect?.();
  }

  return (
    <div
      ref={rootRef}
      className={`workspace-lang-row${open ? " is-open" : ""}${compact ? " is-compact" : ""}`}
    >
      <button
        type="button"
        className="workspace-lang-row__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={tLang("aria")}
        data-tooltip={compact ? compactLabel : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {compact ? (
          <span className="workspace-lang-row__compact">{compactLabel}</span>
        ) : (
          <>
            <span className="workspace-lang-row__label">{t("siteLabel")}</span>
            <span className="workspace-lang-row__current">
              <span className="workspace-lang-row__value">{current.label}</span>
              <span className="workspace-lang-row__chevron" aria-hidden>
                {">"}
              </span>
            </span>
          </>
        )}
      </button>

      {open ? (
        <ul role="listbox" className="workspace-lang-row__menu">
          {WORKSPACE_LOCALE_OPTIONS.map((opt) => {
            const selected = active === opt.code;
            return (
              <li key={opt.code} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="workspace-lang-row__option"
                  onClick={() => select(opt.code)}
                >
                  <span className="workspace-lang-row__code">{opt.short}</span>
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

/** Bottom-rail language row; menu opens upward. Preserves `/app?tab=`. */
export function WorkspaceLanguageSwitcher(props: Props) {
  return (
    <Suspense fallback={null}>
      <WorkspaceLanguageSwitcherInner {...props} />
    </Suspense>
  );
}
