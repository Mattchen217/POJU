"use client";

import type { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { hasPasswordIdentity, loginProviders } from "@/lib/auth/user-identity";

type Props = {
  user: User;
  email: string | null;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
};

function providerLabel(provider: string, t: (key: string) => string): string {
  switch (provider) {
    case "email":
      return t("providerEmail");
    case "google":
      return t("providerGoogle");
    case "facebook":
      return t("providerFacebook");
    case "twitter":
    case "x":
      return t("providerX");
    case "discord":
      return t("providerDiscord");
    default:
      return provider;
  }
}

function avatarUrl(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const url =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
  return url;
}

function displayName(email: string | null, user: User): string {
  const meta = user.user_metadata ?? {};
  if (typeof meta.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta.name === "string" && meta.name.trim()) return meta.name.trim();
  if (email) return email.split("@")[0] || email;
  return "—";
}

function initials(email: string | null, user: User): string {
  const name = displayName(email, user);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AccountIdentityCard({ user, email, onSignOut, signingOut }: Props) {
  const t = useTranslations("account");
  const tProfile = useTranslations("workspace.profile");
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const showPassword = hasPasswordIdentity(user);
  const providers = loginProviders(user);
  const avatar = avatarUrl(user);

  return (
    <article className="acct-card acct-mgt__span-4 group">
      <div className="acct-card__glow" aria-hidden />
      <p className="acct-card__label">{t("identityNode")}</p>

      <div className="acct-identity">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- OAuth CDN avatars
          <img src={avatar} alt="" className="acct-identity__avatar" width={64} height={64} />
        ) : (
          <div className="acct-identity__fallback" aria-hidden>
            {initials(email, user)}
          </div>
        )}
        <div className="acct-identity__meta">
          <p className="acct-identity__name">{displayName(email, user)}</p>
          <p className="acct-identity__email">{email ?? t("emailMissing")}</p>
          <p className="acct-identity__via">
            {t("signedInVia")}:{" "}
            {providers.length
              ? providers.map((p) => providerLabel(p, t)).join(" · ")
              : t("providerUnknown")}
          </p>
        </div>
      </div>

      <AuthErrorText code={error} />

      <div className="acct-card__actions">
        <button
          type="button"
          className="acct-btn acct-btn--ghost"
          disabled={signingOut}
          onClick={() => {
            setError(null);
            void onSignOut().catch(() => setError("auth_failed"));
          }}
        >
          {signingOut ? tProfile("loggingOut") : t("terminateSession")}
        </button>
      </div>

      {showPassword ? (
        <div className="acct-pw">
          <p className="acct-pw__label">{tProfile("changePassword")}</p>
          {pwDone ? (
            <p className="acct-empty">{tProfile("passwordUpdated")}</p>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pwBusy) return;
                if (pw.password.length < 8 || pw.password !== pw.confirm) {
                  setError(pw.password !== pw.confirm ? "password_mismatch" : "weak_password");
                  return;
                }
                setPwBusy(true);
                setError(null);
                void postAuthJson("/api/auth/update-password", {
                  password: pw.password,
                  confirm: pw.confirm,
                })
                  .then(({ ok, data }) => {
                    if (!ok) {
                      setError(data.error ?? "auth_failed");
                      return;
                    }
                    setPwDone(true);
                    setPw({ password: "", confirm: "" });
                  })
                  .finally(() => setPwBusy(false));
              }}
            >
              <input
                type="password"
                autoComplete="new-password"
                placeholder={tProfile("newPassword")}
                value={pw.password}
                onChange={(ev) => setPw((s) => ({ ...s, password: ev.target.value }))}
                disabled={pwBusy}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder={tProfile("confirmPassword")}
                value={pw.confirm}
                onChange={(ev) => setPw((s) => ({ ...s, confirm: ev.target.value }))}
                disabled={pwBusy}
              />
              <button type="submit" className="acct-btn acct-btn--quiet self-start" disabled={pwBusy}>
                {pwBusy ? tProfile("updatingPassword") : tProfile("updatePassword")}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </article>
  );
}
