"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

import { PojuSessionChatShell } from "@/components/poju/PojuSessionChatShell";
import { AppDialogProvider } from "@/components/ui/app-dialog";
import { deleteArchiveItem } from "@/lib/archive/archive-service";
import type { POJUSessionVaultData } from "@/lib/archive/poju-session-vault";
import { getPOJUSessionRecord, loadPOJUSession } from "@/lib/poju/session-manager";
import { redirectToPojuSessionPayment } from "@/lib/poju/start-poju-session-payment";
import type { POJUSessionState } from "@/lib/poju/types";
import type { POJUSessionRecord } from "@/lib/db/poju-db";

type Props = {
  archiveId: string;
  data: POJUSessionVaultData;
};

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function PojuSessionArchiveDetail({ archiveId, data }: Props) {
  const t = useTranslations("archiveDetail");
  const locale = useLocale();
  const router = useRouter();
  const [sessionRow, setSessionRow] = useState<POJUSessionRecord | undefined>();
  const [chatUnlocked, setChatUnlocked] = useState(false);
  const [liveSession, setLiveSession] = useState<POJUSessionState | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const effectiveExpiresAt = useMemo(() => {
    if (sessionRow?.expires_at) {
      return sessionRow.expires_at instanceof Date
        ? sessionRow.expires_at.toISOString()
        : String(sessionRow.expires_at);
    }
    return data.expires_at;
  }, [data.expires_at, sessionRow?.expires_at]);

  const expired = useMemo(() => isExpired(effectiveExpiresAt), [effectiveExpiresAt]);
  const needsPayment = expired || sessionRow?.status === "archived";
  const canContinue = !needsPayment && sessionRow?.status === "active";

  const reloadSessionMeta = useCallback(async () => {
    const row = await getPOJUSessionRecord(data.session_id);
    setSessionRow(row);
    if (chatUnlocked && row?.status === "active" && !isExpired(effectiveExpiresAt)) {
      const loaded = await loadPOJUSession(data.session_id);
      setLiveSession(loaded);
    }
  }, [chatUnlocked, data.session_id, effectiveExpiresAt]);

  useEffect(() => {
    void reloadSessionMeta();
  }, [reloadSessionMeta, reloadKey]);

  async function handleContinue() {
    if (!canContinue) return;
    const loaded = await loadPOJUSession(data.session_id);
    if (!loaded) return;
    setLiveSession(loaded);
    setChatUnlocked(true);
  }

  async function handlePay() {
    setPayBusy(true);
    try {
      const action = sessionRow?.status === "archived" ? "restore" : "extend";
      await redirectToPojuSessionPayment({
        action,
        sessionId: data.session_id,
        locale,
      });
    } finally {
      setPayBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("confirm_delete"))) return;
    await deleteArchiveItem(archiveId);
    router.push("/archive");
  }

  if (chatUnlocked && liveSession) {
    return (
      <AppDialogProvider>
        <div className="archive-poju-chat-shell min-h-[100dvh] bg-bg-deep">
          <PojuSessionChatShell
            session={liveSession}
            locale={locale}
            onSessionUpdate={setLiveSession}
            onReload={() => setReloadKey((k) => k + 1)}
          />
        </div>
      </AppDialogProvider>
    );
  }

  const visibleMessages = data.messages.filter((m) => m.content.trim());

  return (
    <div className="archive-detail-page mx-auto max-w-2xl pb-28">
      <div className="detail-header mb-6">
        <Link href="/archive" className="text-sm text-violet-300 hover:text-white">
          ← {t("back")}
        </Link>
        <h1 className="mt-4 font-['Manrope'] text-2xl font-bold text-[#d0bcff]">{t("poju_session_title")}</h1>
        {!needsPayment ? (
          <p className="mt-2 text-sm text-white/55">
            {t("poju_session_active_until", { days: daysLeft(effectiveExpiresAt) })}
          </p>
        ) : null}
      </div>

      <div className="original-question mb-6 rounded-xl border border-white/10 bg-black/20 p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[#958ea0]">
          {t("original_question_label")}
        </span>
        <p className="mt-2 text-[15px] leading-relaxed text-[#e7e0ed]">{data.original_question}</p>
      </div>

      <div className="poju-vault-transcript space-y-4">
        {visibleMessages.length === 0 ? (
          <p className="text-sm text-white/50">{t("poju_session_no_messages")}</p>
        ) : (
          visibleMessages.map((msg, idx) => (
            <div
              key={`${msg.timestamp}-${idx}`}
              className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "ml-8 border-violet-400/25 bg-violet-500/10 text-violet-50"
                  : "mr-8 border-white/10 bg-black/25 text-[#e7e0ed]"
              }`}
            >
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/40">
                {msg.role === "user" ? t("poju_role_user") : t("poju_role_assistant")}
              </span>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="archive-poju-footer fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0c0812]/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {needsPayment ? (
            <>
              <p className="text-center text-sm leading-relaxed text-white/75">{t("poju_session_expired_body")}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  disabled={payBusy}
                  onClick={() => void handlePay()}
                  className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {payBusy ? t("poju_session_paying") : t("poju_session_pay_cta")}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/archive")}
                  className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white/85"
                >
                  {t("poju_session_dismiss")}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleContinue()}
                disabled={!canContinue}
                className="w-full rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("poju_session_continue")}
              </button>
              {!canContinue && sessionRow?.status === "paused" ? (
                <p className="text-center text-xs text-amber-200/80">{t("poju_session_paused_hint")}</p>
              ) : null}
            </>
          )}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="text-xs text-red-300/80 underline-offset-2 hover:underline"
            >
              {t("delete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
