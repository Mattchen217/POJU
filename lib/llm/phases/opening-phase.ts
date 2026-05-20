/**
 * Step I — AI 主动开场（东方破局顾问定位）
 */
import { normalizeAgentPhase, type AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult } from "@/lib/llm/phases/phase-transport";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildOrientalSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";

const VALID_SUGGESTED: AgentPhase[] = ["opening", "collecting_context"];

function buildOpeningTaskBlock(input: PhaseLLMInput): string {
  const q = input.session.original_question;
  return `# 当前任务：主动开场

用户刚刚完成八字录入，你已经看过他/她的完整命盘。
现在你需要【主动发出第一条消息】打开对话。

## 用户的原始问题
"${q}"

## 你的开场要做到

1. **简短自我介绍**（1 句话即可）
   ✗ 不要说「我是 POJU，你的 AI 思考伙伴…」（太套路）
   ✓ 可以说「我是 POJU。」或「听到你了。」

2. **表明你已经看过命盘**（让用户感受真实性）
   ✓ 「你的命盘我已经摆好了——日主、当前大运，这个结构我心里有数」

3. **承接用户的原始问题**（不要复述全文，但要表明你看到了）

4. **引出第一个深入问题**（具体、尖锐，像医生问诊）
   ✓ 例：「你说的『什么都赚不到钱』——是开了几个项目都没起来，还是有项目但变现卡住？」

## 风格

- 总字数 180-420 字（中文）/ 140-300 词（英文）
- 3-5 个自然段：命盘结构 1-2 段 + 承接问题 + 尖锐追问
- 必须引用命主基础分析中的至少 1 条具体结论（格局/大运/用神/亮点或隐忧），并白话解释
- 不要列要点清单；不要说「我能帮你」之类的空承诺

## 输出格式（严格 JSON，无 markdown 围栏）

{
  "response": "你的主动开场消息",
  "suggested_phase": null,
  "action_requested": "continue_chat",
  "context_updates": {}
}`;
}

export async function callOpeningPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = await buildOrientalSystemPrompt(input, buildOpeningTaskBlock(input));
  let messages = formatPhaseMessageHistory(input.session.messages);
  if (messages.length === 0) {
    messages = [{ role: "user", content: "__OPENING__" }];
  }

  const result = await callPhaseJsonTransport(system, messages, {
    call_type: "chat_flash",
    temperature: 0.55,
    max_tokens: 2800,
  });

  const { parsed, response } = parsePhaseResult(result.content);

  const suggestedRaw = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase : null;
  const suggested = suggestedRaw ? normalizeAgentPhase(suggestedRaw) : null;
  const suggested_phase =
    suggested && VALID_SUGGESTED.includes(suggested) ? suggested : null;

  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;
  const action_requested: PojuV4ActionRequested | null =
    rawAction === "continue_chat" || rawAction === "show_birth_form" ? rawAction : "continue_chat";

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  return {
    response,
    suggested_phase,
    action_requested,
    context_updates,
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: undefined,
  };
}
