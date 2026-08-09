"use client";

import { useState, type ReactNode } from "react";

import { PassPurchaseModal } from "@/components/account/PassPurchaseModal";
import { usePaywallPurchaseResume } from "@/components/passes/usePaywallPurchaseResume";
import { dispatchPassSpendToast } from "@/lib/passes/pass-client-events";
import { unlockWithPass } from "@/lib/passes/unlock-with-pass";
import type { PassProduct } from "@/lib/passes/types";
import "@/styles/poju-paywall-inline.css";

type GlyphProps = {
  product: "glyph";
  readingId: string;
  locale: string;
  pendingQuestion: string;
  onUnlocked: (via: "payment" | "code") => void | Promise<void>;
  busy?: boolean;
};

type MatchProps = {
  product: "match";
  previewId: string;
  locale: string;
  pendingQuestion: string;
  onUnlocked: (via: "payment" | "code") => void | Promise<void>;
  busy?: boolean;
};

type SyncroProps = {
  product: "syncro";
  previewId: string;
  locale: string;
  onUnlocked: (via: "payment" | "code") => void | Promise<void>;
  busy?: boolean;
};

type Props = GlyphProps | MatchProps | SyncroProps;

type PaywallCopy = {
  lab: string;
  title: ReactNode;
  sub: string;
  cta: string;
};

/**
 * Match / Syncro / Glyph unlock: 1 Pass each.
 * Spend order (server): subscription → flex. No balance → purchase modal.
 * After buy/subscribe return: auto-spend resumes unlock + spend toast.
 */
export function ToolPaywallInline(props: Props) {
  const { product, locale, onUnlocked, busy = false } = props;
  const [payBusy, setPayBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const zh = locale.startsWith("zh");

  const refId = product === "glyph" ? props.readingId : props.previewId;
  const unlockIntent = {
    product: product as PassProduct,
    refId,
    description: `${product} full unlock`,
  };

  const { openPurchase, closePurchase } = usePaywallPurchaseResume({
    ...unlockIntent,
    onUnlocked,
  });

  async function spendPass() {
    setErr(null);
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

  const copy: PaywallCopy =
    product === "syncro"
      ? {
          lab: zh ? "解锁完整择时" : "Unlock full timing",
          title: zh ? (
            <>
              解锁<span className="pwall__gold">完整时空矩阵</span>与方向指引
            </>
          ) : (
            <>
              Unlock the <span className="pwall__gold">full timing matrix</span> &amp; directional
              guidance
            </>
          ),
          sub: zh
            ? "消耗 1 个 Pass（优先订阅额度），解锁完整矩阵与 AI 择时解读。"
            : "Spend 1 Pass (subscription balance first) to unlock the full matrix and AI guidance.",
          cta: zh ? "✦ 使用 1 Pass 解锁" : "✦ Unlock with 1 Pass",
        }
      : product === "match"
        ? {
            lab: zh ? "解锁完整合盘" : "Unlock full match",
            title: zh ? (
              <>
                解锁<span className="pwall__gold">双人深度报告</span>与关系解读
              </>
            ) : (
              <>
                Unlock <span className="pwall__gold">dual depth reports</span> &amp; relationship
                analysis
              </>
            ),
            sub: zh
              ? "消耗 1 个 Pass（优先订阅额度），解锁双方深度报告。"
              : "Spend 1 Pass (subscription balance first) to unlock dual depth reports.",
            cta: zh ? "✦ 使用 1 Pass 解锁" : "✦ Unlock with 1 Pass",
          }
        : {
            lab: zh ? "解锁完整解读" : "Unlock full reading",
            title: zh ? (
              <>
                解锁<span className="pwall__gold">完整符号解读</span>与八字深度报告
              </>
            ) : (
              <>
                Unlock the <span className="pwall__gold">full glyph reading</span> &amp; depth report
              </>
            ),
            sub: zh
              ? "消耗 1 个 Pass（优先订阅额度），解锁完整符号解读。"
              : "Spend 1 Pass (subscription balance first) to unlock the full glyph reading.",
            cta: zh ? "✦ 使用 1 Pass 解锁" : "✦ Unlock with 1 Pass",
          };

  return (
    <>
      <div className="pwall">
        <div className="pwall__lab">
          <span aria-hidden>🔒</span>
          {copy.lab}
        </div>
        <h2 className="pwall__title">{copy.title}</h2>
        <p className="pwall__sub">{copy.sub}</p>
        <div className="pwall__price">
          <span className="pwall__num">1</span>
          <span className="pwall__unit">{zh ? " Pass / 次" : " Pass / unlock"}</span>
        </div>
        <div className="pwall__actions">
          <button
            type="button"
            className="pwall__cta"
            disabled={payBusy || busy}
            onClick={() => void handlePay()}
          >
            {payBusy ? (zh ? "处理中…" : "Working…") : copy.cta}
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
