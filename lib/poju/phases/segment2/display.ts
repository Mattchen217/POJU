/**
 * Segment 2 (analysis + directions + agenda) — user-visible reply assembly.
 * Layout = fixed code template (RichReadingText markdown); content = model fields only.
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

/** Strip model-added numbering / section prefixes so the fixed template doesn't double up. */
function stripContentChrome(text: string, kind: "direction" | "basis" | "timing"): string {
  let t = text.trim();
  if (!t) return t;
  if (kind === "direction") {
    t = t.replace(
      /^(?:破局方向\s*[一二三123]|方向\s*[一二三123]|[123][\.、．)）]|Direction\s*[123])\s*[·•:\-—]?\s*/iu,
      "",
    );
  }
  if (kind === "basis") {
    t = t.replace(/^(?:结构依据|依据|为什么是这条路|Basis|Why this path)\s*[:：]\s*/iu, "");
  }
  if (kind === "timing") {
    t = t.replace(/^(?:时机|现在该怎么走|Timing|What to do now)\s*[:：]\s*/iu, "");
  }
  t = t.replace(/^#+\s+/, "").replace(/^\*\*?/, "").replace(/\*\*$/, "");
  return t.trim();
}

const ZH_DIRECTION_ORDINAL = ["一", "二", "三"] as const;

/**
 * Fixed-template directions: each path is its own ### h3 + two lead blocks.
 * Uses RichReadingText-native syntax (### / **label:**) — never space-indented plain text.
 */
export function formatBreakthroughDirectionsForUser(
  core: BreakthroughCore | null | undefined,
  locale: string,
): string {
  const dirs = core?.breakthrough_directions ?? [];
  if (dirs.length === 0) return "";

  const zh = locale.startsWith("zh");
  const blocks: string[] = [];

  dirs.forEach((d, i) => {
    const direction = stripContentChrome(d.direction ?? "", "direction");
    if (!direction) return;
    const basis = stripContentChrome(d.structural_basis ?? "", "basis");
    const timing = stripContentChrome(d.timing ?? "", "timing");

    if (zh) {
      const n = ZH_DIRECTION_ORDINAL[i] ?? String(i + 1);
      blocks.push(`### 破局方向${n} · ${direction}`);
      if (basis) blocks.push(`**为什么是这条路:** ${basis}`);
      if (timing) blocks.push(`**现在该怎么走:** ${timing}`);
    } else {
      blocks.push(`### Direction ${i + 1} · ${direction}`);
      if (basis) blocks.push(`**Why this path:** ${basis}`);
      if (timing) blocks.push(`**What to do now:** ${timing}`);
    }
  });

  return blocks.join("\n\n");
}

/**
 * Full segment-2 user reply — layout from fixed template, content from model fields.
 * what_would_confirm + agenda list stay off the body (agenda panel / engine only).
 */
export function buildSegment2AnalysisReply(
  agent: POJUAgentState,
  locale: string,
  opts?: { includeFirstQuestion?: boolean },
): string {
  const core = agent.breakthrough_core;
  const zh = locale.startsWith("zh");
  const blocks: string[] = [];
  const includeFirstQuestion = opts?.includeFirstQuestion !== false;

  const rel =
    core?.relationship_conclusion?.trim() ||
    (zh
      ? "我先帮你把这件事在结构里的卡点理顺。"
      : "Let me frame where you're structurally stuck first.");

  blocks.push(zh ? "### 你为什么卡在这里" : "### Why you're stuck here");
  blocks.push(rel);

  const directions = formatBreakthroughDirectionsForUser(core, locale);
  if (directions) blocks.push(directions);

  if (includeFirstQuestion) {
    const firstQuestion = core?.first_question?.trim() ?? "";
    if (firstQuestion && !isPojuFailurePlaceholderMessage(firstQuestion)) {
      blocks.push(firstQuestion);
    } else {
      const legacy = formatLegacyFocusQuestion(agent, locale);
      if (legacy) {
        const lead = zh
          ? "接下来，我想和你一起把几件事弄清楚，才能给你落地的走法。我们先从最关键的一件开始——"
          : "Next, I want us to clarify a few things together so the advice can land. Let's start with the most important one—";
        blocks.push(`${lead}${legacy}`);
      }
    }
  }

  return blocks.join("\n\n");
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
    ? "分析报告已经好了。接下来的提问还没生成完——点下方按钮我再试一次，不影响上面这份分析。"
    : "Your analysis is ready. The follow-up question didn't finish — tap below to regenerate it (your report stays).";
}

export function segment2AgendaPreparingHint(locale: string): string {
  return locale.startsWith("zh")
    ? "正在整理接下来要聊的重点…"
    : "Preparing what to explore next…";
}

/** Composer unlock hard ceiling: Call A ≤270s + Call B ≤90s + slack. */
export const SEGMENT2_INPUT_LOCK_HARD_MS = 360_000;

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
