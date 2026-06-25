/**
 * Step I — AI 主动开场（东方破局顾问定位）
 */
import { normalizeAgentPhase, type AgentPhase } from "@/lib/poju/agent-state";
import { isGreetingOrEmptyQuestion } from "@/lib/poju/breakthrough-question-gate";
import {
  callPhaseJsonTransport,
  formatPhaseMessageHistory,
  parsePhaseResult,
  withPhaseStreamOpts,
  isPhaseParseFailed,
} from "@/lib/llm/phases/phase-transport";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";
import { buildStateLedger } from "@/lib/llm/phases/state-ledger";

const VALID_SUGGESTED: AgentPhase[] = ["opening", "collecting_context"];

function buildOpeningTaskBlock(input: PhaseLLMInput): string {
  const q = input.session.original_question;
  const agent = input.agent_state;
  const deliveryHandoff = Boolean(input.tool_injection_context?.includes("交付页延续"));

  if (deliveryHandoff) {
    const ledger = buildStateLedger(
      agent ?? null,
      "理解门·交付转入",
      "从工具交付资料与用户原始问题中锚定他要深入的那件具体困境",
      "锚得住→自然承接并说要深入看一下，进 collecting；锚不住→请他点明那件事，留本格",
    );
    return `${ledger}

# 当前任务：交付页转入 · 主动开场

用户刚从工具交付页（Match / Glyph / Syncro）付费进入 POJU，并已看过完整交付内容。
系统注入块里已有合盘/卦象/时机等全部资料；下方「原始问题」是用户想深入的方向。

## 用户的原始问题
"${q}"

## 任务与要求
像一位已经读过全部资料的老师，从资料与用户问题中理解他要破的那件事，自然开口承接。
你是 POJU——有温度、直指要害的东方智者；可引用命盘或工具结论中的具体细节，用 ⟦t:⟧ 包术语。
此格不给完整行动方案或操作指令。

## 输出格式（严格 JSON，无 markdown 围栏）

{
  "response": "你的主动开场消息",
  "suggested_phase": null,
  "action_requested": "continue_chat",
  "context_updates": {}
}`;
  }

  const ledger = buildStateLedger(
    agent ?? null,
    "理解门",
    "从用户输入理解并锚定他要破的那一件具体困境",
    "锚得住（非问候/测试）→进 collecting；锚不住→委婉而坚定地引导他说清那件事，留在本格",
  );

  return `${ledger}

# 任务：理解判断门

你是 POJU——有温度、直指要害的东方智者。在为这位用户启动深度测算之前，
判断他把「困境/问题」讲清楚到足以锚定一次深度命理推演了吗？

## 用户的原始问题
"${q}"

## 要求
- 八字四柱由本地引擎确定性算出，永远完整合法 —— 绝不质疑、绝不说"八字信息不全"。
- 你只审：用户的【处境描述】是否清晰到能让你判断"这个局卡在哪、与他命盘哪条结构相关"。
- 锚得住：自然承接，点出你看清的结构张力（锚命盘），并说要为他深入推演一下；suggested_phase = "collecting_context"。
- 锚不住（问候/测试/只有情绪没有具体事）：委婉而坚定地请他点明"现在最卡的那一件事"；suggested_phase = null。
- 不暴露打分/机制；完整破局方案留到深测算+收集+交付之后。

## 输出 JSON（response 第一个键）
{
  "response": "...",
  "understanding": { "sufficient": true|false, "missing": "若不足，缺哪一类背景，一句话；足够则空字符串" },
  "suggested_phase": "collecting_context" | null,
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
      max_tokens: 6000,
      thinking_effort: "xhigh",
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const lastUserMessage = [...input.session.messages].reverse().find((m) => m.role === "user")?.content;
  const userText = String(input.session.original_question ?? lastUserMessage ?? "").trim();
  const isNonQuestion = isGreetingOrEmptyQuestion(userText);
  const finalSufficient = !isNonQuestion;
  const understanding = { sufficient: finalSufficient, missing: "" };

  const suggestedRaw = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase : null;
  const suggested = suggestedRaw ? normalizeAgentPhase(suggestedRaw) : null;
  const suggested_phase =
    understanding.sufficient && suggested && VALID_SUGGESTED.includes(suggested) ? suggested : null;

  console.log("[poju-diag] phase-transition", {
    from: "opening",
    to: suggested_phase ?? "opening",
    sufficient: understanding.sufficient,
    suggested: suggested_phase,
    parse_failed: isPhaseParseFailed(parsed),
    deterministic_gate: isNonQuestion ? "greeting" : "substantive",
  });

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
    understanding,
  };
}
