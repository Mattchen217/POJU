"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { AuthErrorText } from "@/components/auth/AuthErrorText";
import { WorkspaceAccountPlaceholder } from "@/components/workspace/WorkspaceAccountPlaceholder";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";
import { Link, useRouter } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { useAuthUser } from "@/lib/auth/use-auth-user";

export function ProfilePanel() {
  const t = useTranslations("workspace.profile");
  const tWs = useTranslations("workspace");
  const router = useRouter();
  const { user, email, ready, signOut } = useAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const inFlight = useRef(false);

  return (
    <div className="workspace-panel">
      <h2 className="workspace-panel__headline">{t("headline")}</h2>
      <p className="workspace-panel__guidance">{t("guidance")}</p>

      <div className="workspace-glass-card mb-4 flex flex-col gap-4">
        <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
          {t("accountSection")}
        </p>

        {!ready ? (
          <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">…</p>
        ) : user ? (
          <>
            <WorkspaceAccountPlaceholder email={email} />
            <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">
              {t("signedInAs", { email: email ?? "" })}
            </p>
            <AuthErrorText code={error} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="workspace-link-btn border-0 cursor-pointer"
                disabled={loggingOut}
                onClick={() => {
                  if (inFlight.current) return;
                  inFlight.current = true;
                  setLoggingOut(true);
                  setError(null);
                  void signOut()
                    .then(() => {
                      router.refresh();
                    })
                    .catch(() => {
                      setError("auth_failed");
                    })
                    .finally(() => {
                      inFlight.current = false;
                      setLoggingOut(false);
                    });
                }}
              >
                {loggingOut ? t("loggingOut") : t("logout")}
              </button>
            </div>

            <div className="mt-2 flex flex-col gap-2 border-t border-[rgba(167,139,250,0.12)] pt-4">
              <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
                {t("changePassword")}
              </p>
              {pwDone ? (
                <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">{t("passwordUpdated")}</p>
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
                    placeholder={t("newPassword")}
                    value={pw.password}
                    onChange={(ev) => setPw((s) => ({ ...s, password: ev.target.value }))}
                    disabled={pwBusy}
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="workspace-poju-rename-dialog__input"
                    placeholder={t("confirmPassword")}
                    value={pw.confirm}
                    onChange={(ev) => setPw((s) => ({ ...s, confirm: ev.target.value }))}
                    disabled={pwBusy}
                  />
                  <button type="submit" className="workspace-link-btn self-start border-0 cursor-pointer" disabled={pwBusy}>
                    {pwBusy ? t("updatingPassword") : t("updatePassword")}
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <>
            <WorkspaceAccountPlaceholder email={tWs("guest")} />
            <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">{t("accountBody")}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/login" className="workspace-link-btn">
                {t("loginCta")}
              </Link>
              <Link href="/signup" className="workspace-link-btn">
                {t("signupCta")}
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="workspace-glass-card flex flex-col gap-4">
        <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
          {t("slotsSection")}
        </p>
        <WorkspaceProfileSlotBar showAddAffordance />
        <Link href="/profile/setup" className="workspace-link-btn self-start">
          {t("setupCta")}
        </Link>
      </div>
    </div>
  );
}
