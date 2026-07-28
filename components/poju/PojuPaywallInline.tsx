"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { unlockWithPass } from "@/lib/passes/unlock-with-pass";
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

/**
 * Pivot unlock: spend 1 Pass (idempotent with final-delivery on same session_id).
 */
export function PojuPaywallInline({
  sessionId,
  locale,
  pendingQuestion,
  onUnlocked,
  busy = false,
}: Props) {
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const zh = locale.startsWith("zh");

  async function spendPass(via: "payment" | "code") {
    setErr(null);
    void pendingQuestion;
    const result = await unlockWithPass({
      product: "pivot",
      refId: sessionId,
      description: "Pivot full delivery unlock",
    });
    if (!result.ok) {
      if (result.error === "unauthorized") {
        setErr(zh ? "请先登录后再使用 Pass" : "Sign in to use a Pass");
      } else if (result.error === "insufficient_balance") {
        setErr(
          zh
            ? "Pass 不足，请先购买或订阅"
            : "Not enough Passes — buy or subscribe first",
        );
      } else {
        setErr(zh ? "解锁失败，请重试" : "Unlock failed — try again");
      }
      return;
    }
    await onUnlocked(via);
  }

  async function handlePay() {
    if (payBusy || busy) return;
    setPayBusy(true);
    try {
      await spendPass("payment");
    } finally {
      setPayBusy(false);
    }
  }

  async function handleRedeem() {
    if (codeBusy || busy || !code.trim()) return;
    setCodeBusy(true);
    try {
      void code;
      await spendPass("code");
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
            查看<span className="pwall__gold">完整矩阵</span>并与 Pivot 深入对话
          </>
        ) : (
          <>
            See the <span className="pwall__gold">complete matrix</span> &amp; work it through with
            Pivot
          </>
        )}
      </h2>
      <p className="pwall__sub">
        {zh
          ? "消耗 1 个 Pass，解锁完整结构分析、对齐向量、时机窗口与引导对话。"
          : "Spend 1 Pass to unlock the full structural analysis, alignment vectors, timing windows, and guided dialogue."}
      </p>
      <div className="pwall__price">
        <span className="pwall__num">1</span>
        <span className="pwall__unit">{zh ? " Pass / 次" : " Pass / session"}</span>
      </div>
      <div className="pwall__trust">
        <span>
          <b>✓</b> {zh ? "先买 Pass 或订阅" : "Buy Passes or subscribe first"}
        </span>
        <span>
          <b>✓</b> {zh ? "一次交付扣 1 Pass" : "1 Pass per delivery"}
        </span>
      </div>
      <div className="pwall__actions">
        <button
          type="button"
          className="pwall__cta"
          disabled={payBusy || busy}
          onClick={() => void handlePay()}
        >
          {payBusy
            ? zh
              ? "处理中…"
              : "Working…"
            : zh
              ? "✦ 使用 1 Pass 解锁"
              : "✦ Unlock with 1 Pass"}
        </button>
        <Link href="/#v2-pricing" className="pwall__code-toggle">
          {zh ? "购买 / 订阅 Pass" : "Buy / subscribe Passes"}
        </Link>
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
            <button
              type="button"
              disabled={codeBusy || busy || !code.trim()}
              onClick={() => void handleRedeem()}
            >
              {zh ? "核销" : "Redeem"}
            </button>
          </div>
        )}
      </div>
      {err ? (
        <p className="m-0 mt-2 text-center text-xs text-[#fca5a5]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
