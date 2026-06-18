"use client";

import { useState, type ReactNode } from "react";
import { redirectToGlyphUnlockPayment } from "@/lib/glyph/start-glyph-unlock-payment";
import { redirectToMatchUnlockPayment } from "@/lib/match/start-match-unlock-payment";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";
import { redirectToSyncroUnlockPayment } from "@/lib/syncro/start-syncro-unlock-payment";
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
  price: string;
  cta: string;
  codePh: string;
};

export function ToolPaywallInline(props: Props) {
  const { product, locale, onUnlocked, busy = false } = props;
  const pendingQuestion = product === "syncro" ? "" : props.pendingQuestion;
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

      let ok = false;
      if (product === "glyph") {
        ok = await redirectToGlyphUnlockPayment({
          readingId: props.readingId,
          locale,
          pendingQuestion,
        });
      } else if (product === "match") {
        ok = await redirectToMatchUnlockPayment({
          previewId: props.previewId,
          locale,
          pendingQuestion,
        });
      } else {
        ok = await redirectToSyncroUnlockPayment({
          previewId: props.previewId,
          locale,
        });
      }
      if (!ok) setPayBusy(false);
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
              Unlock the <span className="pwall__gold">full timing matrix</span> &amp; directional guidance
            </>
          ),
          sub: zh
            ? "解锁针对你任务与位置的完整 96 格时空矩阵与 AI 择时解读。"
            : "Unlock the full 96-cell timing matrix and AI guidance for your task and location.",
          price: "1.99",
          cta: zh ? "✦ 解锁完整择时 · $1.99" : "✦ Unlock full timing · $1.99",
          codePh: zh ? "体验码 SYNCRO-XXXX-XXXX" : "Have a code? SYNCRO-XXXX-XXXX",
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
                Unlock <span className="pwall__gold">dual depth reports</span> &amp; relationship analysis
              </>
            ),
            sub: zh
              ? "解锁 A、B 双方完整八字结构分析，以及针对你们关系问题的深度合盘报告。"
              : "Unlock full structural reports for both charts and a deep relationship analysis for your question.",
            price: "4.99",
            cta: zh ? "✦ 解锁完整合盘 · $4.99" : "✦ Unlock full match · $4.99",
            codePh: zh ? "体验码 MATCH-XXXX-XXXX" : "Have a code? MATCH-XXXX-XXXX",
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
              ? "解锁完整八字结构分析，以及针对你问题的符号深度解读。"
              : "Unlock the full structural birth analysis and a deep glyph reading for your question.",
            price: "4.99",
            cta: zh ? "✦ 解锁完整解读 · $4.99" : "✦ Unlock full reading · $4.99",
            codePh: zh ? "体验码 GLYPH-XXXX-XXXX" : "Have a code? GLYPH-XXXX-XXXX",
          };

  return (
    <div className="pwall">
      <div className="pwall__lab">
        <span aria-hidden>🔒</span>
        {copy.lab}
      </div>
      <h2 className="pwall__title">{copy.title}</h2>
      <p className="pwall__sub">{copy.sub}</p>
      <div className="pwall__price">
        <span className="pwall__cur">$</span>
        <span className="pwall__num">{copy.price}</span>
        <span className="pwall__unit">{zh ? "/ 单次解读" : "/ per reading"}</span>
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
          {payBusy ? (zh ? "跳转支付…" : "Redirecting…") : copy.cta}
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
              placeholder={copy.codePh}
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
