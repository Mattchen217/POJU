/**
 * @deprecated 单问题小状态机 ②-b 起：话术由模型按 stage 出，物理动作由 session_action 触发。
 * 本文件固定文案不再被主流程调用；保留常量/函数供旧测试与兼容导入。
 * 新代码请用 `@/lib/poju/question-status`（TERMINATE_REFUND_WIPE_MS / clampQuestionSignals）。
 */

import { TERMINATE_REFUND_WIPE_MS } from "@/lib/poju/question-status";

export const UNQUALIFIED_ESCALATION_MAX = 4;
/** @deprecated 使用 TERMINATE_REFUND_WIPE_MS (30s)。 */
export const UNQUALIFIED_WIPE_AFTER_MS = TERMINATE_REFUND_WIPE_MS;
export const UNQUALIFIED_REFUND_EMAIL = "support@easternos.com";

export type UnqualifiedEscalationLevel = 1 | 2 | 3 | 4;

export interface UnqualifiedEscalationResult {
  level: UnqualifiedEscalationLevel;
  content: string;
  lock: boolean;
  wipeAfterMs: number | null;
  suggestRefund: boolean;
}

function isZhLocale(locale: string | null | undefined): boolean {
  const l = (locale ?? "en").toLowerCase();
  return l === "zh" || l.startsWith("zh-");
}

/** Clamp streak to 1–4 for template lookup. */
export function clampUnqualifiedLevel(streak: number): UnqualifiedEscalationLevel {
  if (streak <= 1) return 1;
  if (streak === 2) return 2;
  if (streak === 3) return 3;
  return 4;
}

export function formatUnqualifiedEscalationCopy(input: {
  level: UnqualifiedEscalationLevel;
  sessionId: string;
  locale?: string | null;
}): string {
  const zh = isZhLocale(input.locale);
  const id = input.sessionId.trim() || "(unknown)";

  if (input.level === 1) {
    return zh
      ? "我没太理解你刚才的回复。请就刚才那一问再认真说一次，好吗？"
      : "I didn’t quite catch your last reply. Could you answer that question again, a little more clearly?";
  }
  if (input.level === 2) {
    return zh
      ? "Eastern OS 是一份需要认真对待的工作。你的回复会直接影响最终交付报告的质量——请就刚才那一点再回复一次。"
      : "Eastern OS takes this work seriously. Your replies shape the quality of the final report — please answer that last point again.";
  }
  if (input.level === 3) {
    return zh
      ? "Eastern OS 是一份需要认真对待的工作，你的回复对最终交付报告至关重要。如果此刻不方便，可以稍后再来——我会一直在这里等你。"
      : "Eastern OS takes this work seriously, and your replies matter for the final report. If now isn’t a good time, come back when you can — I’ll be here.";
  }
  return zh
    ? `Eastern OS 是一份需要认真对待的工作。鉴于目前无法继续有效对话，请将本次会话编号 ${id} 发送至 ${UNQUALIFIED_REFUND_EMAIL}。Eastern OS 将在 7 个工作日内退回你的 PASS。此页面将在 5 分钟后关闭，输入已锁定。谢谢理解。`
    : `Eastern OS takes this work seriously. Since we can’t continue a useful conversation right now, please email this session ID (${id}) to ${UNQUALIFIED_REFUND_EMAIL}. Eastern OS will return your PASS within 7 business days. This page will close in 5 minutes, and input is locked. Thank you for understanding.`;
}

export function resolveUnqualifiedEscalation(input: {
  streak: number;
  sessionId: string;
  locale?: string | null;
}): UnqualifiedEscalationResult | null {
  if (input.streak < 1) return null;
  const level = clampUnqualifiedLevel(input.streak);
  const lock = level >= 4;
  return {
    level,
    content: formatUnqualifiedEscalationCopy({
      level,
      sessionId: input.sessionId,
      locale: input.locale,
    }),
    lock,
    wipeAfterMs: lock ? UNQUALIFIED_WIPE_AFTER_MS : null,
    suggestRefund: lock,
  };
}

/** Read current streak after state-machine update (opening or collecting focus). */
export function readUnqualifiedStreak(agent: {
  current_phase?: string | null;
  opening_unqualified_streak?: number | null;
  investigation_agenda?: Array<{ unqualified_streak?: number; status?: string }> | null;
}): number {
  const phase = agent.current_phase ?? "";
  if (phase === "opening") {
    return Math.max(0, agent.opening_unqualified_streak ?? 0);
  }
  if (phase === "collecting_context") {
    const agenda = agent.investigation_agenda ?? [];
    let max = 0;
    for (const item of agenda) {
      if (item.status === "covered") continue;
      const s = item.unqualified_streak ?? 0;
      if (s > max) max = s;
    }
    return max;
  }
  return 0;
}
