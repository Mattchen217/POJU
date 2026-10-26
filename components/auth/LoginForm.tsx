"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useRedirectIfSignedIn } from "@/components/auth/use-redirect-if-signed-in";
import { Link } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { navigateAfterAuth, safeNextPath } from "@/lib/auth/auth-helpers";

export type LoginBindSeatOpts = {
  title: string;
  subtitle?: string;
  replace?: boolean;
  /**
   * Absolute invite URL for OAuth bind (copy-only). Empty string while loading.
   * Never causes OAuth into the current browser.
   */
  bindInviteAbsoluteUrl: string;
  inviteError?: string | null;
  resolveBindInvite: () => Promise<
    { ok: true; url: string; token: string } | { ok: false; error: string }
  >;
  onBound: () => void;
  onCancel: () => void;
  /** Switch to signup form (same overlay) — mirrors login page footer link. */
  onGoSignup: () => void;
};

type Props = {
  initialNext?: string | null;
  initialError?: string | null;
  /** Reuse this login card for household seat bind (title override + bind APIs). */
  bindSeat?: LoginBindSeatOpts | null;
};

export function LoginForm({
  initialNext = null,
  initialError = null,
  bindSeat = null,
}: Props) {
  const t = useTranslations("auth.login");
  const tAccount = useTranslations("account");
  const [error, setError] = useState<string | null>(initialError);
  const [lastEmail, setLastEmail] = useState("");
  const inFlight = useRef(false);
  const next = safeNextPath(initialNext, "/");
  useRedirectIfSignedIn(next, { enabled: !bindSeat });

  const bindHouseholdError =
    bindSeat &&
    error &&
    [
      "no_subscription",
      "already_full",
      "only_seat_a_can_bind",
      "only_seat_a_can_invite",
      "create_failed",
      "update_failed",
      "household_schema_missing",
      "admin_unconfigured",
      "cannot_bind_self",
      "already_in_household",
      "session_drift",
    ].includes(error)
      ? error
      : null;

  function bindErrorLabel(code: string): string {
    switch (code) {
      case "no_subscription":
        return tAccount("bindSeatNoSub");
      case "already_full":
        return tAccount("bindSeatFull");
      case "only_seat_a_can_bind":
      case "only_seat_a_can_invite":
        return tAccount("bindSeatNotOwner");
      case "cannot_bind_self":
        return tAccount("bindSeatSelf");
      case "already_in_household":
        return tAccount("bindSeatTaken");
      case "household_schema_missing":
        return tAccount("bindSeatSchemaMissing");
      case "admin_unconfigured":
        return tAccount("bindSeatAdminMissing");
      case "create_failed":
      case "update_failed":
        return tAccount("bindSeatHouseholdInitFailed");
      default:
        return tAccount("bindSeatFailed");
    }
  }

  return (
    <AuthCard
      title={bindSeat?.title ?? t("title")}
      subtitle={bindSeat?.subtitle ?? t("subtitle")}
      onClose={bindSeat?.onCancel}
      footer={
        <p>
          {t("noAccount")}{" "}
          {bindSeat ? (
            <button type="button" className="auth-inline-link" onClick={bindSeat.onGoSignup}>
              {t("goSignup")}
            </button>
          ) : (
            <Link href={`/signup?next=${encodeURIComponent(next)}`}>{t("goSignup")}</Link>
          )}
        </p>
      }
    >
      <OAuthButtons
        nextPath={next}
        bindInviteAbsoluteUrl={bindSeat ? bindSeat.bindInviteAbsoluteUrl : null}
        resolveBindInvite={bindSeat?.resolveBindInvite}
        inviteError={bindSeat?.inviteError}
        onBindOAuthSuccess={bindSeat?.onBound}
      />
      {bindHouseholdError ? (
        <p className="auth-error" role="alert">
          {bindErrorLabel(bindHouseholdError)}
        </p>
      ) : (
        <AuthErrorText code={error} email={lastEmail} nextPath={next} />
      )}
      <EmailPasswordForm
        mode="login"
        submitLabel={t("submit")}
        submittingLabel={t("submitting")}
        onSubmit={async ({ email, password }) => {
          if (inFlight.current) return;
          inFlight.current = true;
          setError(null);
          setLastEmail(email);
          try {
            if (bindSeat) {
              const { ok, data } = await postAuthJson("/api/household/bind-seat", {
                email,
                password,
                replace: bindSeat.replace === true,
              });
              if (!ok) {
                setError(data.error ?? "auth_failed");
                return;
              }
              bindSeat.onBound();
              return;
            }
            const { ok, data } = await postAuthJson("/api/auth/login", { email, password });
            if (!ok) {
              setError(data.error ?? "auth_failed");
              return;
            }
            navigateAfterAuth(next);
          } finally {
            inFlight.current = false;
          }
        }}
      />
      <div className="auth-links-row">
        <Link
          href="/forgot-password"
          className="auth-btn auth-btn--ghost"
          target={bindSeat ? "_blank" : undefined}
          rel={bindSeat ? "noreferrer" : undefined}
        >
          {t("forgot")}
        </Link>
        <Link
          href="/verify"
          className="auth-btn auth-btn--ghost"
          target={bindSeat ? "_blank" : undefined}
          rel={bindSeat ? "noreferrer" : undefined}
        >
          {t("otpEntry")}
        </Link>
      </div>
    </AuthCard>
  );
}
