"use client";

import { useState } from "react";
import { redirectToPojuUnlockPayment } from "@/lib/poju/start-poju-unlock-payment";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";
import "@/styles/poju-paywall-inline.css";

type Props = {
  sessionId: string;
  locale: string;
  pendingQuestion: string;
  onUnlocked: (via: "payment" | "code") => void | Promise<void>;
  busy?: boolean;
  /** Payment return should resume workspace center ritual. */
  workspaceSurface?: boolean;
};

export function PojuPaywallInline({
  sessionId,
  locale,
  pendingQuestion,
  onUnlocked,
  busy = false,
  workspaceSurface = false,
}: Props) {
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const zh = locale.startsWith("zh");

  async function handlePay() {
    if (payBusy || busy) return;
    setPayBusy(true);
    try {
      if (!isPaymentGatewayEnabled()) {
        await onUnlocked("payment");
        return;
      }

      const ok = await redirectToPojuUnlockPayment({
        sessionId,
        locale,
        pendingQuestion,
        workspaceSurface,
      });
      if (!ok) setPayBusy(false);
    } catch {
      setPayBusy(false);
    }
  }

  async function handleRedeem() {
    if (codeBusy || busy || !code.trim()) return;
    setCodeBusy(true);
    try {
      // TODO: POST /api/codes/redeem { code, product: 'poju', session_id }
      void code;
      await onUnlocked("code");
    } finally {
      setCodeBusy(false);
    }
  }

  return (
    <div className="pwall">
      <div className="pwall__lab">
        <span aria-hidden>🔒</span>
        {zh ? "解锁完整对齐" : "Unlock the Full Alignment"}
      </div>
      <h2 id="pchat-paywall-title" className="pwall__title">
        {zh ? (
          <>
            查看<span className="pwall__gold">完整矩阵</span>并与 POJU 深入对话
          </>
        ) : (
          <>
            See the <span className="pwall__gold">complete matrix</span> &amp; work it through with POJU
          </>
        )}
      </h2>
      <p className="pwall__sub">
        {zh
          ? "解锁你问题的完整结构分析、对齐向量、时机窗口，以及 POJU 引导的 30 天对话。"
          : "Unlock the full structural analysis of your question, alignment vectors, timing windows, and a guided dialogue with POJU."}
      </p>
      <div className="pwall__price">
        <span className="pwall__cur">$</span>
        <span className="pwall__num">9.99</span>
        <span className="pwall__unit">{zh ? "/ 单次会话" : "/ per session"}</span>
      </div>
      <div className="pwall__trust">
        <span>
          <b>✓</b> {zh ? "一次性" : "One-time"}
        </span>
        <span>
          <b>✓</b> {zh ? "无需账户" : "No account"}
        </span>
        <span>
          <b>✓</b> {zh ? "不存储" : "Never stored"}
        </span>
      </div>
      <div className="pwall__actions">
        <button type="button" className="pwall__cta" disabled={payBusy || busy} onClick={() => void handlePay()}>
          {payBusy ? (zh ? "跳转支付…" : "Redirecting…") : zh ? "✦ 解锁完整分析 · $9.99" : "✦ Unlock full analysis · $9.99"}
        </button>
        {!codeOpen ? (
          <button type="button" className="pwall__code-toggle" onClick={() => setCodeOpen(true)}>
            {zh ? "使用体验码" : "Use experience code"}
          </button>
        ) : (
          <div className="pwall__codebox">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={zh ? "体验码 POJU-XXXX-XXXX" : "Have a code? POJU-XXXX-XXXX"}
              disabled={codeBusy || busy}
            />
            <button type="button" disabled={codeBusy || busy || !code.trim()} onClick={() => void handleRedeem()}>
              {zh ? "核销" : "Redeem"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
