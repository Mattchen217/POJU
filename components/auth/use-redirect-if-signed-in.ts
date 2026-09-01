"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  localizeHref,
  parseUiLocale,
  type UiLocaleCode,
} from "@/lib/i18n/ui-locale-preference";
import { routing } from "@/i18n/routing";

/**
 * If a Cookie session already exists (e.g. OAuth finished in another window,
 * or callback set cookies but the UI stayed on /login), leave auth pages.
 *
 * Uses hard navigation + localizeHref so `next=/app` from an older link still
 * lands on `/{locale}/app` when the auth page itself is localized — and so
 * `next=/zh/app` is not double-prefixed by next-intl's router.
 */
export function useRedirectIfSignedIn(nextPath: string): void {
  const locale = useLocale();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const uiLocale =
      parseUiLocale(locale) ?? (routing.defaultLocale as UiLocaleCode);

    const go = () => {
      if (cancelled) return;
      const target = localizeHref(nextPath, uiLocale);
      window.location.replace(target);
    };

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) go();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        go();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [nextPath, locale]);
}
