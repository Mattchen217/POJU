import type { AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildOrientalSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

/**
 * Post-delivery chat only. Main structured delivery runs via runConfirmationPipeline / final-delivery.
 */
function buildDeliveryTaskBlock(input: PhaseLLMInput): string {
  return `# 当前任务：交付后简短对话

完整破局交付已显示在界面上方的卡片里。你不要重复长文分析或三条行动全文。

## 原始问题
"${input.session.original_question}"

## 你要做

- 40-80 字（中文）/ 30-60 词（英文）承接
- 邀请用户选一个行动开始，或追问哪一点还不清楚
- 可简短用命理视角回应追问，但不要重新做完整推演
- 遵守 POJU 术语（方案/推演，禁止方子/诊脉/调方/病灶）；结尾用模糊回访时间（随时回来 / 30 天 Session），禁止「三个月后再来」「复诊」
- suggested_phase: "tracking"（默认）或 "delivered"

## 输出 JSON

{ "response": "...", "suggested_phase": "tracking" | "delivered" | null, "context_updates": {} }`;
}

export async function callDeliveryPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = await buildOrientalSystemPrompt(input, buildDeliveryTaskBlock(input));
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "chat_flash",
      max_tokens: 800,
      temperature: 0.4,
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
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}
