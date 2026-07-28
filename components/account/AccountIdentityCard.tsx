"use client";

import type { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";

import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { hasPasswordIdentity, loginProviders } from "@/lib/auth/user-identity";
import { useState } from "react";

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

function initials(email: string | null, user: User): string {
  const name =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    email ||
    "?";
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
    <div className="workspace-glass-card mb-4 flex flex-col gap-4">
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
        {t("identity")}
      </p>

      <div className="flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- OAuth CDN avatars
          <img
            src={avatar}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover ring-1 ring-[rgba(167,139,250,0.25)]"
          />
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(139,92,246,0.2)] text-sm font-semibold text-[var(--ws-text-body,#e0e2e8)]"
            aria-hidden
          >
            {initials(email, user)}
          </div>
        )}
        <div className="min-w-0 flex flex-col gap-1">
          <p className="m-0 truncate text-sm text-[var(--ws-text-body,#e0e2e8)]">
            {email ?? t("emailMissing")}
          </p>
          <p className="m-0 text-xs text-[var(--ws-text-secondary,#9a9cae)]">
            {t("signedInVia")}:{" "}
            {providers.length
              ? providers.map((p) => providerLabel(p, t)).join(" · ")
              : t("providerUnknown")}
          </p>
        </div>
      </div>

      <AuthErrorText code={error} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="workspace-link-btn border-0 cursor-pointer"
          disabled={signingOut}
          onClick={() => {
            setError(null);
            void onSignOut().catch(() => setError("auth_failed"));
          }}
        >
          {signingOut ? tProfile("loggingOut") : tProfile("logout")}
        </button>
      </div>

      {showPassword ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-[rgba(255,255,255,0.08)] pt-4">
          <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
            {tProfile("changePassword")}
          </p>
          {pwDone ? (
            <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">
              {tProfile("passwordUpdated")}
            </p>
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
                className="workspace-poju-rename-dialog__input"
                placeholder={tProfile("newPassword")}
                value={pw.password}
                onChange={(ev) => setPw((s) => ({ ...s, password: ev.target.value }))}
                disabled={pwBusy}
              />
              <input
                type="password"
                autoComplete="new-password"
                className="workspace-poju-rename-dialog__input"
                placeholder={tProfile("confirmPassword")}
                value={pw.confirm}
                onChange={(ev) => setPw((s) => ({ ...s, confirm: ev.target.value }))}
                disabled={pwBusy}
              />
              <button
                type="submit"
                className="workspace-link-btn self-start border-0 cursor-pointer"
                disabled={pwBusy}
              >
                {pwBusy ? tProfile("updatingPassword") : tProfile("updatePassword")}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
