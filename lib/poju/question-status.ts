/**
 * 单问题小状态机 · 机器钳制闸
 * 模型出 question_status / session_action；代码把关后才推进 stage / 触发物理动作。
 */

import type { ActiveQuestionState } from "@/lib/poju/agent-state";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

export type QuestionStatus = "satisfied" | "retry" | "escalate" | "terminal";
export type SessionAction = "terminate_refund" | "user_paused";

/** terminate_refund 后客户端关闭+清空倒计时（ms）。 */
export const TERMINATE_REFUND_WIPE_MS = 30_000;

/** 用户表明「这题答不了 / 前提不成立」——与 collecting 提示词第三类对齐。 */
const CANT_PROVIDE_ANSWER_RE =
  /答不了|给不了|给不出|不适用|还没到|不存在你问|没有这个|谈不上|暂时没有|目前没有|没法答|无法回答|还没上线|还在开发|说不上来|说不上|到不了这一步|现在还没有/;

export function looksLikeCantProvideAnswer(text: string): boolean {
  const t = text.trim();
  if (!t || t === "__OPENING__" || t.startsWith("[SYSTEM:")) return false;
  return CANT_PROVIDE_ANSWER_RE.test(t);
}

/** 同一项历史上已表明「答不了」的次数（不含本轮）。 */
export function countPriorCantProvideAnswers(
  aqs: ActiveQuestionState | null | undefined,
): number {
  const hist = aqs?.history_on_this_item ?? [];
  return hist.filter((h) => looksLikeCantProvideAnswer(h.replied)).length;
}

/**
 * 同一项第二次表明答不了 → 强制 satisfied（提示词硬止损的代码落地）。
 */
export function shouldForceSatisfiedAfterSecondCantProvide(
  aqs: ActiveQuestionState | null | undefined,
  userMessage: string,
): boolean {
  return looksLikeCantProvideAnswer(userMessage) && countPriorCantProvideAnswers(aqs) >= 1;
}

export function parseQuestionStatus(raw: unknown): QuestionStatus | undefined {
  if (
    raw === "satisfied" ||
    raw === "retry" ||
    raw === "escalate" ||
    raw === "terminal"
  ) {
    return raw;
  }
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase();
  if (t === "satisfied" || t === "clear" || t === "answered" || t === "ok") return "satisfied";
  if (t === "retry" || t === "vague" || t === "unclear") return "retry";
  if (t === "escalate" || t === "escalation") return "escalate";
  if (t === "terminal" || t === "terminate") return "terminal";
  return undefined;
}

export function parseSessionAction(raw: unknown): SessionAction | null | undefined {
  if (raw === null) return null;
  if (raw === "terminate_refund" || raw === "user_paused") return raw;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase();
  if (t === "terminate_refund" || t === "refund") return "terminate_refund";
  if (t === "user_paused" || t === "paused" || t === "pause") return "user_paused";
  if (t === "null" || t === "none" || t === "") return null;
  return undefined;
}

export type QuestionSignalSlice = {
  question_status?: QuestionStatus;
  session_action?: SessionAction | null;
  reply_quality?: "clear" | "vague";
  agenda_updates?: { completed_in_this_turn?: string[] };
};

/**
 * 用户本轮是否点了上一轮助手给出的 option（文本全等）。
 * options 可能已被 UI consume；同时看 meta.offered_options。
 */
export function userPickedProvidedOption(
  session: POJUSessionState,
  userMessage: string,
): boolean {
  const trimmed = userMessage.trim();
  if (!trimmed || trimmed === "__OPENING__" || trimmed.startsWith("[SYSTEM:")) return false;

  const msgs = session.messages;
  let i = msgs.length - 1;
  // Skip trailing user (current turn may already be appended).
  while (i >= 0 && msgs[i].role === "user") i -= 1;
  while (i >= 0) {
    const m = msgs[i] as POJUMessage;
    if (m.role === "assistant" && !m.is_rejected) {
      const fromOptions = Array.isArray(m.options)
        ? m.options.filter((o): o is string => typeof o === "string")
        : [];
      const fromMeta = Array.isArray(m.meta?.offered_options)
        ? m.meta.offered_options.filter((o): o is string => typeof o === "string")
        : [];
      const opts = fromOptions.length >= 2 ? fromOptions : fromMeta;
      return opts.some((o) => o.trim() === trimmed);
    }
    i -= 1;
  }
  return false;
}

