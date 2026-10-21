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

type RedirectIfSignedInOptions = {
  /**
   * When false, stay on the auth page (e.g. signup OTP modal is open).
   * Default true.
   */
  enabled?: boolean;
};

function isEmailConfirmed(user: {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}): boolean {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

/**
 * If a Cookie session already exists (e.g. OAuth finished in another window,
 * or callback set cookies but the UI stayed on /login), leave auth pages.
 *
 * Uses hard navigation + localizeHref so `next=/app` still lands on
 * `/{locale}/app`, and `next=/zh/app` is not double-prefixed.
 *
 * Bounce guard: if middleware kicks us back to /login within a few seconds
 * (client session vs cookie mismatch), do not hard-nav again — stops the
 * login↔/app↔login jump loop.
 *
 * Already-signed-in users are handled by middleware before paint.
 * Client only leaves on a real SIGNED_IN (OAuth / password / OTP just completed).
 * Unconfirmed email sessions must stay on signup so the OTP modal can finish.
 *
 * Login from marketing may set next=/ or /zh (landing). Start CTA sets next=/app.
 */
export function useRedirectIfSignedIn(
  nextPath: string,
  options?: RedirectIfSignedInOptions,
): void {
  const locale = useLocale();
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
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
      // Honor next as-is (landing `/`/`/zh` or workspace `/app`/`/zh/app`).
      window.location.replace(localizeHref(nextPath, uiLocale));
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) return;
      if (!isEmailConfirmed(session.user)) return;
      // Do not redirect on INITIAL_SESSION / TOKEN_REFRESHED — that bounced
      // users back to the landing page on the first click into /login.
      if (event === "SIGNED_IN") {
        go();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [nextPath, locale, enabled]);
}
