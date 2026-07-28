"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
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
  codePh: string;
};

export function ToolPaywallInline(props: Props) {
  const { product, locale, onUnlocked, busy = false } = props;
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const zh = locale.startsWith("zh");

  function refIdForProduct(): string {
    if (product === "glyph") return props.readingId;
    return props.previewId;
  }

  async function spendPass(via: "payment" | "code") {
    setErr(null);
    const result = await unlockWithPass({
      product: product as PassProduct,
      refId: refIdForProduct(),
      description: `${product} full unlock`,
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
      return false;
    }
    await onUnlocked(via);
    return true;
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
            ? "消耗 1 个 Pass，解锁完整 96 格时空矩阵与 AI 择时解读。"
            : "Spend 1 Pass to unlock the full 96-cell timing matrix and AI guidance.",
          cta: zh ? "✦ 使用 1 Pass 解锁" : "✦ Unlock with 1 Pass",
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
                Unlock <span className="pwall__gold">dual depth reports</span> &amp; relationship
                analysis
              </>
            ),
            sub: zh
              ? "消耗 1 个 Pass，解锁双方完整结构分析与关系深度报告。"
              : "Spend 1 Pass to unlock full structural reports and a deep relationship analysis.",
            cta: zh ? "✦ 使用 1 Pass 解锁" : "✦ Unlock with 1 Pass",
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
              ? "消耗 1 个 Pass，解锁完整结构分析与符号深度解读。"
              : "Spend 1 Pass to unlock the full structural birth analysis and glyph reading.",
            cta: zh ? "✦ 使用 1 Pass 解锁" : "✦ Unlock with 1 Pass",
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
        <span className="pwall__num">1</span>
        <span className="pwall__unit">{zh ? " Pass / 次" : " Pass / unlock"}</span>
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
          {payBusy ? (zh ? "处理中…" : "Working…") : copy.cta}
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
              placeholder={copy.codePh}
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
