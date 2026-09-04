/**
 * First-question Pass gate: small modal → spinner while unlock spends 1 Pass
 * (subscription quota first on server) → success line, or buy/subscribe path.
 */

"use client";

import { useEffect, useState } from "react";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import { usePaywallPurchaseResume } from "@/components/passes/usePaywallPurchaseResume";
import { pivotPaywallCopy } from "@/lib/passes/pivot-paywall-copy";
import "@/styles/pivot-first-pass-gate.css";

export type PivotFirstPassGatePhase = "working" | "success" | "need_pass";

type Props = {
  open: boolean;
  phase: PivotFirstPassGatePhase;
  locale: string;
  sessionId: string;
  onCloseNeedPass: () => void;
  onUnlockedAfterPurchase: (via: "payment" | "code") => void | Promise<void>;
};

export function PivotFirstPassGateModal({
  open,
  phase,
  locale,
  sessionId,
  onCloseNeedPass,
  onUnlockedAfterPurchase,
}: Props) {
  const copy = pivotPaywallCopy(locale);
  const [buyOpen, setBuyOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const unlockIntent = {
    product: "pivot" as const,
    refId: sessionId,
    description: "Pivot full delivery unlock" as const,
  };

  const { openPurchase, closePurchase } = usePaywallPurchaseResume({
    ...unlockIntent,
    onUnlocked: onUnlockedAfterPurchase,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open || phase !== "need_pass") {
      setBuyOpen(false);
    }
  }, [open, phase]);

  if (!open) return null;

  const title =
    phase === "success"
      ? copy.passDeducted(1)
      : phase === "need_pass"
        ? copy.buyOrSubscribePass
        : copy.working;

  return (
    <>
      <div
        className="pj-pass-gate"
        role="dialog"
        aria-modal="true"
        aria-busy={phase === "working"}
        aria-live="polite"
        aria-label={title}
      >
        <div className="pj-pass-gate__card">
          {phase === "working" ? (
            <>
              <div
                className={
                  reducedMotion
                    ? "pj-pass-gate__spinner pj-pass-gate__spinner--static"
                    : "pj-pass-gate__spinner"
                }
                aria-hidden
              />
              <p className="pj-pass-gate__title">{copy.working}</p>
              <p className="pj-pass-gate__sub">{copy.consumePassDesc}</p>
            </>
          ) : null}

          {phase === "success" ? (
            <>
              <div className="pj-pass-gate__check" aria-hidden>
                ✓
              </div>
              <p className="pj-pass-gate__title pj-pass-gate__title--gold">
                {copy.passDeducted(1)}
              </p>
              <p className="pj-pass-gate__sub">{copy.consumePassDesc}</p>
            </>
          ) : null}

          {phase === "need_pass" ? (
            <>
              <p className="pj-pass-gate__title">{copy.deepDialogueTitle}</p>
              <p className="pj-pass-gate__sub">{copy.consumePassDesc}</p>
              <div className="pj-pass-gate__actions">
                <button
                  type="button"
                  className="pj-pass-gate__cta"
                  onClick={() => openPurchase(setBuyOpen)}
                >
                  ✦ {copy.buyOrSubscribePass}
                </button>
                <button
                  type="button"
                  className="pj-pass-gate__dismiss"
                  onClick={onCloseNeedPass}
                >
                  {locale.startsWith("zh") ? "稍后" : "Later"}
                </button>
              </div>
            </>
          ) : null}
        </div>
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

/** Minimum spinner time so the gate does not flash. */
export function passGateMinSpinMs(): number {
  return 700;
}

export function passGateSuccessHoldMs(): number {
  return 1100;
}
