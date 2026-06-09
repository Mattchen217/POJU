import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import type { AgentPhase, ContextSummary } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildOrientalSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

const VALID_SUGGESTED: AgentPhase[] = ["awaiting_confirmation", "collecting_context", "delivered"];

function normalizeSummary(raw: unknown): ContextSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as ContextSummary;
  if (!Array.isArray(s.sections)) return null;
  return {
    generated_at: typeof s.generated_at === "string" ? s.generated_at : new Date().toISOString(),
    category: String(s.category ?? "other"),
    sections: s.sections,
  };
}

function buildSummaryTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const contextText = agent ? formatContextForPrompt(agent) : "";
  const completeness = agent?.collection_completeness ?? 0;

  return `# 当前任务：信息汇总

你已经和用户聊了几轮，信息基本完整。现在要整理成可编辑的汇总页供用户确认。

## 用户的原始问题
"${input.session.original_question}"

## 已收集的信息
${contextText}

完成度: ${(completeness * 100).toFixed(0)}%

## 你要做什么

1. response：50-100 字承接（「我整理了一下，你看看对不对」），不要复述整张表
2. current_summary：5-7 个 section，每节 2-5 个 item；value 尽量用用户原话；不要补充用户没说的

## 输出格式（严格 JSON）

{
  "response": "...",
  "suggested_phase": null,
  "current_summary": {
    "generated_at": "<ISO8601>",
    "category": "career|relationship|wealth|health|family|decision|interpersonal|other",
    "sections": [{ "section_id": "...", "title": "...", "items": [{ "item_id": "...", "label": "...", "value": "...", "field_key": "..." }] }]
  },
  "context_updates": {}
}`;
}

async function handleConfirmProceed(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const existingSummary = input.agent_state?.current_summary ?? null;
  const system = await buildOrientalSystemPrompt(
    input,
    `# 当前任务：用户已确认汇总

用户已确认信息无误，准备进入深度破局交付。用 1-3 句自然承接（可提及将结合命盘与已收集信息），并设置 suggested_phase 为 "delivered"。不要输出完整交付正文。

输出 JSON：response, suggested_phase, context_updates`,
  );
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 800,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content);
  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase =
    rawPhase === "delivered" ? "delivered" : ("delivered" as const);

  return {
    response,
    suggested_phase,
    context_updates:
      parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
        ? (parsed.context_updates as Record<string, unknown>)
        : {},
    question_category: null,
    current_summary: existingSummary,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}

async function generateSummaryPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = await buildOrientalSystemPrompt(input, buildSummaryTaskBlock(input));
  const messages = formatPhaseMessageHistory(input.session.messages);
  const trigger =
    input.user_message.trim() ||
    (input.locale.startsWith("zh") ? "请基于以上信息生成汇总。" : "Generate the confirmation summary from our conversation.");

  const result = await callPhaseJsonTransport(
    system,
    [...messages, { role: "user", content: trigger }],
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 3000,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content);

  const summary = normalizeSummary(parsed.current_summary);
  if (summary && !summary.generated_at) {
    summary.generated_at = new Date().toISOString();
  }

  return {
    response,
    suggested_phase: null,
    context_updates: {},
    question_category: null,
    current_summary: summary,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}

export async function callConfirmationPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const agent = input.agent_state;
  const userMsg = input.user_message.trim();
  const existingSummary = agent?.current_summary ?? null;

  if (!existingSummary) {
    return generateSummaryPhase(input);
  }

  if (userMsg.includes("confirmed summary") || userMsg.includes("[SYSTEM:")) {
    return await handleConfirmProceed(input);
  }

  const system = await buildOrientalSystemPrompt(
    input,
    `# 当前任务：确认阶段对话

用户已看到汇总，正在回应。根据用户消息：
- 要补充 → suggested_phase: "collecting_context"
- 明确确认可开始分析 → suggested_phase: "delivered"
- 否则保持 "awaiting_confirmation"

不要在此阶段输出完整破局交付。输出 JSON：response, suggested_phase, context_updates`,
  );
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 1200,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content);

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase =
    rawPhase && VALID_SUGGESTED.includes(rawPhase as AgentPhase) ? (rawPhase as AgentPhase) : "awaiting_confirmation";

  return {
    response,
    suggested_phase,
    context_updates:
      parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
        ? (parsed.context_updates as Record<string, unknown>)
        : {},
    question_category: null,
    current_summary: existingSummary,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}
