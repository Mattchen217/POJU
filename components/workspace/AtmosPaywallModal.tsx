"use client";

import { useState } from "react";

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

/**
 * Atmos unlock: spends 1 Pass and starts a 30-day entitlement for this account+record.
 * Payment gateway for buying Passes lives on Pricing; this modal only consumes Passes.
 */
export function AtmosPaywallModal({
  locale,
  recordKey,
  onUnlocked,
  onClose,
  busy = false,
}: Props) {
  const zh = locale.startsWith("zh");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function spendPass(via: "payment" | "code") {
    if (!recordKey.trim()) {
      setErr(zh ? "缺少档案记录" : "Missing profile record");
      return;
    }
    const refId = `atmos-${recordKey}-${Date.now().toString(36)}`;
    const result = await unlockWithPass({
      product: "atmos",
      refId,
      description: "Atmos 30-day field tracking",
      atmosRecordKey: recordKey,
    });
    if (!result.ok) {
      if (result.error === "unauthorized" || result.error === "pass_login_required") {
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
    setErr(null);
    try {
      await spendPass("payment");
    } finally {
      setPayBusy(false);
    }
  }

  async function handleRedeem() {
    if (codeBusy || busy || !code.trim()) return;
    setCodeBusy(true);
    setErr(null);
    try {
      void code;
      await spendPass("code");
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
              ? "消耗 1 个 Pass，对该档案开启 30 天追踪窗口。期内可反复展开阅读。"
              : "Spend 1 Pass to open a 30-day tracking window for this profile. Reopen readings anytime within the window."}
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
          {err ? (
            <p className="m-0 mt-2 text-center text-xs text-[#fca5a5]" role="alert">
              {err}
            </p>
          ) : null}
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
