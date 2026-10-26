"use client";

import { useEffect } from "react";

/**
 * If OAuth returns `?code=` on the marketing home (Site URL fallback),
 * send it to the server callback so cookies are set, then honor `next`
 * (defaults to `/` — the page the user came from when unspecified).
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

      const bindInvite = url.searchParams.get("bind_seat_invite")?.trim();
      if (bindInvite) {
        const bindTarget = new URL(
          "/api/household/bind-oauth/callback",
          window.location.origin,
        );
        bindTarget.searchParams.set("code", code);
        bindTarget.searchParams.set("invite", bindInvite);
        const oauthErr = url.searchParams.get("error");
        if (oauthErr) bindTarget.searchParams.set("error", oauthErr);
        window.location.replace(bindTarget.toString());
        return;
      }

      const target = new URL("/api/auth/callback", window.location.origin);
      url.searchParams.forEach((value, key) => {
        target.searchParams.set(key, value);
      });
      if (!target.searchParams.get("next")) {
        target.searchParams.set("next", "/");
      }
      window.location.replace(target.toString());
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
