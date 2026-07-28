"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { safeNextPath } from "@/lib/auth/auth-helpers";
import {
  clearOAuthPopupPending,
  OAUTH_POPUP_MESSAGE_TYPE,
} from "@/lib/auth/oauth-popup";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { userNeedsEmail } from "@/lib/auth/user-identity";

/**
 * OAuth return page for popup (and Site-URL `/?code=` fallbacks).
 * Exchanges the PKCE code in the browser (same storage as the opener), then
 * postMessage + close — never paints the full login UI inside the popup.
 */
function OAuthPopupFinish() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;

    const finish = (status: "ok" | "error", nextPath: string) => {
      if (cancelled) return;
      clearOAuthPopupPending();
      const hasOpener = Boolean(window.opener && !window.opener.closed);
      if (hasOpener) {
        try {
          window.opener!.postMessage(
            {
              type: OAUTH_POPUP_MESSAGE_TYPE,
              status,
              next: nextPath,
            },
            window.location.origin,
          );
        } catch {
          /* ignore */
        }
        setMessage(
          status === "ok"
            ? "Signed in. You can close this window."
            : "Sign-in failed. You can close this window.",
        );
        try {
          window.close();
        } catch {
          /* ignore */
        }
        window.setTimeout(() => {
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }, 120);
        window.setTimeout(() => {
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }, 400);
        return;
      }

      // Full-tab fallback (no opener): navigate the current window.
      if (status === "ok") {
        window.location.replace(nextPath);
        return;
      }
      window.location.replace("/login?error=oauth_failed");
    };

    void (async () => {
      const code = searchParams.get("code");
      const next = safeNextPath(searchParams.get("next"), "/app");
      const oauthError = searchParams.get("error");

      if (oauthError || !code) {
        finish("error", next);
        return;
      }
      if (!isSupabaseConfigured()) {
        finish("error", next);
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[oauth-popup]", error.name, error.message);
          finish("error", next);
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (userNeedsEmail(user)) {
          const gate = `/complete-email?next=${encodeURIComponent(next)}&popup=1`;
          finish("ok", gate);
          return;
        }
        finish("ok", next);
      } catch (err) {
        console.error(
          "[oauth-popup] unexpected",
          err instanceof Error ? err.name : "unknown",
        );
        finish("error", next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main
      style={{
        margin: 0,
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0815",
        color: "#a1a1aa",
        font: "14px/1.5 system-ui, sans-serif",
      }}
    >
      <p>{message}</p>
    </main>
  );
}

export default function OAuthPopupPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            margin: 0,
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#0b0815",
            color: "#a1a1aa",
            font: "14px/1.5 system-ui, sans-serif",
          }}
        >
          <p>Finishing sign-in…</p>
        </main>
      }
    >
      <OAuthPopupFinish />
    </Suspense>
  );
}
