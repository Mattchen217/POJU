import type { POJUAgentState } from "@/lib/poju/agent-state";
import { selectCurrentAgendaFocus } from "@/lib/poju/investigation-agenda";

/** Reply already ends with or recently contains a question mark. */
export function hasQuestionCue(text: string): boolean {
  const trimmed = text.trim();
  if (/[？?]\s*$/.test(trimmed)) return true;
  return /[？?]/.test(trimmed.slice(-60));
}

function formatFocusQuestion(label: string, locale: string): string {
  const q = label.trim();
  if (/[？?]$/.test(q)) return q;
  return locale.startsWith("zh") ? `${q}？` : `${q}?`;
}

/** Append first agenda focus when opening→collecting transition reply has no question. */
export function appendFirstFocusQuestion(
  reply: string,
  agent: POJUAgentState,
  locale: string,
): string {
  return appendForwardMove(reply, agent, locale, "first");
}

/** Ensure reply ends with a forward question or clear next step — never a half insight. */
export function appendForwardMove(
  reply: string,
  agent: POJUAgentState,
  locale: string,
  mode: "first" | "continue" = "continue",
): string {
  if (hasQuestionCue(reply)) return reply;

  const focus = selectCurrentAgendaFocus(agent.investigation_agenda ?? []);
  if (focus?.label?.trim()) {
    const lead =
      mode === "first"
        ? locale.startsWith("zh")
          ? "\n\n我想先从一件事开始弄清楚——"
          : "\n\nLet's start with one thing—"
        : locale.startsWith("zh")
          ? "\n\n接下来想确认一件事——"
          : "\n\nNext I'd like to check one thing—";
    return `${reply.trimEnd()}${lead}${formatFocusQuestion(focus.label, locale)}`;
  }

  const lead = locale.startsWith("zh") ? "\n\n能再多说一点吗——" : "\n\nCould you tell me a bit more—";
  const fallback = locale.startsWith("zh")
    ? "你此刻最想解决的是哪一块？"
    : "what feels most urgent to you right now?";
  return `${reply.trimEnd()}${lead}${fallback}`;
}
