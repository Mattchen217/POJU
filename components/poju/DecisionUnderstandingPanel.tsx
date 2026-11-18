"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { POJUSessionState } from "@/lib/poju/types";
import { projectDecisionUnderstandingBox } from "@/lib/poju/decision-intake/ui-projection";

/** Unified Decision Understanding box — Session SoT only; no second fact store. */
export function DecisionUnderstandingPanel({
  session,
  locale,
}: {
  session: POJUSessionState | null | undefined;
  locale: string;
}) {
  const [expanded, setExpanded] = useState(true);
  if (!session?.decision_understanding) return null;
  const box = projectDecisionUnderstandingBox(session);
  const isZh = locale.toLowerCase().startsWith("zh");
  const title = isZh ? "\u51b3\u7b56\u7406\u89e3" : "DECISION UNDERSTANDING";
  const currentTitle = isZh ? "\u5f53\u524d\u7406\u89e3" : "Current understanding";
  const understoodTitle = isZh ? "\u5df2\u7ecf\u4e86\u89e3" : "Already understood";
  const needTitle = isZh ? "\u8fd8\u9700\u8981\u4e86\u89e3" : "Still need to understand";
  const insightTitle = isZh ? "\u4e2a\u4eba\u6a21\u5f0f\u6d1e\u5bdf" : "Personal Pattern Insight";
  const insightNature = isZh
    ? "\u4e3a\u4f20\u7edf\u89e3\u91ca\u6216\u5f85\u9a8c\u8bc1\u5047\u8bbe\uff0c\u4e0d\u662f\u5df2\u786e\u8ba4\u4e8b\u5b9e"
    : "Traditional interpretation or an unverified hypothesis, not a confirmed fact";
  const qTitle = isZh ? "\u5f53\u524d\u95ee\u9898" : "Current question";
  const conflictTitle = isZh ? "\u5c1a\u5f85\u6f84\u6e05\u7684\u77db\u76fe" : "Open conflicts";
  const progressHint = isZh
    ? "\u4fe1\u606f\u51c6\u5907\u7a0b\u5ea6\uff08\u57fa\u4e8e\u8c03\u67e5\u5b8c\u6210\u6761\u4ef6\u4e0e\u4fe1\u606f\u7f3a\u53e3\uff0c\u4e0d\u662f\u63d0\u95ee\u6b21\u6570\uff09"
    : "Information readiness (completion conditions and remaining gaps, not question count)";
  const confirmHint =
    session.agent_v2?.current_phase === "awaiting_confirmation" &&
    session.decision_understanding.readiness.can_ask === false
      ? isZh
        ? "\u82e5\u5f53\u524d\u7406\u89e3\u51c6\u786e\uff0c\u8bf7\u5728\u4e0b\u65b9\u8f93\u5165\u6846\u5185\u9009\u62e9\u786e\u8ba4\uff1b\u82e5\u6709\u9057\u6f0f\u6216\u9700\u8981\u8865\u5145\uff0c\u8bf7\u76f4\u63a5\u5728\u8f93\u5165\u6846\u91cc\u8bf4\u660e\u3002"
        : "If this understanding is accurate, choose confirm in the input box below. To point out a gap or add something, type it directly in the input box."
      : null;
  const percent = box.progress_percent;

  return (
    <section className="pchat__understanding-box" aria-label={title}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="pchat__understanding-box__toggle"
        aria-expanded={expanded}
      >
        <span className="pchat__understanding-box__title">
          {title}
          {percent != null ? <span className="pchat__understanding-box__pct">{percent}%</span> : null}
        </span>
        {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
      </button>
      {percent != null ? (
        <div className="pchat__understanding-box__meter" aria-hidden={!expanded}>
          <div className="pchat__understanding-box__bar">
            <div
              className="pchat__understanding-box__bar-fill"
              style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
            />
          </div>
        </div>
      ) : null}
      {expanded ? (
        <div className="pchat__understanding-box__body">
          {percent != null ? <div className="pchat__understanding-box__hint">{progressHint}</div> : null}
          <div>
            <div className="pchat__understanding-box__label">{currentTitle}</div>
            <div className="pchat__understanding-box__text">{box.current_understanding ?? "\u2014"}</div>
          </div>
          {box.already_understood.length > 0 ? (
            <div>
              <div className="pchat__understanding-box__label">{understoodTitle}</div>
              <ul>
                {box.already_understood.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {box.still_need.length > 0 || box.conflicts.length > 0 ? (
            <div>
              <div className="pchat__understanding-box__label">{needTitle}</div>
              <ul>
                {box.still_need.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {box.conflicts.map((item) => (
                  <li key={`conflict:${item}`}>
                    {conflictTitle}: {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {box.show_personal_pattern ? (
            <div>
              <div className="pchat__understanding-box__label">{insightTitle}</div>
              <div className="pchat__understanding-box__hint">{insightNature}</div>
              <ul>
                {box.personal_pattern_insights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {box.current_question ? (
            <div>
              <div className="pchat__understanding-box__label">{qTitle}</div>
              <div className="pchat__understanding-box__text">{box.current_question}</div>
            </div>
          ) : null}
          {confirmHint ? <div className="pchat__understanding-box__hint">{confirmHint}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
