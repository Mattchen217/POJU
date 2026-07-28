"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Provider } from "@supabase/supabase-js";

import { useRouter } from "@/i18n/navigation";
import {
  clearOAuthPopupPending,
  isOAuthPopupMessage,
  openCenteredOAuthPopup,
  prefersFullPageOAuth,
} from "@/lib/auth/oauth-popup";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

type Props = {
  nextPath?: string;
  disabled?: boolean;
};

type OAuthProviderId = "google" | "facebook" | "twitter" | "discord";

const PROVIDERS: Array<{
  id: OAuthProviderId;
  supabase: Provider;
  labelKey: "google" | "facebook" | "twitter" | "discord";
}> = [
  { id: "google", supabase: "google", labelKey: "google" },
  { id: "facebook", supabase: "facebook", labelKey: "facebook" },
  // Supabase: "x" = X / Twitter OAuth 2.0 (enabled). "twitter" = deprecated 1.0a.
  { id: "twitter", supabase: "x" as Provider, labelKey: "twitter" },
  { id: "discord", supabase: "discord", labelKey: "discord" },
];

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.956.928-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}

function XTwitterLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#FFFFFF"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.374 6.231H2.77l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"
      />
    </svg>
  );
}

function DiscordLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#5865F2"
        d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
      />
    </svg>
  );
}

function ProviderLogo({ id, className }: { id: OAuthProviderId; className?: string }) {
  switch (id) {
    case "google":
      return <GoogleLogo className={className} />;
    case "facebook":
      return <FacebookLogo className={className} />;
    case "twitter":
      return <XTwitterLogo className={className} />;
    case "discord":
      return <DiscordLogo className={className} />;
  }
}

function buildRedirectTo(site: string, nextPath: string, popup: boolean): string {
  const q = new URLSearchParams({ next: nextPath });
  // Popup must return to the client PKCE handler — not the server callback —
  // so the code_verifier in the browser storage can complete the exchange.
  if (popup) {
    return `${site}/oauth-popup?${q.toString()}`;
  }
  return `${site}/api/auth/callback?${q.toString()}`;
}

export function OAuthButtons({ nextPath = "/app", disabled = false }: Props) {
  const t = useTranslations("auth.oauth");
  const tErr = useTranslations("auth.errors");
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<OAuthProviderId | null>(null);

  async function signInWith(provider: (typeof PROVIDERS)[number]) {
    setError(null);
    if (!configured) {
      setError("supabase_not_configured");
      return;
    }
    setBusyId(provider.id);

    // Prefer the actual tab origin so redirectTo matches this host (Site URL
    // fallback otherwise drops us on /?code=… inside the popup).
    const site = window.location.origin;
    const usePopup = !prefersFullPageOAuth();

    try {
      const supabase = createSupabaseBrowserClient();

      if (!usePopup) {
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: provider.supabase,
          options: {
            redirectTo: buildRedirectTo(site, nextPath, false),
          },
        });
        if (oauthError) {
          console.error(`[oauth/${provider.id}]`, oauthError.name, oauthError.message);
          setError("oauth_failed");
          setBusyId(null);
        }
        // Full-page redirect keeps busy until navigation.
        return;
      }

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider.supabase,
        options: {
          redirectTo: buildRedirectTo(site, nextPath, true),
          skipBrowserRedirect: true,
        },
      });

      if (oauthError || !data.url) {
        console.error(
          `[oauth/${provider.id}]`,
          oauthError?.name ?? "missing_url",
          oauthError?.message ?? "",
        );
        setError("oauth_failed");
        setBusyId(null);
        return;
      }

      const popup = openCenteredOAuthPopup(data.url, `easternos_oauth_${provider.id}`);
      if (!popup) {
        // Popup blocked → fall back to full-page redirect.
        const { error: fallbackError } = await supabase.auth.signInWithOAuth({
          provider: provider.supabase,
          options: {
            redirectTo: buildRedirectTo(site, nextPath, false),
          },
        });
        if (fallbackError) {
          console.error(`[oauth/${provider.id}] fallback`, fallbackError.name, fallbackError.message);
          setError("oauth_failed");
          setBusyId(null);
        }
        return;
      }

      const origin = window.location.origin;
      let settled = false;

      const finish = (status: "ok" | "error" | "cancel", next?: string) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        window.clearInterval(watchPopup);
        clearOAuthPopupPending();
        setBusyId(null);
        // Only close after /oauth-popup posts back. Never close on "cancel":
        // with COOP, popup.closed is often true while Google is still open — closing
        // here would kill the consent window before the user can confirm.
        if (status === "ok" || status === "error") {
          try {
            popup.close();
          } catch {
            /* ignore */
          }
        }
        if (status === "ok") {
          router.push(next || nextPath);
          router.refresh();
          return;
        }
        if (status === "error") {
          setError("oauth_failed");
        }
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== origin) return;
        if (!isOAuthPopupMessage(event.data)) return;
        finish(event.data.status, event.data.next);
      };

      window.addEventListener("message", onMessage);

      // Do not trust popup.closed while on Google (COOP false positives).
      // Only clear the busy state if the window is gone for a sustained period
      // and we never got a postMessage (user dismissed the popup).
      let closedStreak = 0;
      const watchPopup = window.setInterval(() => {
        if (settled) return;
        let reportedlyClosed = false;
        try {
          reportedlyClosed = popup.closed;
        } catch {
          // Cross-origin: treat as still open, keep waiting for postMessage.
          closedStreak = 0;
          return;
        }
        if (!reportedlyClosed) {
          closedStreak = 0;
          return;
        }
        closedStreak += 1;
        // ~3s of sustained "closed" before we give up (not the first COOP blip).
        if (closedStreak < 6) return;
        finish("cancel");
      }, 500);
    } catch (err) {
      console.error(`[oauth/${provider.id}] unexpected`, err instanceof Error ? err.name : "unknown");
      setError("oauth_failed");
      setBusyId(null);
    }
  }

  return (
    <div className="auth-oauth">
      {PROVIDERS.map((provider) => {
        const busy = busyId === provider.id;
        return (
          <button
            key={provider.id}
            type="button"
            className="auth-btn auth-btn--secondary auth-btn--oauth"
            disabled={disabled || busyId !== null || !configured}
            title={!configured ? t("supabaseMissing") : undefined}
            onClick={() => void signInWith(provider)}
          >
            <ProviderLogo id={provider.id} className="auth-oauth__logo" />
            <span>{busy ? t("starting") : t(provider.labelKey)}</span>
          </button>
        );
      })}
      {!configured ? <p className="auth-error" role="status">{t("supabaseMissing")}</p> : null}
      {error === "oauth_failed" ? (
        <p className="auth-error" role="alert">
          {tErr("oauth_failed")}
        </p>
      ) : null}
      <div className="auth-oauth__divider" role="separator">
        <span>{t("divider")}</span>
      </div>
    </div>
  );
}
