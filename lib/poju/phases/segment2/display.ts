/**
 * Segment 2 (analysis + directions + agenda) — user-visible reply assembly.
 * Call A → dialogue `response` (not action-frame report cards).
 * Call B → first_question (+ options in UI). Does not import opening or other phase modules.
 */
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { detectClosedGlossaryTerms } from "@/lib/glossary/term-glossary";
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
 * Legacy fallback when older cores lack model-written first_question.
 * Prefer model first_question — do not surface raw agenda labels as the primary path.
 */
function formatLegacyFocusQuestion(agent: POJUAgentState, locale: string): string | null {
  const focus = selectCurrentAgendaFocus(agent.investigation_agenda ?? []);
  if (!focus?.label?.trim()) return null;
  return formatFocusQuestionAsClearQuestion(focus.label, locale);
}

/**
 * @deprecated Prefer buildSegment2AnalysisReply (template includes first_question).
 * Kept for callers/tests that append a question onto an existing body.
 */
export function appendModelFirstQuestion(
  reply: string,
  firstQuestion: string | null | undefined,
  locale: string,
  agent?: POJUAgentState,
): string {
  if (isPojuFailurePlaceholderMessage(reply)) return reply;
  const fq = firstQuestion?.trim() ?? "";
  if (!fq) {
    if (!agent) return reply;
    const legacy = formatLegacyFocusQuestion(agent, locale);
    if (!legacy) return reply;
    const lead = locale.startsWith("zh")
      ? "\n\n接下来，我想和你一起把几件事弄清楚，才能给你落地的走法。我们先从最关键的一件开始——"
      : "\n\nNext, I want us to clarify a few things together so the advice can land. Let's start with the most important one—";
    const base = hasQuestionCue(reply)
      ? reply.trimEnd().replace(/[？?]\s*$/, "").trimEnd()
      : reply.trimEnd();
    return `${base}${lead}${legacy}`;
  }
  const base = hasQuestionCue(reply)
    ? reply.trimEnd().replace(/[？?]\s*$/, "").trimEnd()
    : reply.trimEnd();
  if (base.includes(fq)) return base;
  return `${base}\n\n${fq}`;
}

/**
 * Segment 2 user-visible body = Call A dialogue `response` only.
 * 只用 response（模型专门写的合规白话）。【绝不回落 situation_conclusion】——
 * 那是内部脊柱字段、满是裸命理词，甩给用户 = 合规灾难。
 * response 若为空 → 返回空串，由上层 buildSegment2AnalysisReply 用安全占位/触发重生成。
 */
export function formatSegment2ReplyForUser(
  core: BreakthroughCore | null | undefined,
  _locale: string,
): string {
  const resp = core?.response?.trim();
  if (resp) {
    // 后端防线:response 本应纯白话。若检出闭集命理词(模型漏改/软译不干净),响亮告警——
    // 便于监控泄漏率、迭代提示词;命中项也可据此决定是否拦截/回退。
    const leaked = detectClosedGlossaryTerms(resp);
    if (leaked.length > 0) {
      console.warn("[poju-compliance] response 含未打标命理词(应纯白话)", {
        terms: leaked,
        preview: resp.slice(0, 40),
      });
    }
  }
  return resp || "";
}

/**
 * @deprecated Segment 2 no longer renders modern_action_frames as "破局方向N" cards.
 * Frames stay on breakthrough_core for stage 4. Prefer formatSegment2ReplyForUser.
 */
export function formatBreakthroughDirectionsForUser(
  core: BreakthroughCore | null | undefined,
  locale: string,
): string {
  return formatSegment2ReplyForUser(core, locale);
}

/**
 * Full segment-2 user reply — Call A dialogue; optionally append Call B first_question
 * when used in a combined path. A/B split uses includeFirstQuestion: false for Call A.
 */
