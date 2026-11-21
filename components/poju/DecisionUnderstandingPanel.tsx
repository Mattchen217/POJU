"use client";

import { useEffect, useRef, useState } from "react";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  projectDecisionUnderstandingBox,
  type DecisionUnderstandingBoxView,
} from "@/lib/poju/decision-intake/ui-projection";

/** Unified Decision Understanding box — Session SoT or a per-turn snapshot. */
export function DecisionUnderstandingPanel({
  session,
  locale,
  box: boxProp,
  defaultExpanded = false,
}: {
  session?: POJUSessionState | null;
  locale: string;
  /** Frozen per-turn projection; when set, session is not required. */
  box?: DecisionUnderstandingBoxView | null;
  defaultExpanded?: boolean;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const box =
    boxProp ??
    (session?.decision_understanding ? projectDecisionUnderstandingBox(session) : null);

  useEffect(() => {
    if (!expanded || !box) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target;
      if (target instanceof Node && root.contains(target)) return;
      setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [expanded, box]);

  if (!box) return null;

  const isZh = locale.toLowerCase().startsWith("zh");
  const title = isZh ? "\u51b3\u7b56\u7406\u89e3" : "DECISION UNDERSTANDING";
  const currentTitle = isZh ? "\u5f53\u524d\u7406\u89e3" : "Current understanding";
  const understoodTitle = isZh ? "\u5df2\u7ecf\u4e86\u89e3" : "Already understood";
  const needTitle = isZh ? "\u8fd8\u9700\u8981\u4e86\u89e3" : "Still need to understand";
  const insightTitle = isZh ? "\u4e2a\u4eba\u6a21\u5f0f\u6d1e\u5bdf" : "Personal Pattern Insight";
  const insightNature = isZh
    ? "\u4e3a\u4f20\u7edf\u89e3\u91ca\u6216\u5f85\u9a8c\u8bc1\u5047\u8bbe\uff0c\u4e0d\u662f\u5df2\u786e\u8ba4\u4e8b\u5b9e"
    : "Traditional interpretation or an unverified hypothesis, not a confirmed fact";
  const conflictTitle = isZh ? "\u5c1a\u5f85\u6f84\u6e05\u7684\u77db\u76fe" : "Open conflicts";
  const naMarker = isZh ? "\u5df2\u786e\u8ba4\u4e0d\u9002\u7528" : "Not applicable";
  const progressHint = isZh
    ? "\u4fe1\u606f\u51c6\u5907\u7a0b\u5ea6\uff08\u57fa\u4e8e\u8c03\u67e5\u5b8c\u6210\u6761\u4ef6\u4e0e\u4fe1\u606f\u7f3a\u53e3\uff0c\u4e0d\u662f\u63d0\u95ee\u6b21\u6570\uff09"
    : "Information readiness (completion conditions and remaining gaps, not question count)";
  const expandLabel = isZh ? "\u5c55\u5f00\u8be6\u60c5" : "Show details";
  const collapseLabel = isZh ? "\u6536\u8d77\u8be6\u60c5" : "Hide details";
  const layerHint = (() => {
    const layer = box.current_intake_layer;
    if (!layer) return null;
    if (isZh) {
      if (layer === "problem_understanding") return "\u5f53\u524d\u7126\u70b9\uff1a\u5148\u628a\u95ee\u9898\u5f04\u6e05\u695a";
      if (layer === "desired_outcome") return "\u5f53\u524d\u7126\u70b9\uff1a\u5f04\u6e05\u4f60\u671f\u671b\u7684\u7ed3\u679c";
      if (layer === "report_details") return "\u5f53\u524d\u7126\u70b9\uff1a\u6309\u62a5\u544a\u9700\u8981\u8865\u9f50\u5173\u952e\u7ec6\u8282";
      if (layer === "final_understanding_review") return "\u5f53\u524d\u7126\u70b9\uff1a\u786e\u8ba4\u7406\u89e3\u540e\u53ef\u8fdb\u5165\u4ea4\u4ed8";
      return null;
    }
    if (layer === "problem_understanding") return "Focus: clarify the real problem";
    if (layer === "desired_outcome") return "Focus: clarify desired outcomes";
    if (layer === "report_details") return "Focus: gather report-critical details";
    if (layer === "final_understanding_review") return "Focus: confirm understanding before delivery";
    return null;
  })();
  const confirmHint =
    session?.agent_v2?.current_phase === "awaiting_confirmation" &&
    session.decision_understanding?.readiness.can_ask === false
      ? isZh
        ? "\u82e5\u5f53\u524d\u7406\u89e3\u51c6\u786e\uff0c\u8bf7\u5728\u4e0b\u65b9\u8f93\u5165\u6846\u5185\u9009\u62e9\u786e\u8ba4\uff1b\u82e5\u6709\u9057\u6f0f\u6216\u9700\u8981\u8865\u5145\uff0c\u8bf7\u76f4\u63a5\u5728\u8f93\u5165\u6846\u91cc\u8bf4\u660e\u3002"
        : "If this understanding is accurate, choose confirm in the input box below. To point out a gap or add something, type it directly in the input box."
      : null;
  const percent = box.progress_percent;

  return (
    <section
      ref={rootRef}
      className="pchat__understanding-box"
      aria-label={title}
      data-expanded={expanded ? "true" : "false"}
    >
      <div className="pchat__understanding-box__summary">
        <div className="pchat__understanding-box__title">
          {title}
          {percent != null ? <span className="pchat__understanding-box__pct">{percent}%</span> : null}
        </div>
        {percent != null ? (
          <div className="pchat__understanding-box__meter">
            <div className="pchat__understanding-box__bar">
              <div
                className="pchat__understanding-box__bar-fill"
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
              />
            </div>
          </div>
        ) : null}
        {percent != null ? <div className="pchat__understanding-box__hint">{progressHint}</div> : null}
        {layerHint ? <div className="pchat__understanding-box__hint">{layerHint}</div> : null}
        <button
          type="button"
          className="pchat__understanding-box__details-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      </div>
      {expanded ? (
        <div className="pchat__understanding-box__body">
          <div>
            <div className="pchat__understanding-box__label">{currentTitle}</div>
            <div className="pchat__understanding-box__text">{box.current_understanding ?? "\u2014"}</div>
          </div>
          <div>
            <div className="pchat__understanding-box__label">{understoodTitle}</div>
            {box.already_understood.length > 0 ? (
              <ul>
                {box.already_understood.map((item) => (
                  <li key={`${item.status}:${item.label}`}>
                    {item.label}
                    {item.status === "n_a" ? (
                      <span className="pchat__understanding-box__hint"> {naMarker}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="pchat__understanding-box__text">{"\u2014"}</div>
            )}
          </div>
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
          {/* Current question lives in the chat bubble (model response), not duplicated here. */}
          {confirmHint ? <div className="pchat__understanding-box__hint">{confirmHint}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
