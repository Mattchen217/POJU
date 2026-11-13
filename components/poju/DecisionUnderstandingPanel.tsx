"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { POJUSessionState } from "@/lib/poju/types";
import { projectAdaptiveQuestionForUi } from "@/lib/poju/decision-intake/ui-projection";

/** M1 — core Understanding / Need / current Q panel. Reads Session SoT only. */
export function DecisionUnderstandingPanel({
  session,
  locale,
}: {
  session: POJUSessionState | null | undefined;
  locale: string;
}) {
  const [expanded, setExpanded] = useState(true);
  if (!session?.decision_understanding) return null;
  const ui = projectAdaptiveQuestionForUi(session);
  const isZh = locale.startsWith("zh");
  const title = isZh ? "当前理解" : "Current understanding";
  const needTitle = isZh ? "仍需弄清" : "Need to understand";
  const understoodTitle = isZh ? "已掌握" : "Understood";
  const qTitle = isZh ? "当前问题" : "Current question";
  const stateLabel: Record<string, string> = isZh
    ? { known: "已知", unknown: "未知", conflict: "有冲突", n_a: "不适用" }
    : { known: "Known", unknown: "Unknown", conflict: "Conflict", n_a: "Not applicable" };

  return (
    <div className="px-1 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left hover:text-foreground"
        aria-expanded={expanded}
      >
        <span className="truncate">
          {title}: {ui.understanding_summary ?? "—"}
        </span>
        {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
      </button>
      {expanded ? (
        <div className="mt-1 space-y-2 border-l border-border/60 pl-3">
          {ui.current_question ? (
            <div>
              <div className="font-medium text-foreground/80">{qTitle}</div>
              <div className="text-foreground">{ui.current_question}</div>
            </div>
          ) : null}
          {ui.understood_labels.length > 0 ? (
            <div>
              <div className="font-medium text-foreground/80">{understoodTitle}</div>
              <ul className="list-disc pl-4">
                {ui.understood_labels.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {ui.need_labels.length > 0 ? (
            <div>
              <div className="font-medium text-foreground/80">{needTitle}</div>
              <ul className="list-disc pl-4">
                {ui.need_labels.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {ui.personal_pattern_status && ui.personal_pattern_status !== "unavailable" ? (
            <div className="space-y-1">
              <div>{isZh ? "个人模式洞察" : "Personal pattern"}: {ui.personal_pattern_status}</div>
              {ui.personal_pattern_insights.map((insight) => <div key={insight.source} className="rounded bg-muted/40 p-2 text-foreground">
                {insight.text}<span className="ml-2 text-[10px] text-muted-foreground">{insight.source}</span>
              </div>)}
            </div>
          ) : null}
          {ui.investigation_directions.length > 0 ? <div><div className="font-medium text-foreground/80">{isZh ? "调查方向" : "Investigation directions"}</div><ul className="list-disc pl-4">{ui.investigation_directions.map((d) => <li key={d.direction_id}>{d.priority} · {d.label}</li>)}</ul></div> : null}
          {ui.dir_states.length > 0 ? <div><div className="font-medium text-foreground/80">{isZh ? "决策信息状态" : "Decision information state"}</div><ul className="list-disc pl-4">{ui.dir_states.map((d) => <li key={d.dir_id}>{stateLabel[d.state] ?? d.state} · {d.need}{d.may_affect_ranking ? (isZh ? " · 可能影响排序" : " · may affect ranking") : ""}</li>)}</ul></div> : null}
          {ui.open_conflicts.length > 0 ? <div><div className="font-medium text-foreground/80">{isZh ? "待澄清矛盾" : "Open conflicts"}</div><ul className="list-disc pl-4">{ui.open_conflicts.map((c) => <li key={c.conflict_id}>{c.field}: {c.statements.join(" ↔ ")}</li>)}</ul></div> : null}
          {ui.readiness_verdict ? <div><div className="font-medium text-foreground/80">{isZh ? "就绪判断" : "Readiness"}: {ui.readiness_verdict}</div><ul className="list-disc pl-4">{ui.readiness_reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></div> : null}
          {ui.budget_asked !== null && ui.budget_hard !== null ? <div>{isZh ? "已提问 / 上限 / 剩余" : "Questions / limit / remaining"}: {ui.budget_asked} / {ui.budget_hard} / {ui.budget_remaining ?? "—"}</div> : null}
          {ui.readiness_can_ask !== null ? <div>{isZh ? "是否允许继续提问" : "May ask another question"}: {ui.readiness_can_ask ? (isZh ? "是" : "Yes") : (isZh ? "否" : "No")}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