export function buildSegment2AnalysisReply(
  agent: POJUAgentState,
  locale: string,
  opts?: { includeFirstQuestion?: boolean },
): string {
  const core = agent.breakthrough_core;
  const zh = locale.startsWith("zh");
  const includeFirstQuestion = opts?.includeFirstQuestion !== false;

  const dialogue =
    formatSegment2ReplyForUser(core, locale) ||
    (zh
      ? "我先帮你把这件事在结构里的卡点理顺。"
      : "Let me frame where you're structurally stuck first.");

  if (!includeFirstQuestion) return dialogue;

  const firstQuestion = core?.first_question?.trim() ?? "";
  if (firstQuestion && !isPojuFailurePlaceholderMessage(firstQuestion)) {
    if (dialogue.includes(firstQuestion)) return dialogue;
    return `${dialogue}\n\n${firstQuestion}`;
  }

  const legacy = formatLegacyFocusQuestion(agent, locale);
  if (legacy) {
    const lead = zh
      ? "接下来，我想和你一起把几件事弄清楚，才能给你落地的走法。我们先从最关键的一件开始——"
      : "Next, I want us to clarify a few things together so the advice can land. Let's start with the most important one—";
    return `${dialogue}\n\n${lead}${legacy}`;
  }

  return dialogue;
}

/** @deprecated Prefer buildSegment2AnalysisReply — kept as alias for call sites. */
export function buildCollectingTransitionReplyFromCore(
  agent: POJUAgentState,
  locale: string,
): string {
  return buildSegment2AnalysisReply(agent, locale);
}

/** Segment 2 failed — understanding preserved; user retries via button. */
export function segment2CoreGenerationFailedMessage(
  locale: string,
  reason?: string,
): string {
  if (reason === "llm_timeout") {
    return locale.startsWith("zh")
      ? "这次分析用时过长，点下方按钮重试。"
      : "This analysis took too long. Tap the button below to retry.";
  }
  return locale.startsWith("zh")
    ? "深度分析这次没能生成完（可能是分析太复杂），点下方按钮我重新为你分析。"
    : "Deep analysis didn't finish this time (it may have been too complex). Tap the button below and I'll run it again.";
}

export function segment2RegenerateButtonLabel(locale: string): string {
  return locale.startsWith("zh") ? "重新生成分析" : "Regenerate analysis";
}

export function segment2RegenerateQuestionButtonLabel(locale: string): string {
  return locale.startsWith("zh") ? "重新生成提问" : "Regenerate question";
}

export function segment2AgendaBridgeFailedMessage(locale: string): string {
  return locale.startsWith("zh")
    ? "复盘已经好了。接下来的提问还没生成完——点下方按钮我再试一次，不影响上面那段对话。"
    : "Your read is ready. The follow-up question didn't finish — tap below to regenerate it (your dialogue stays).";
}

/** 汇总段 failed — multi_dim 保留;用户可重试。 */
export function synthesisGenerationFailedMessage(locale: string, reason?: string): string {
  if (reason === "llm_timeout" || reason === "poll_timeout") {
    return locale.startsWith("zh")
      ? "方案汇总用时过长，点下方按钮重试。"
      : "Plan synthesis took too long. Tap the button below to retry.";
  }
  return locale.startsWith("zh")
    ? "方案汇总遇到点问题，请稍后重试。"
    : "Plan synthesis hit a snag. Please try again in a moment.";
}

export function segment2AgendaPreparingHint(locale: string): string {
  return locale.startsWith("zh")
    ? "正在整理接下来要聊的重点…"
    : "Preparing what to explore next…";
}

/** Composer unlock hard ceiling: Call A ≤270s + Call B ≤150s + slack. */
export const SEGMENT2_INPUT_LOCK_HARD_MS = 420_000;

/**
 * TEMP test hook — show 「重新生成」under successful segment-2 delivery bubbles.
 * Set to `false` (or delete the UI branch) when QA is done.
 */
export const SHOW_SEGMENT2_TEST_REGENERATE = true;

export function envelopeCoreFallbackRetryHint(locale: string): string {
  return locale.startsWith("zh")
    ? "我在整理与你问题相关的调查角度时遇到一点异常，请再发一句让我继续。"
    : "I hit a snag while framing investigation angles for your question — please send another message.";
}
