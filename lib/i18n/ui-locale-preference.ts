/**
 * Shared UI locale preference (landing ↔ workspace).
 * URL remains the source of truth for next-intl; this storage bridges
 * hard navigations that drop the locale prefix (e.g. `/app` after auth `next=`).
 */

import { routing } from "@/i18n/routing";
import { getPathnameWithoutLocale } from "@/lib/i18n/pathname-without-locale";

export const UI_LOCALE_STORAGE_KEY = "poju-marketing-locale";

export type UiLocaleCode = (typeof routing.locales)[number];

export function parseUiLocale(raw: string | null | undefined): UiLocaleCode | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase().split("-")[0] ?? "";
  if ((routing.locales as readonly string[]).includes(code)) {
    return code as UiLocaleCode;
  }
  return null;
}

export function readStoredUiLocale(): UiLocaleCode | null {
  if (typeof window === "undefined") return null;
  try {
    return parseUiLocale(window.localStorage.getItem(UI_LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredUiLocale(locale: UiLocaleCode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode */
  }
}

/** Strip any locale prefix, then re-apply `locale` (`as-needed`: default has no prefix). */
export function localizePathname(pathname: string, locale: UiLocaleCode): string {
  const bare = getPathnameWithoutLocale(pathname) || "/";
  if (locale === routing.defaultLocale) return bare;
  if (bare === "/") return `/${locale}`;
  return `/${locale}${bare}`;
}

/** Localize a same-origin relative href (path + query + hash). */
export function localizeHref(href: string, locale: UiLocaleCode): string {
  const raw = String(href || "").trim();
  if (!raw || raw.startsWith("http") || raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw, "http://local.invalid");
    const path = localizePathname(url.pathname || "/", locale);
    return `${path}${url.search}${url.hash}`;
  } catch {
    return raw;
  }
}
