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
    <div className="workspace-glass-card flex flex-col gap-3 border border-[rgba(239,68,68,0.25)]">
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[#fca5a5]">{t("dangerZone")}</p>
      <p className="m-0 text-sm text-[var(--ws-text-secondary,#a1a1aa)]">{t("deleteHint")}</p>

      {!confirmOpen ? (
        <button
          type="button"
          className="workspace-link-btn self-start border-0 cursor-pointer text-[#fca5a5]"
          onClick={() => setConfirmOpen(true)}
        >
          {t("deleteAccount")}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-[#fca5a5]" role="alert">
            {t("deleteConfirm")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="workspace-link-btn border-0 cursor-pointer text-[#fca5a5]"
              disabled={busy}
              onClick={() => void deleteAccount()}
            >
              {busy ? t("deleting") : t("deleteConfirmCta")}
            </button>
            <button
              type="button"
              className="workspace-link-btn border-0 cursor-pointer"
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false);
                setError(null);
              }}
            >
              {t("deleteCancel")}
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="m-0 text-xs text-[#fca5a5]" role="alert">
          {t("deleteError")}
        </p>
      ) : null}
    </div>
  );
}
