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
      const opts = Array.isArray(m.options) ? m.options : [];
      return opts.some((o) => typeof o === "string" && o.trim() === trimmed);
    }
    i -= 1;
  }
  return false;
}

/**
 * 四道闸：点选强制 satisfied；terminal 需 stage≥3；action 配对；reply_quality 镜像。
 * 可选 focusLabel：点选时注入 completed_in_this_turn，保证放行路径能 cover。
 */
export function clampQuestionSignals<T extends QuestionSignalSlice>(
  signals: T,
  aqs: ActiveQuestionState | null | undefined,
  userPickedOption: boolean,
  focusLabel?: string | null,
): T {
  let qs: QuestionStatus =
    signals.question_status ??
    (signals.reply_quality === "vague"
      ? "retry"
      : signals.reply_quality === "clear"
        ? "satisfied"
        : "satisfied");
  let action: SessionAction | null = signals.session_action ?? null;
  const stage = aqs?.escalation_stage ?? 0;

  // 闸1:点选 → 强制 satisfied
  if (userPickedOption) {
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

  let agenda_updates = signals.agenda_updates;
  if (userPickedOption && focusLabel?.trim()) {
    agenda_updates = { completed_in_this_turn: [focusLabel.trim()] };
  }

  return {
    ...signals,
    question_status: qs,
    session_action: action,
    reply_quality,
    ...(agenda_updates !== undefined ? { agenda_updates } : {}),
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