export type ClampQuestionSignalsOpts = {
  userMessage?: string;
};

/**
 * 闸：点选 / 二次答不了 → satisfied；terminal 需 stage≥3；action 配对；
 * reply_quality 镜像；satisfied 注入 focus label；非 satisfied 清空 completed。
 */
export function clampQuestionSignals<T extends QuestionSignalSlice>(
  signals: T,
  aqs: ActiveQuestionState | null | undefined,
  userPickedOption: boolean,
  focusLabel?: string | null,
  opts?: ClampQuestionSignalsOpts,
): T & Required<Pick<QuestionSignalSlice, "question_status" | "reply_quality">> & {
  session_action: SessionAction | null;
  agenda_updates: { completed_in_this_turn: string[] };
} {
  let qs: QuestionStatus =
    signals.question_status ??
    (signals.reply_quality === "vague"
      ? "retry"
      : signals.reply_quality === "clear"
        ? "satisfied"
        : "satisfied");
  let action: SessionAction | null = signals.session_action ?? null;
  const stage = aqs?.escalation_stage ?? 0;
  const userMessage = opts?.userMessage ?? "";

  // 闸1:点选 → 强制 satisfied
  if (userPickedOption) {
    qs = "satisfied";
    action = null;
  }

  // 闸1b:同一项第二次「答不了」→ 强制 satisfied（提示词硬止损落地）
  if (shouldForceSatisfiedAfterSecondCantProvide(aqs, userMessage)) {
    qs = "satisfied";
    action = null;
  }

  // 闸2:terminal 仅当 stage≥3；提前喊 → escalate
  if (qs === "terminal" && stage < 3) {
    qs = "escalate";
    if (action === "terminate_refund") action = null;
  }

  // 闸3:terminate_refund 必须配 terminal
  if (action === "terminate_refund" && qs !== "terminal") action = null;

  const reply_quality: "clear" | "vague" = qs === "satisfied" ? "clear" : "vague";

  // 闸4:放行准绳对齐 —— satisfied 必带 focus label；非 satisfied 清空 completed
  const focus = focusLabel?.trim() ?? "";
  const agenda_updates =
    qs === "satisfied" && focus
      ? { completed_in_this_turn: [focus] }
      : qs !== "satisfied"
        ? { completed_in_this_turn: [] as string[] }
        : {
            completed_in_this_turn: [
              ...(signals.agenda_updates?.completed_in_this_turn ?? []),
            ],
          };

  return {
    ...signals,
    question_status: qs,
    session_action: action,
    reply_quality,
    agenda_updates,
  };
}

/** stage 逐级推进：每轮最多 +1；satisfied 归 0；terminal 维持 ≥3。 */
export function nextEscalationStage(
  prev: number,
  qs: QuestionStatus | undefined,
): number {
  const safePrev = Math.max(0, Math.min(4, Math.floor(prev) || 0));
  if (qs === "satisfied") return 0;
  if (qs === "terminal") return Math.max(safePrev, 3);
  // retry / escalate / missing
  return Math.min(safePrev + 1, 4);
}

/**
 * Collecting: if model ignored a chip/clear answer, prepend a short catch line.
 * Does not rewrite the whole reply — only ensures the pick is visibly acknowledged.
 */
export function ensureCollectingCatchPrefix(
  response: string,
  userMessage: string,
  opts?: { pickedOption?: boolean; locale?: string },
): string {
  const body = response.trim();
  const user = userMessage.trim();
  if (!body || !user || user === "__OPENING__" || user.startsWith("[SYSTEM:")) return response;

  const needle = user.slice(0, Math.min(12, user.length));
  if (needle.length >= 4 && body.includes(needle)) return response;

  // Only force when chip pick or short option-like answer (avoid prefixing every free text).
  if (!opts?.pickedOption && user.length > 80) return response;

  const zh = !opts?.locale || opts.locale.startsWith("zh");
  const clipped = user.length > 48 ? `${user.slice(0, 48)}…` : user;
  const prefix = zh
    ? `你刚才说的是「${clipped}」——记下了。`
    : `Got it — you said “${clipped}.”`;
  return `${prefix}\n\n${body}`;
}
