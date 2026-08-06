"use client";

import { useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPathnameWithoutLocale } from "@/lib/i18n/pathname-without-locale";
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

/** `localePrefix: as-needed` — default locale has no prefix. */
function localizePath(pathname: string, locale: WorkspaceLocaleCode): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (locale === routing.defaultLocale) return path;
  return `/${locale}${path === "/" ? "" : path}`;
}

/**
 * Live `/app` query — prefer window so we don't fight stale useSearchParams
 * after WorkspaceShell's history.replaceState (session-only URL writes).
 * Stale React searchParams used to keep `tab=poju&session=` after the user
 * moved to Atmos/Match/… → language switch yanked them back to Pivot chat.
 */
function readLiveWorkspaceLocation(fallbackPathname: string): {
  path: string;
  tab: string | null;
  archive: string | null;
  session: string | null;
} {
  if (typeof window !== "undefined") {
    const path = getPathnameWithoutLocale(window.location.pathname);
    const q = new URLSearchParams(window.location.search);
    return {
      path: path || fallbackPathname || "/app",
      tab: q.get("tab"),
      archive: q.get("archive"),
      session: q.get("session"),
    };
  }
  return {
    path: fallbackPathname || "/app",
    tab: null,
    archive: null,
    session: null,
  };
}

type Props = {
  onAfterSelect?: () => void;
  /** Collapsed rail: show compact code only */
  compact?: boolean;
};

type MenuBox = { left: number; bottom: number; width: number };

function WorkspaceLanguageSwitcherInner({ onAfterSelect, compact = false }: Props) {
  const locale = useLocale();
  const pathname = usePathname();
  const tLang = useTranslations("language");
  const t = useTranslations("workspace.language");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const active = resolveWorkspaceLocale(locale);
  const current = WORKSPACE_LOCALE_OPTIONS.find((o) => o.code === active)!;
  const compactLabel = current.short;

  useEffect(() => {
    setMounted(true);
  }, []);

  const placeMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({
      left: r.left,
      bottom: window.innerHeight - r.top + 6,
      width: Math.max(r.width, compact ? 120 : 160),
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    placeMenu();
  }, [open, compact]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const node = e.target as Node;
      if (rootRef.current?.contains(node)) return;
      if (menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onReposition = () => placeMenu();
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, compact]);

  function buildTargetHref(code: WorkspaceLocaleCode): string {
    const live = readLiveWorkspaceLocation(pathname || "/app");
    const basePath =
      live.path === "/app" || live.path.startsWith("/app") ? "/app" : live.path;

    const q = new URLSearchParams();
    if (basePath === "/app" || basePath.startsWith("/app")) {
      // Stay on the product the URL actually shows — never resurrect a stale Pivot session.
      if (live.tab) q.set("tab", live.tab);
      if (live.tab === "poju") {
        if (live.session) q.set("session", live.session);
      } else if (live.archive) {
        q.set("archive", live.archive);
      }
    }
    const qs = q.toString();
    const localized = localizePath(basePath, code);
    return qs ? `${localized}?${qs}` : localized;
  }

  function select(code: WorkspaceLocaleCode) {
    setOpen(false);
    onAfterSelect?.();
    if (code === locale) return;
    // Hard navigation: soft replace with query+locale was unreliable, and
    // WorkspaceShell syncUrl could rewrite `/app` without preserving locale.
    window.location.assign(buildTargetHref(code));
  }

  const menu =
    mounted && open && menuBox
      ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            className="workspace-lang-row__menu workspace-lang-row__menu--portal"
            style={{
              position: "fixed",
              left: menuBox.left,
              bottom: menuBox.bottom,
              width: menuBox.width,
              right: "auto",
            }}
          >
            {WORKSPACE_LOCALE_OPTIONS.map((opt) => {
              const selected = active === opt.code;
              return (
                <li key={opt.code} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="workspace-lang-row__option"
                    onClick={(e) => {
                      e.stopPropagation();
                      select(opt.code);
                    }}
                  >
                    <span className="workspace-lang-row__code">{opt.short}</span>
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`workspace-lang-row${open ? " is-open" : ""}${compact ? " is-compact" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="workspace-lang-row__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={tLang("aria")}
        data-tooltip={compact ? compactLabel : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
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
      {menu}
    </div>
  );
}

/** Bottom-rail language row; menu portals above overflow clipping. Preserves current `/app?tab=`. */
export function WorkspaceLanguageSwitcher(props: Props) {
  return (
    <Suspense fallback={null}>
      <WorkspaceLanguageSwitcherInner {...props} />
    </Suspense>
  );
}
