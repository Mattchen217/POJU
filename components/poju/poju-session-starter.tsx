"use client";

import { useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useState, type ReactNode } from "react";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { getActivePOJUSessionsByDevice } from "@/lib/poju/session-manager";

/** Until a real gateway is wired, quick-start must seed the same sessionStorage keys as the question dialog flow. */
const MOCK_PENDING_QUESTION = "I'd like to begin a POJU session.";

type Props = {
  className?: string;
  children: ReactNode;
};

/**
 * v4：同设备已有 IndexedDB active 会话 → 确认后进入 `/poju/session/[id]`；
 * 否则走占位支付链。
 */
export function PojuSessionStarter({ className, children }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const deviceId = getPojuDeviceId();
      const v4Active = await getActivePOJUSessionsByDevice(deviceId);
      if (v4Active.length > 0) {
        v4Active.sort((a, b) => b.last_interaction_at.getTime() - a.last_interaction_at.getTime());
        const sessionId = v4Active[0].session_id;
        const go = window.confirm(
          "You already have an active POJU session on this device. Open it now, or Cancel to stay on this page.",
        );
        if (go) {
          queueMicrotask(() => {
            router.push(`/poju/session/${sessionId}`);
          });
        }
        return;
      }

      sessionStorage.setItem("poju_pending_question", MOCK_PENDING_QUESTION);
      const returnUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/${locale}/poju/payment-success`
          : `/${locale}/poju/payment-success`;
      const pay = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: "poju", locale, return_url: returnUrl }),
      });
      const p = (await pay.json()) as {
        checkout_url?: string;
        payment_url?: string;
        order_id?: string;
        ok?: boolean;
      };
      const target = p.payment_url ?? p.checkout_url;
      if (target) {
        if (p.order_id) sessionStorage.setItem("poju_pending_order_id", p.order_id);
        window.location.href = target;
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy} onClick={() => void onClick()} className={className}>
      {busy ? "…" : children}
    </button>
  );
}
