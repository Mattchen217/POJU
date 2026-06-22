/**
 * Step I — AI 主动开场（东方破局顾问定位）
 */
import { normalizeAgentPhase, type AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";

const VALID_SUGGESTED: AgentPhase[] = ["opening", "collecting_context"];

function buildOpeningTaskBlock(input: PhaseLLMInput): string {
  const q = input.session.original_question;
  const deliveryHandoff = Boolean(input.tool_injection_context?.includes("交付页延续"));

  if (deliveryHandoff) {
    return `# 当前任务：交付页转入 · 主动开场

用户刚从工具交付页（Match / Glyph / Syncro）付费进入 POJU，并已看过完整交付内容。
系统注入块里已有合盘/卦象/时机等全部资料；下方「原始问题」是用户想深入的方向。

## 用户的原始问题
"${q}"

## 你的开场要做到

像一位已经读过全部资料的老师，**先给一个有洞见的回应**——点出 1–2 个最关键的结构或张力（勿复述全文），让用户感到你真正看懂了。再自然承接到 POJU 对话，邀请他多说一点或选一个想深入的焦点。

- **严禁**「我听到了/我明白了」式套路开场；**不要**固定「总结→承接→提问」三段骨架
- 可以给点拨，但**不要**在此给出完整行动方案或操作指令
- 若要问，最多 1 个从对话自然长出的问题，不要像问卷

## 风格

- 总字数 180–420 字（中文）/ 140–300 词（英文）；可引用命盘或工具结论中的至少 1 条具体细节
- 自然叙述、像人说话；不要列要点清单；不要说「我能帮你」之类的空承诺

## 输出格式（严格 JSON，无 markdown 围栏）

{
  "response": "你的主动开场消息",
  "suggested_phase": null,
  "action_requested": "continue_chat",
  "context_updates": {}
}`;
  }

  return `# 当前任务：主动开场

用户刚刚完成八字录入，你已经看过他/她的完整命盘。
现在你需要【主动发出第一条消息】打开对话。

## 用户的原始问题
"${q}"

## 你的开场要做到

像精通东方智慧的老师对带着困局来的人说话：**先给一个有洞见的回应**——锚定命盘里真实算出的结构（日主/大运/用神/强弱等），点清他这个问题背后可能卡在哪里，或给他一个他自己没看到的角度。再自然引出对话，邀请他多说。

- **严禁**「我听到了/我明白了」式套路开场；**不要**固定「自我介绍→摆命盘→承接问题→尖锐追问」流水线
- 自我介绍可极简（如「我是 POJU。」），不必套路
- 若要问，最多 1 个具体、从洞见自然长出的问题，不要像医生问诊清单

## 风格

- 总字数 180-420 字（中文）/ 140-300 词（英文）；长度跟着内容走，不必写满
- 必须引用命主基础分析中的至少 1 条具体结论（格局/大运/用神/亮点或隐忧），并白话解释
- 自然叙述、像人说话；不要列要点清单；不要说「我能帮你」之类的空承诺

## 输出格式（严格 JSON，无 markdown 围栏）

{
  "response": "你的主动开场消息",
  "suggested_phase": null,
  "action_requested": "continue_chat",
  "context_updates": {}
}`;
}

export async function callOpeningPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  let baseMessages = formatPhaseMessageHistory(input.session.messages);
  if (baseMessages.length === 0) {
    baseMessages = [{ role: "user", content: "__OPENING__" }];
  }
  const { system, messages } = await buildPhaseTransportInput(
    input,
    buildOpeningTaskBlock(input),
    baseMessages,
  );

  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "chat_flash",
      temperature: 0.55,
      max_tokens: 2800,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

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
    served_provider: result.provider ?? null,
    thinking_process: undefined,
  };
}
