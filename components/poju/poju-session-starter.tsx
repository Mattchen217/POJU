"use client";

import { useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useState, type ReactNode } from "react";

import { PojuSessionPickerModal } from "@/components/poju/PojuSessionPickerModal";
import {
  listActivePojuSessionsForPicker,
  type ActivePojuSessionPickerRow,
} from "@/lib/cross-product/list-active-poju-sessions-for-picker";
import { redirectToPojuPayment } from "@/lib/poju/start-poju-payment";
import { runPOJUV4SessionMaintenance } from "@/lib/poju/v4-lifecycle";

type Props = {
  className?: string;
  children: ReactNode;
};

/**
 * POJU 营销页 CTA：无有效会话 → 占位支付；有 30 天内 active 会话 → 弹窗选新购或继续旧会话。
 */
export function PojuSessionStarter({ className, children }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [pickerSessions, setPickerSessions] = useState<ActivePojuSessionPickerRow[] | null>(null);
  const [paying, setPaying] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      // Maintenance already runs on app init; archive expired rows in background without blocking the picker.
      void runPOJUV4SessionMaintenance().catch(() => {});
      const sessions = await listActivePojuSessionsForPicker();
      if (sessions.length === 0) {
        await redirectToPojuPayment(locale);
        return;
      }
      setPickerSessions(sessions);
    } finally {
      setBusy(false);
    }
  }

  async function startNewSession() {
    if (paying) return;
    setPaying(true);
    try {
      await redirectToPojuPayment(locale);
    } finally {
      setPaying(false);
    }
  }

  function openExistingSession(sessionId: string) {
    setPickerSessions(null);
    queueMicrotask(() => {
      router.push(`/poju/session/${sessionId}`);
    });
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={() => void onClick()} className={className}>
        {busy ? "…" : children}
      </button>

      {pickerSessions ? (
        <PojuSessionPickerModal
          sessions={pickerSessions}
          onClose={() => setPickerSessions(null)}
          onNewSession={() => void startNewSession()}
          onSelectSession={openExistingSession}
          newSessionBusy={paying}
        />
      ) : null}
    </>
  );
}
