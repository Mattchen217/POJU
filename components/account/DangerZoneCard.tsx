"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { postAuthJson } from "@/lib/auth/post-auth-json";
import { useAuthUser } from "@/lib/auth/use-auth-user";

type Props = {
  onDeleted?: () => void;
};

export function DangerZoneCard({ onDeleted }: Props) {
  const t = useTranslations("account");
  const router = useRouter();
  const { signOut } = useAuthUser();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await postAuthJson("/api/account/delete", { confirm: "DELETE" });
      if (!ok) {
        setError(data.error ?? "delete_failed");
        return;
      }
      try {
        await signOut();
      } catch {
        /* account already gone */
      }
      onDeleted?.();
      router.replace("/");
      router.refresh();
    } catch {
      setError("delete_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="acct-strip">
      <h3 className="acct-strip__title">{t("terminalActions")}</h3>
      <div className="acct-strip__body acct-strip__body--bare">
        <div className="acct-danger">
          <div className="acct-danger__copy">
            <h4 className="acct-danger__title">{t("accountErasure")}</h4>
            <p className="acct-danger__body">{t("deleteHint")}</p>
          </div>

          <div className="acct-danger__actions">
            {!confirmOpen ? (
              <button type="button" className="acct-btn acct-btn--danger" onClick={() => setConfirmOpen(true)}>
                {t("initiateErasure")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="acct-btn acct-btn--danger"
                  disabled={busy}
                  onClick={() => void deleteAccount()}
                >
                  {busy ? t("deleting") : t("deleteConfirmCta")}
                </button>
                <button
                  type="button"
                  className="acct-btn acct-btn--ghost"
                  disabled={busy}
                  onClick={() => {
                    setConfirmOpen(false);
                    setError(null);
                  }}
                >
                  {t("deleteCancel")}
                </button>
              </>
            )}
          </div>
        </div>

        {confirmOpen ? (
          <p className="acct-alert" role="alert">
            {t("deleteConfirm")}
          </p>
        ) : null}
        {error ? (
          <p className="acct-alert" role="alert">
            {t("deleteError")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
