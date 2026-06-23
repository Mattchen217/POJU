"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { POJUAgentState } from "@/lib/poju/agent-state";
import type { AgendaItemStatus } from "@/lib/poju/investigation-agenda";
import { formatAgendaProgressLabel } from "@/lib/poju/agenda-progress-label";

function agendaStatusLabel(status: AgendaItemStatus, isZh: boolean): string {
  if (status === "covered") return isZh ? "已弄清" : "Covered";
  if (status === "partial") return isZh ? "了解中" : "In progress";
  return isZh ? "未问" : "Not yet";
}

export function AgendaProgressPanel({
  agent,
  locale,
}: {
  agent: POJUAgentState | null | undefined;
  locale: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = formatAgendaProgressLabel(agent, locale);
  if (!summary || !agent) return null;

  const agenda = agent.investigation_agenda ?? [];
  if (agenda.length === 0) return null;

  const isZh = locale.startsWith("zh");
  const criticalLabel = isZh ? "必查" : "Key";

  return (
    <div className="px-1 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left hover:text-foreground"
        aria-expanded={expanded}
      >
        <span>{summary}</span>
        {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
      </button>
      {expanded ? (
        <ul className="mt-1 space-y-1 border-l border-border/60 pl-3">
          {agenda.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1">
                {item.critical ? (
                  <span className="mr-1 rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/80">
                    {criticalLabel}
                  </span>
                ) : null}
                {item.label}
              </span>
              <span className="shrink-0 text-[11px] opacity-80">
                {agendaStatusLabel(item.status, isZh)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
