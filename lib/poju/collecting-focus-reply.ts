import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { isPojuFailurePlaceholderMessage } from "@/lib/llm/poju-service-busy-message";
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

/** User-visible breakthrough directions block (segment 2 · 2–3 items). */
export function formatBreakthroughDirectionsForUser(
  core: BreakthroughCore | null | undefined,
  locale: string,
): string {
  const dirs = core?.breakthrough_directions ?? [];
  if (dirs.length === 0) return "";
  const header = locale.startsWith("zh") ? "\n\n破局方向：" : "\n\nBreakthrough directions:";
  const lines = dirs.map((d, i) => {
    const n = i + 1;
    const basis = d.structural_basis?.trim() ?? "";
    const timing = d.timing?.trim() ?? "";
    if (locale.startsWith("zh")) {
      const parts = [`\n${n}. ${d.direction.trim()}`];
      if (basis) parts.push(`   结构依据：${basis}`);
      if (timing) parts.push(`   时机：${timing}`);
      return parts.join("\n");
    }
    const parts = [`\n${n}. ${d.direction.trim()}`];
    if (basis) parts.push(`   Basis: ${basis}`);
    if (timing) parts.push(`   Timing: ${timing}`);
    return parts.join("\n");
  });
  return header + lines.join("");
}

/** User-facing collecting transition when core fallback replaces a failed opening envelope. */
export function buildCollectingTransitionReplyFromCore(
  agent: POJUAgentState,
  locale: string,
): string {
  const core = agent.breakthrough_core;
  const rel = core?.relationship_conclusion?.trim() ?? "";
  const directions = formatBreakthroughDirectionsForUser(core, locale);
  const intro =
    rel ||
    (locale.startsWith("zh")
      ? "我先帮你把这件事在本盘结构里的卡点理顺。"
      : "Let me frame where you're structurally stuck first.");
  return appendFirstFocusQuestion(`${intro}${directions}`, agent, locale);
}

export function envelopeCoreFallbackRetryHint(locale: string): string {
  return locale.startsWith("zh")
    ? "我在整理与你问题相关的调查角度时遇到一点异常，请再发一句让我继续。"
    : "I hit a snag while framing investigation angles for your question — please send another message.";
}

/** Segment 1 opening — transport resends exhausted; user retries via button. */
export function openingUnderstandingGenerationFailedMessage(locale: string): string {
  return locale.startsWith("zh")
    ? "网络不太稳，我这次没能把理解整理好。点下方按钮重试。"
    : "The connection was unstable and I couldn't finish understanding this turn. Tap the button below to retry.";
}

export function openingUnderstandingRetryButtonLabel(locale: string): string {
  return locale.startsWith("zh") ? "点击重试" : "Retry";
}

/** Segment 2 failed — understanding preserved; user retries via button. */
export function segment2CoreGenerationFailedMessage(locale: string): string {
  return locale.startsWith("zh")
    ? "深度分析这次没能生成完（可能是分析太复杂），点下方按钮我重新为你分析。"
    : "Deep analysis didn't finish this time (it may have been too complex). Tap the button below and I'll run it again.";
}

export function segment2RegenerateButtonLabel(locale: string): string {
  return locale.startsWith("zh") ? "重新生成分析" : "Regenerate analysis";
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
  if (isPojuFailurePlaceholderMessage(reply)) return reply;
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

  return reply;
}
