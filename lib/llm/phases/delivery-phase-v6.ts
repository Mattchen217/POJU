/**
 * POJU v6 Shadow — delivered 阶段（交付后简短对话 · taskBlock 注入 user 侧）。
 *
 * 主交付四段正文由 `final-delivery` 模块生成；本阶段只做短承接。
 * 【不】再塞整份深度解读法/行动设计/打标契约——那些是八页交付层的事；软译交 autoMark。
 *
 * ⚠️ 影子实现，不替换 delivery-phase.ts。
 */

import type { AgentPhase } from "@/lib/poju/agent-state";
import {
  callPhaseJsonTransport,
  parsePhaseResult,
  withPhaseStreamOpts,
} from "@/lib/llm/phases/phase-transport";
import { buildPhaseTransportInputV6 } from "@/lib/llm/phases/oriental-prompt-context-v6";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

/** delivered 阶段 · 本轮 active 任务（交付后简短对话） */
export const POJU_V6_POST_DELIVERY_CHAT_RULES = `# 当前阶段任务 · delivered（交付后简短对话）

## 前提
完整破局交付已显示在界面上方卡片中。你不要重复长文分析或三条行动全文。

## 本轮你必须做
- 80–160 字（中文）/ 60–120 词（英文）自然承接——幕后可深度权衡，但 visible 必须克制精准
- 邀请用户选一个行动开始，或追问哪一点还不清楚
- 可简短用命理视角回应追问，但不要重新做完整推演、不要重出八页结构
- 顾问语言（方案/推演/看局）；禁止方子/诊脉/调方/病灶
- 结尾用开放回访（随时回来 / Session 仍有效），禁止「三个月后再来」「复诊」
- 【不做 ⟦t:…⟧ 打标】；软译交后端 autoMark
- \`suggested_phase\`: "tracking"（默认）或 "delivered"

## 口径对齐（摘要 · 勿展开成全文契约）
- 已交付卡片是事实源：追问时局部引用即可，禁止整篇重述 ANALYSIS/CONCLUSION/WHAT TO DO/COMING BACK
- 行动建议保持具体、可立刻做；不新开另一套完整破局方案

## 输出 JSON
{ "response": "...", "suggested_phase": "tracking" | "delivered" | null, "context_updates": {} }`;

/** @deprecated 短聊不再注入全文交付契约；保留函数名以免外部引用断裂。 */
export function buildMainDeliveryContractBlockV6(): string {
  return `# 主交付口径（摘要）
完整四段报告由 final-delivery 生成。本阶段只短聊承接；勿重述全文、勿再教打标/双层/金字纪律。`;
}

/** v6 delivered 动态 taskBlock */
export function buildDeliveryTaskBlockV6(input: PhaseLLMInput): string {
  const q = input.session.original_question;
  return stitchPromptSections(
    `# 动态任务 · delivered`,
    `original_question："${q}"`,
    POJU_V6_POST_DELIVERY_CHAT_RULES,
  );
}

/** v6 delivered LLM 入口（影子路径） */
export async function callDeliveryPhaseV6(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const { system, messages } = await buildPhaseTransportInputV6(
    input,
    buildDeliveryTaskBlockV6(input),
  );

  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "chat_flash",
      phase_name: "delivery",
      max_tokens: 6000,
      temperature: 0.4,
      thinking_effort: "high",
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase: AgentPhase | null =
    rawPhase === "tracking" || rawPhase === "delivered" ? rawPhase : "tracking";

  return {
    response,
    suggested_phase,
    context_updates: {},
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    llm_debug: result.llm_debug,
  };
}
