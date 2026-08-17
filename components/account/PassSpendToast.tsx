"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import {
  PASS_SPEND_TOAST_EVENT,
  type PassSpendToastDetail,
} from "@/lib/passes/pass-client-events";
import { pivotPaywallCopy } from "@/lib/passes/pivot-paywall-copy";

const DISMISS_MS = 3000;

/**
 * Top-of-page toast: “已经扣除 1 Pass” after a successful paywall auto-spend.
 */
export function PassSpendToast() {
  const locale = useLocale();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<PassSpendToastDetail>).detail;
      const amount = detail?.amount && detail.amount > 0 ? detail.amount : 1;
      const loc = detail?.locale ?? locale;
      setMessage(pivotPaywallCopy(loc).passDeducted(amount));
    };
    window.addEventListener(PASS_SPEND_TOAST_EVENT, onToast);
    return () => window.removeEventListener(PASS_SPEND_TOAST_EVENT, onToast);
  }, [locale]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      className="pass-spend-toast"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        zIndex: 100,
        width: "min(420px, 92vw)",
        transform: "translateX(-50%)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          borderRadius: 8,
          border: "1px solid rgba(242, 202, 80, 0.35)",
          background: "rgba(11, 15, 18, 0.92)",
          boxShadow: "0 8px 28px rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          padding: "12px 16px",
          textAlign: "center",
        }}
      >
        <p
          className="m-0"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ws-gold, #f2ca50)",
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
