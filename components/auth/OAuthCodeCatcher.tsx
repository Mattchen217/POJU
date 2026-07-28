"use client";

import { useEffect } from "react";

/**
 * If OAuth returns `?code=` on the marketing home (Site URL fallback),
 * send it to the server callback so cookies are set and the user reaches /app.
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
      window.location.replace(target.toString());
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
