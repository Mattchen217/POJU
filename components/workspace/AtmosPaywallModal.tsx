"use client";

import { useEffect, useState } from "react";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import { usePaywallPurchaseResume } from "@/components/passes/usePaywallPurchaseResume";
import { dispatchPassSpendToast } from "@/lib/passes/pass-client-events";
import { unlockWithPass } from "@/lib/passes/unlock-with-pass";
import "@/styles/poju-paywall-inline.css";

type Props = {
  locale: string;
  /** Profile / record this Atmos 30-day window binds to */
  recordKey: string;
  onUnlocked: (via: "payment" | "code") => void | Promise<void>;
  onClose: () => void;
  busy?: boolean;
};

function newAtmosRefId(recordKey: string): string {
  return `atmos-${recordKey}-${Date.now().toString(36)}`;
}

/**
 * Atmos unlock: 1 Pass → 30-day entitlement for this account+record.
 * Spend order (server): subscription Passes first, then purchased Flex.
 * No balance → Pass purchase / subscribe modal.
 * After buy/subscribe return: auto-spend resumes unlock + spend toast.
 */
export function AtmosPaywallModal({
  locale,
  recordKey,
  onUnlocked,
  onClose,
  busy = false,
}: Props) {
  const zh = locale.startsWith("zh");
  const [payBusy, setPayBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [unlockRefId, setUnlockRefId] = useState(() => newAtmosRefId(recordKey));

  useEffect(() => {
    setUnlockRefId(newAtmosRefId(recordKey));
  }, [recordKey]);

  const unlockIntent = {
    product: "atmos" as const,
    refId: unlockRefId,
    description: "Atmos 30-day field tracking" as const,
    atmosRecordKey: recordKey,
  };

  const { openPurchase, closePurchase } = usePaywallPurchaseResume({
    ...unlockIntent,
    onUnlocked,
  });

  async function spendPass() {
    if (!recordKey.trim()) {
      setErr(zh ? "缺少档案记录" : "Missing profile record");
      return;
    }
    const result = await unlockWithPass({
      product: "atmos",
      refId: unlockRefId,
      description: unlockIntent.description,
      atmosRecordKey: recordKey,
    });
    if (!result.ok) {
      if (result.error === "unauthorized" || result.error === "pass_login_required") {
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
    setErr(null);
    try {
      await spendPass();
    } finally {
      setPayBusy(false);
    }
  }

  return (
    <>
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
          <button
            type="button"
            className="atmos-paywall-sheet__close"
            onClick={onClose}
            aria-label={zh ? "关闭" : "Close"}
          >
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
                  See today&apos;s <span className="pwall__gold">energy weather</span> &amp; one clear
                  move
                </>
              )}
            </h2>
            <p className="pwall__sub">
              {zh
                ? "消耗 1 个 Pass（优先订阅额度），对该档案开启 30 天追踪窗口。"
                : "Spend 1 Pass (subscription balance first) to open a 30-day tracking window for this profile."}
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
                  ? "✦ 使用 1 Pass 解锁 · 30 天"
                  : "✦ Unlock with 1 Pass · 30 days"}
            </button>
            <button
              type="button"
              className="pwall__code-toggle"
              onClick={() => openPurchase(setBuyOpen)}
            >
              {zh ? "购买 / 订阅 Pass" : "Buy / subscribe Passes"}
            </button>
            {err ? (
              <p className="m-0 mt-2 text-center text-xs text-[#fca5a5]" role="alert">
                {err}
              </p>
            ) : null}
          </div>
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
