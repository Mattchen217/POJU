/**
 * Segment 2 (analysis + directions + agenda) — user-visible reply assembly.
 * Owns full relationship_conclusion + directions + agenda rendering.
 * Does not import opening or other phase modules.
 */
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { isPojuFailurePlaceholderMessage } from "@/lib/llm/poju-service-busy-message";
import { selectCurrentAgendaFocus } from "@/lib/poju/investigation-agenda";

/** Reply already ends with or recently contains a question mark. */
function hasQuestionCue(text: string): boolean {
  const trimmed = text.trim();
  if (/[？?]\s*$/.test(trimmed)) return true;
  return /[？?]/.test(trimmed.slice(-60));
}

/** Ensure the agenda focus is a clear, complete question ending with ？/?. */
export function formatFocusQuestionAsClearQuestion(label: string, locale: string): string {
  const q = label.trim().replace(/[？?]+$/g, "");
  if (!q) {
    return locale.startsWith("zh") ? "你现在最想先弄清哪一件事？" : "What do you want to clarify first?";
  }
  return locale.startsWith("zh") ? `${q}？` : `${q}?`;
}

/**
 * End the segment-2 analysis by clearly asking the first agenda question.
 * Always leave the user knowing exactly what to answer next.
 */
function appendFirstFocusQuestion(
  reply: string,
  agent: POJUAgentState,
  locale: string,
): string {
  if (isPojuFailurePlaceholderMessage(reply)) return reply;
  const focus = selectCurrentAgendaFocus(agent.investigation_agenda ?? []);
  if (!focus?.label?.trim()) return reply;

  const question = formatFocusQuestionAsClearQuestion(focus.label, locale);
  if (hasQuestionCue(reply) && reply.trimEnd().endsWith(question)) return reply;

  const lead = locale.startsWith("zh")
    ? "\n\n接下来，我想和你一起把几件事弄清楚，才能给你落地的走法。我们先从最关键的一件开始——"
    : "\n\nNext, I want us to clarify a few things together so the advice can land. Let's start with the most important one—";

  const base = hasQuestionCue(reply)
    ? reply.trimEnd().replace(/[？?]\s*$/, "").trimEnd()
    : reply.trimEnd();
  return `${base}${lead}${question}`;
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

/**
 * Full segment-2 user reply: relationship_conclusion + directions + first agenda focus.
 * Driven by async job completion — not by sync justConverted.
 */
export function buildSegment2AnalysisReply(
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

/** @deprecated Prefer buildSegment2AnalysisReply — kept as alias for call sites. */
export function buildCollectingTransitionReplyFromCore(
  agent: POJUAgentState,
  locale: string,
): string {
  return buildSegment2AnalysisReply(agent, locale);
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

export function envelopeCoreFallbackRetryHint(locale: string): string {
  return locale.startsWith("zh")
    ? "我在整理与你问题相关的调查角度时遇到一点异常，请再发一句让我继续。"
    : "I hit a snag while framing investigation angles for your question — please send another message.";
}
