import { findMissingFields, type POJUAgentState } from "@/lib/poju/agent-state";
import { formatContextForPrompt, formatMissingFieldsForPrompt } from "@/lib/poju/context-extractor";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildOrientalSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

function formatFieldKey(key: string): string {
  return key.replace(/_/g, " ");
}

function topMissingLabels(agent: POJUAgentState, limit = 2): string[] {
  const missing = findMissingFields(agent);
  const keys = [...missing.general, ...missing.category_specific].slice(0, limit);
  return keys.map(formatFieldKey);
}

function buildStallOfferTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const contextText = agent ? formatContextForPrompt(agent) : "";
  const missingText = agent ? formatMissingFieldsForPrompt(findMissingFields(agent)) : "";
  const missingLabels = agent ? topMissingLabels(agent) : [];
  const missingHint =
    missingLabels.length > 0
      ? missingLabels.join("、")
      : "还有 1-2 个关键细节";

  return `# 当前任务：止损分支（状态 B · stall offer）

你已经尽力收集，但用户配合度不足或关键信息仍不够。本轮【不要再追问、不要给行动建议】。
给用户一个温和、明确的二选一，把触发权交给用户。

## 用户的原始问题
"${input.session.original_question}"

## 已收集的信息
${contextText}

${missingText}

## 你要做什么

1. response（中文 120-280 字 / 英文 90-200 词）：
   - 简短承接用户刚才的态度或情绪（1-2 句）
   - 温和说明：要给出最贴合的破局，还缺什么——列出 1-2 个关键项（优先：${missingHint}）
   - 给出明确二选一，并以【征询问句】结尾（问号收尾），让用户选：
     A) 愿意再聊几句补上这些
     B) 基于现在了解的 + 命盘，先给一个方向
   - 示例（中文）："要给你最贴合的破局，我还想了解 ${missingHint}。你愿意再聊两句补上这些，还是想让我基于现在了解的、加上你的命盘，先给你一个方向？"
   - 示例（英文）："To tailor this properly, I still need ${missingHint}. Would you rather share a bit more on those, or have me work from what we have plus your chart and give you a direction now?"

2. 严禁：
   - 继续硬追问、连珠炮式问题
   - 「稍等我去整理」类异步告知式措辞
   - 任何具体行动/Step/破局建议

## 输出格式（严格 JSON，无 markdown 围栏）

{
  "response": "...",
  "suggested_phase": "awaiting_confirmation",
  "stall_offer": true,
  "context_updates": {}
}`;
}

/** Stop-loss branch — explicit user choice instead of more interrogation. */
export async function callStallOfferPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = await buildOrientalSystemPrompt(input, buildStallOfferTaskBlock(input));
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 1600,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  return {
    response,
    suggested_phase: "awaiting_confirmation",
    context_updates:
      parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
        ? (parsed.context_updates as Record<string, unknown>)
        : {},
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    stall_offer: true,
  };
}
