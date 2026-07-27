"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Provider } from "@supabase/supabase-js";

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
  { id: "twitter", supabase: "twitter", labelKey: "twitter" },
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

export function OAuthButtons({ nextPath = "/app", disabled = false }: Props) {
  const t = useTranslations("auth.oauth");
  const tErr = useTranslations("auth.errors");
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
    try {
      const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin;
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider.supabase,
        options: {
          redirectTo: `${site}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (oauthError) {
        console.error(`[oauth/${provider.id}]`, oauthError.name, oauthError.message);
        setError("oauth_failed");
      }
    } catch (err) {
      console.error(`[oauth/${provider.id}] unexpected`, err instanceof Error ? err.name : "unknown");
      setError("oauth_failed");
    } finally {
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
