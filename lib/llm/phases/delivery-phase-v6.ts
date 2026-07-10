/**
 * POJU v6 Shadow — delivered 阶段（交付后对话 + 主交付结构契约 · taskBlock 注入 user 侧）。
 *
 * 主交付四段正文由 `final-delivery` 模块生成；本阶段默认承接已显示在 UI 的交付卡片。
 * taskBlock 完整保留深度解读法与行动设计契约，供口径对齐；本轮 active 任务仍是简短承接。
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
import {
  POJU_ACTION_DESIGN_PRINCIPLES,
  POJU_BAZI_DEEP_METHOD,
} from "@/lib/llm/prompts/poju-base";
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
- 可简短用命理视角回应追问，但不要重新做完整推演
- 顾问语言（方案/推演/看局）；禁止方子/诊脉/调方/病灶
- 结尾用开放回访（随时回来 / Session 仍有效），禁止「三个月后再来」「复诊」
- \`suggested_phase\`: "tracking"（默认）或 "delivered"

## 输出 JSON
{ "response": "...", "suggested_phase": "tracking" | "delivered" | null, "context_updates": {} }`;

/**
 * 主交付结构契约 —  verbatim 自 v5 poju-base（深度解读法 + 行动设计）。
 * 供与已交付内容口径对齐；**本轮默认不输出四段全文**（见上方 active 任务）。
 */
export function buildMainDeliveryContractBlockV6(): string {
  return stitchPromptSections(
    `# 主交付结构契约（口径对齐 · 默认不在本轮 chat 输出全文）

完整四段破局报告由 \`final-delivery\` 模块调度生成。以下契约确保你与已交付卡片口径一致；
若用户追问某段逻辑，可局部引用，但勿整篇重述。

${POJU_BAZI_DEEP_METHOD}

${POJU_ACTION_DESIGN_PRINCIPLES}`,
  );
}

/** v6 delivered 动态 taskBlock */
export function buildDeliveryTaskBlockV6(input: PhaseLLMInput): string {
  const q = input.session.original_question;
  return stitchPromptSections(
    `# 动态任务 · delivered`,
    `original_question："${q}"`,
    POJU_V6_POST_DELIVERY_CHAT_RULES,
    buildMainDeliveryContractBlockV6(),
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
