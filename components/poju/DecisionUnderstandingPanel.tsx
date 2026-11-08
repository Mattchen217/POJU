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
            <div>
              {isZh ? "个人模式洞察" : "Personal pattern"}: {ui.personal_pattern_status}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
