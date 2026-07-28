"use client";

import { useEffect } from "react";

import { OAUTH_POPUP_COOKIE } from "@/lib/auth/oauth-popup";

/**
 * Supabase sometimes returns the OAuth `code` to Site URL (`/`) instead of
 * `/api/auth/callback`. In a popup that paints the whole marketing site.
 * Forward those codes to the real callback (and force popup=1 when opener exists).
 */
export function OAuthCodeCatcher() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (!code) return;

      const path = url.pathname.replace(/\/$/, "") || "/";
      const isHome =
        path === "/" ||
        path === "/zh" ||
        path === "/es" ||
        path === "/de" ||
        path === "/fr";
      if (!isHome) return;

      const target = new URL("/api/auth/callback", window.location.origin);
      url.searchParams.forEach((value, key) => {
        target.searchParams.set(key, value);
      });
      if (!target.searchParams.get("next")) {
        target.searchParams.set("next", "/app");
      }

      const hasOpener = Boolean(window.opener && !window.opener.closed);
      const cookiePending = document.cookie
        .split(";")
        .some((part) => part.trim().startsWith(`${OAUTH_POPUP_COOKIE}=1`));
      if (hasOpener || cookiePending) {
        target.searchParams.set("popup", "1");
      }

      window.location.replace(target.toString());
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
