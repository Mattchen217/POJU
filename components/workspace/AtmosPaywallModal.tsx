"use client";

import { useState } from "react";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";
import "@/styles/poju-paywall-inline.css";

type Props = {
  locale: string;
  onUnlocked: (via: "payment" | "code") => void | Promise<void>;
  onClose: () => void;
  busy?: boolean;
};

/** Atmos today-forecast paywall ($9.99). Gateway off → unlock locally for this step. */
export function AtmosPaywallModal({ locale, onUnlocked, onClose, busy = false }: Props) {
  const zh = locale.startsWith("zh");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);

  async function handlePay() {
    if (payBusy || busy) return;
    setPayBusy(true);
    try {
      // Stripe product wiring for Atmos comes in a later pass; unlock when gateway off
      // or when enabled (dev path) so the daily LLM flow is testable end-to-end.
      if (!isPaymentGatewayEnabled()) {
        await onUnlocked("payment");
        return;
      }
      await onUnlocked("payment");
    } catch {
      setPayBusy(false);
    }
  }

  async function handleRedeem() {
    if (codeBusy || busy || !code.trim()) return;
    setCodeBusy(true);
    try {
      void code;
      await onUnlocked("code");
    } finally {
      setCodeBusy(false);
    }
  }

  return (
    <div
      className="atmos-paywall-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="atmos-paywall-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="atmos-paywall-sheet">
        <button type="button" className="atmos-paywall-sheet__close" onClick={onClose} aria-label={zh ? "关闭" : "Close"}>
          ×
        </button>
        <div className="pwall">
          <div className="pwall__lab">
            <span aria-hidden>🔒</span>
            {zh ? "解锁今日场域预报" : "Unlock today's field forecast"}
          </div>
          <h2 id="atmos-paywall-title" className="pwall__title">
            {zh ? (
              <>
                查看<span className="pwall__gold">今日能量气象</span>与行动建议
              </>
            ) : (
              <>
                See today&apos;s <span className="pwall__gold">energy weather</span> &amp; one clear move
              </>
            )}
          </h2>
          <p className="pwall__sub">
            {zh
              ? "本地算力到日 + 一次 AI 教练解读。一次解锁，今日可反复展开阅读。"
              : "Local day-level compute + one AI coaching read. Unlock once; reopen today's reading anytime."}
          </p>
          <button
            type="button"
            className="pwall__cta"
            disabled={payBusy || busy}
            onClick={() => void handlePay()}
          >
            {payBusy || busy
              ? zh
                ? "处理中…"
                : "Working…"
              : zh
                ? "✦ 解锁今日预报 · $9.99"
                : "✦ Unlock today's forecast · $9.99"}
          </button>
          <button
            type="button"
            className="pwall__code-toggle"
            onClick={() => setCodeOpen((v) => !v)}
          >
            {zh ? "有体验码？" : "Have a code?"}
          </button>
          {codeOpen ? (
            <div className="pwall__code-row">
              <input
                className="pwall__code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={zh ? "体验码 ATMOS-XXXX" : "Code ATMOS-XXXX"}
                aria-label={zh ? "体验码" : "Unlock code"}
              />
              <button
                type="button"
                className="pwall__code-go"
                disabled={codeBusy || busy || !code.trim()}
                onClick={() => void handleRedeem()}
              >
                {zh ? "兑换" : "Redeem"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
