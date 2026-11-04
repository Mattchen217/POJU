/**
 * Opening · Minimum Interaction Gate（独立于 understanding_sufficient）
 *
 * 信息充分性（三项核心）≠ 交互完成。本闸只约束：首轮用户输入后，
 * 至少再完成一次「系统回应 → 用户再回应」，才允许进入理解确认。
 * 不负责判断信息是否够用；也不把「多问一句」当成信息收集任务。
 */

import type { POJUMessage } from "@/lib/poju/types";

/** Minimum substantive user turns before understanding-confirm is allowed. */
export const OPENING_MIN_SUBSTANTIVE_TURNS = 2;

const OPENING_GREETING_PATTERN =
  /^(你好|您好|hi|hello|在吗|嗨|哈喽|你是谁|你能|你可以|测试)/i;

/** Count substantive user turns in opening from message history (deterministic gate input). */
export function countSubstantiveOpeningTurns(messages: POJUMessage[]): number {
  return messages.filter((m) => {
    if (m.role !== "user" || m.is_rejected) return false;
    const trimmed = m.content.trim();
    if (trimmed.length <= 6 || trimmed === "__OPENING__") return false;
    if (trimmed.startsWith("[SYSTEM:")) return false;
    return !OPENING_GREETING_PATTERN.test(trimmed);
  }).length;
}

/**
 * True iff opening has completed at least one valid
 * 「用户首轮 → 系统回应 → 用户再回应」cycle (counted as ≥2 substantive user turns).
 */
export function isMinimumInteractionGateMet(
  substantiveOpeningTurns: number | null | undefined,
): boolean {
  const turns =
    typeof substantiveOpeningTurns === "number" && Number.isFinite(substantiveOpeningTurns)
      ? Math.max(0, Math.floor(substantiveOpeningTurns))
      : 0;
  return turns >= OPENING_MIN_SUBSTANTIVE_TURNS;
}

/** Control-plane hint when the gate blocks early closure (prompt injection only). */
export function buildMinimumInteractionGateControlBlock(locale: string): string {
  const zh = !locale || locale.startsWith("zh");
  if (zh) {
    return [
      "【控制面指令 · minimum_interaction_gate · 独立于 understanding_sufficient】",
      "本会话尚未完成一次有效的「用户首轮输入 → 系统回应 → 用户再次回应」。",
      "即使三项核心信息（主问题单楔 / 情况实质 / 主期望方向）已齐全，也【禁止】本轮设 understanding_sufficient=true，不得进入理解确认总结。",
      "本轮行为：",
      "① 三项已齐 → 提出一个有实际价值的轻量校准问：优先验证关键矛盾、动机差异、尚未明确的决策条件，或用户未明说但对决策有影响的关键因素；options 给 2–3 个互斥合格答法。",
      "② 三项仍缺 → 只问缺失的那一项核心信息；禁止为凑轮次重复已知内容。",
      "③ 【禁止】空洞凑轮：「你能再详细介绍一下吗」「还有什么要补充的」等无信息增益问题；禁止强迫无关背景。",
      "用户主动跳过/拒绝补充/退出时，遵循既有 session_action 与信息不足规则，不得无限卡住。",
      "核心：信息充分 ≠ 交互完成；给用户一次参与校准系统理解的机会。",
    ].join("");
  }
  return [
    "[Control plane · minimum_interaction_gate · independent of understanding_sufficient] ",
    "This opening has not yet completed one valid cycle: user first turn → assistant reply → user reply again. ",
    "Even if the three core fields are already filled, do NOT set understanding_sufficient=true this turn; do not enter the understanding-confirm summary. ",
    "If the three cores are complete: ask one high-value light calibration question (key tension, motive difference, unclear decision condition, or an unspoken factor that affects the decision). ",
    "If a core is still missing: ask only for that missing core — never re-ask known content to pad turns. ",
    "Forbidden: empty padding questions (“tell me more about your situation”). Respect skip/refuse/exit rules.",
  ].join("");
}
