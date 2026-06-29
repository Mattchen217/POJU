import type { POJUAgentState } from "@/lib/poju/agent-state";
import { selectCurrentAgendaFocus } from "@/lib/poju/investigation-agenda";

/** Reply already ends with or recently contains a question mark. */
export function hasQuestionCue(text: string): boolean {
  const trimmed = text.trim();
  if (/[？?]\s*$/.test(trimmed)) return true;
  return /[？?]/.test(trimmed.slice(-60));
}

/** Append first agenda focus when opening→collecting transition reply has no question. */
export function appendFirstFocusQuestion(
  reply: string,
  agent: POJUAgentState,
  locale: string,
): string {
  if (hasQuestionCue(reply)) return reply;

  const focus = selectCurrentAgendaFocus(agent.investigation_agenda ?? []);
  if (!focus?.label?.trim()) return reply;

  const q = focus.label.trim();
  const lead = locale.startsWith("zh")
    ? "\n\n我想先从一件事开始弄清楚——"
    : "\n\nLet's start with one thing—";
  const question = /[？?]$/.test(q) ? q : locale.startsWith("zh") ? `${q}？` : `${q}?`;
  return `${reply.trimEnd()}${lead}${question}`;
}
