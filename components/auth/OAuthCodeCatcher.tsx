"use client";

import { useEffect } from "react";

import {
  clearOAuthPopupPending,
  OAUTH_POPUP_MESSAGE_TYPE,
} from "@/lib/auth/oauth-popup";

/**
 * Supabase sometimes returns the OAuth `code` to Site URL (`/`) instead of
 * `/oauth-popup`. Forward before the marketing shell paints in the popup.
 * Also close the popup if it ever lands on `/login?error=oauth_failed`.
 */
export function OAuthCodeCatcher() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const path = url.pathname.replace(/\/$/, "") || "/";
      const pathNoLocale = path.replace(/^\/(zh|es|de|fr)(?=\/|$)/, "") || "/";
      const hasOpener = Boolean(window.opener && !window.opener.closed);

      if (hasOpener && pathNoLocale === "/login" && url.searchParams.get("error")) {
        clearOAuthPopupPending();
        try {
          window.opener!.postMessage(
            {
              type: OAUTH_POPUP_MESSAGE_TYPE,
              status: "error",
              next: "/app",
            },
            window.location.origin,
          );
        } catch {
          /* ignore */
        }
        try {
          window.close();
        } catch {
          /* ignore */
        }
        return;
      }

      const code = url.searchParams.get("code");
      if (!code) return;

      const isHome =
        path === "/" ||
        path === "/zh" ||
        path === "/es" ||
        path === "/de" ||
        path === "/fr";
      if (!isHome) return;

      const target = new URL("/oauth-popup", window.location.origin);
      url.searchParams.forEach((value, key) => {
        target.searchParams.set(key, value);
      });
      if (!target.searchParams.get("next")) {
        target.searchParams.set("next", "/app");
      }
      window.location.replace(target.toString());
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
