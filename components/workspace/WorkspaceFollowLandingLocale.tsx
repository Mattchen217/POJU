"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import {
  localizeHref,
  parseUiLocale,
  readStoredUiLocale,
  writeStoredUiLocale,
  type UiLocaleCode,
} from "@/lib/i18n/ui-locale-preference";

/**
 * Keep workspace URL locale aligned with the landing-page language preference.
 * - If address bar is bare `/app` (default locale) but storage says zh/es/fr,
 *   hard-navigate to `/{locale}/app?…` (covers auth `next=/app` drops).
 * - Once the URL locale is settled, mirror it into localStorage.
 */
export function WorkspaceFollowLandingLocale() {
  const locale = useLocale();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || redirectedRef.current) return;

    const active = parseUiLocale(locale) ?? (routing.defaultLocale as UiLocaleCode);
    const path = window.location.pathname;
    const onBareApp = path === "/app" || path.startsWith("/app/");

    if (onBareApp && active === routing.defaultLocale) {
      const preferred = readStoredUiLocale();
      if (preferred && preferred !== routing.defaultLocale) {
        redirectedRef.current = true;
        const here = `${path}${window.location.search}${window.location.hash}`;
        const target = localizeHref(here, preferred);
        if (target !== here) {
          window.location.replace(target);
          return;
        }
      }
    }

    writeStoredUiLocale(active);
  }, [locale]);

  return null;
}
