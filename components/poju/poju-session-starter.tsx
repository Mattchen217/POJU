"use client";

import { useRouter } from "@/i18n/navigation";
import { useState, type ReactNode } from "react";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";

type Props = {
  className?: string;
  children: ReactNode;
};

/**
 * Batch4：同设备单 active 检查 → 可选继续；否则走 $9.99 占位支付链 → /start → /chat?token=…
 */
export function PojuSessionStarter({ className, children }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const deviceId = getPojuDeviceId();
      const st = await fetch("/api/poju/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const status = (await st.json()) as {
        ok?: boolean;
        active?: boolean;
        sessionId?: string;
      };
      if (status.ok && status.active && status.sessionId) {
        const go = window.confirm(
          "You already have an active POJU session on this device. Open it now, or Cancel to stay on this page.",
        );
        if (go) {
          router.push(`/poju/session/${encodeURIComponent(status.sessionId)}`);
        }
        return;
      }

      const pay = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: "poju" }),
      });
      const p = (await pay.json()) as { checkout_url?: string; ok?: boolean };
      if (p.checkout_url) {
        router.push(p.checkout_url);
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
