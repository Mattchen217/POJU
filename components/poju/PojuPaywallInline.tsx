"use client";

import { useState } from "react";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import { usePaywallPurchaseResume } from "@/components/passes/usePaywallPurchaseResume";
import { dispatchPassSpendToast } from "@/lib/passes/pass-client-events";
import { unlockWithPass } from "@/lib/passes/unlock-with-pass";
import "@/styles/poju-paywall-inline.css";

type Props = {
  sessionId: string;
  locale: string;
  pendingQuestion: string;
  onUnlocked: (via: "payment" | "code") => void | Promise<void>;
  busy?: boolean;
  workspaceSurface?: boolean;
};

/**
 * Pivot unlock: 1 Pass (idempotent with final-delivery on same session_id).
 * Spend order (server): subscription → flex. No balance → purchase modal.
 * After buy/subscribe return: auto-spend resumes unlock + spend toast.
 */
export function PojuPaywallInline({
  sessionId,
  locale,
  pendingQuestion,
  onUnlocked,
  busy = false,
}: Props) {
  const [payBusy, setPayBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const zh = locale.startsWith("zh");

  const unlockIntent = {
    product: "pivot" as const,
    refId: sessionId,
    description: "Pivot full delivery unlock",
  };

  const { openPurchase, closePurchase } = usePaywallPurchaseResume({
    ...unlockIntent,
    onUnlocked,
  });

  async function spendPass() {
    setErr(null);
    void pendingQuestion;
    const result = await unlockWithPass(unlockIntent);
    if (!result.ok) {
      if (result.error === "unauthorized") {
        setErr(zh ? "请先登录后再使用 Pass" : "Sign in to use a Pass");
      } else if (result.error === "insufficient_balance") {
        openPurchase(setBuyOpen);
      } else {
        setErr(zh ? "解锁失败，请重试" : "Unlock failed — try again");
      }
      return;
    }
    if (!result.already_entitled) {
      dispatchPassSpendToast({ amount: 1, locale });
    }
    await onUnlocked("payment");
  }

  async function handlePay() {
    if (payBusy || busy) return;
    setPayBusy(true);
    try {
      await spendPass();
    } finally {
      setPayBusy(false);
    }
  }

  return (
    <>
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
            ? "消耗 1 个 Pass（优先订阅额度），解锁完整结构分析与引导对话。"
            : "Spend 1 Pass (subscription balance first) to unlock the full structural analysis and guided dialogue."}
        </p>
        <div className="pwall__price">
          <span className="pwall__num">1</span>
          <span className="pwall__unit">{zh ? " Pass / 次" : " Pass / session"}</span>
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
          <button
            type="button"
            className="pwall__code-toggle"
            onClick={() => openPurchase(setBuyOpen)}
          >
            {zh ? "购买 / 订阅 Pass" : "Buy / subscribe Passes"}
          </button>
        </div>
        {err ? (
          <p className="m-0 mt-2 text-center text-xs text-[#fca5a5]" role="alert">
            {err}
          </p>
        ) : null}
      </div>

      <PassPurchaseModal
        open={buyOpen}
        onClose={() => closePurchase(setBuyOpen)}
        reason="insufficient"
        unlockAfterPurchase={unlockIntent}
      />
    </>
  );
}
