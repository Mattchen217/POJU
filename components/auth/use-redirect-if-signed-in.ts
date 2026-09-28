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

const BOUNCE_KEY = "poju.auth.redirect_bounce";
const BOUNCE_WINDOW_MS = 8_000;

function recentlyBounced(): boolean {
  try {
    const raw = sessionStorage.getItem(BOUNCE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < BOUNCE_WINDOW_MS;
  } catch {
    return false;
  }
}

function markBounce(): void {
  try {
    sessionStorage.setItem(BOUNCE_KEY, String(Date.now()));
  } catch {
    // private mode
  }
}

/**
 * If a Cookie session already exists (e.g. OAuth finished in another window,
 * or callback set cookies but the UI stayed on /login), leave auth pages.
 *
 * Uses hard navigation + localizeHref so `next=/app` from an older link still
 * lands on `/{locale}/app` when the auth page itself is localized — and so
 * `next=/zh/app` is not double-prefixed by next-intl's router.
 *
 * Bounce guard: if middleware kicks us back to /login within a few seconds
 * (client session vs cookie mismatch), do not hard-nav again — stops the
 * login↔/app↔login jump loop.
 */
export function useRedirectIfSignedIn(nextPath: string): void {
  const locale = useLocale();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (recentlyBounced()) return;

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const uiLocale =
      parseUiLocale(locale) ?? (routing.defaultLocale as UiLocaleCode);

    const go = () => {
      if (cancelled) return;
      if (recentlyBounced()) return;
      markBounce();
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
