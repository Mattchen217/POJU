"use client";

import { useState } from "react";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import { usePaywallPurchaseResume } from "@/components/passes/usePaywallPurchaseResume";
import { dispatchPassSpendToast } from "@/lib/passes/pass-client-events";
import { pivotPaywallCopy } from "@/lib/passes/pivot-paywall-copy";
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
  const copy = pivotPaywallCopy(locale);

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
      if (result.error === "insufficient_balance") {
        openPurchase(setBuyOpen);
      } else {
        setErr(copy.errUnlockFailed);
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
          {copy.unlockWithPass}
        </div>
        <h2 id="pchat-paywall-title" className="pwall__title">
          {copy.deepDialogueTitle}
        </h2>
        <p className="pwall__sub">{copy.consumePassDesc}</p>
        <div className="pwall__price">
          <span className="pwall__num">1</span>
          <span className="pwall__unit">{copy.passPerSession}</span>
        </div>
        <div className="pwall__actions">
          <button
            type="button"
            className="pwall__cta"
            disabled={payBusy || busy}
            onClick={() => void handlePay()}
          >
            {payBusy ? copy.working : `✦ ${copy.unlockWithPass}`}
          </button>
          <button
            type="button"
            className="pwall__code-toggle"
            onClick={() => openPurchase(setBuyOpen)}
          >
            {copy.buyOrSubscribePass}
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
