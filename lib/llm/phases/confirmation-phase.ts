import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import {
  classifyStallOfferReply,
  stallOfferChoiceToSuggestedPhase,
} from "@/lib/poju/stall-offer-routing";
import type { AgentPhase, ContextSummary } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";
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

const TRANSITION_CONSENT_RULES = `# 征询问句（suggested_phase 切 awaiting_confirmation 时）
response 必须以明确征询问句结尾（问号收尾），问用户是否现在就要完整分析。禁止「稍等/我去整理/我会回来」等异步告知式措辞。`;

function buildSummaryTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const contextText = agent ? formatContextForPrompt(agent) : "";
  const completeness = agent?.collection_completeness ?? 0;

  return `# 任务：信息汇总

用户的问题："${input.session.original_question}"

## 已了解到的
${contextText}

完成度: ${(completeness * 100).toFixed(0)}%

整理成可编辑汇总页供用户确认。response 简短说明汇总已生成、请核对；必须以征询问句结尾（是否现在出完整分析）。current_summary：5-7 个 section，每节 2-5 个 item；value 用用户原话，不编造。

${TRANSITION_CONSENT_RULES}

输出 JSON：response, suggested_phase, current_summary, context_updates`;
}

async function handleConfirmProceed(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const existingSummary = input.agent_state?.current_summary ?? null;
  const { system, messages } = await buildPhaseTransportInput(
    input,
    `# 任务：用户已确认汇总

用户已确认信息无误，准备进入深度破局交付。1-3 句自然承接，suggested_phase 设为 "delivered"。不要输出完整交付正文。

输出 JSON：response, suggested_phase, context_updates`,
  );
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 800,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });
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
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}

async function generateSummaryPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const trigger =
    input.user_message.trim() ||
    (input.locale.startsWith("zh") ? "请基于以上信息生成汇总。" : "Generate the confirmation summary from our conversation.");
  const baseMessages = [
    ...formatPhaseMessageHistory(input.session.messages),
    { role: "user" as const, content: trigger },
  ];
  const { system, messages } = await buildPhaseTransportInput(
    input,
    buildSummaryTaskBlock(input),
    baseMessages,
  );

  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 3000,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

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
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}

async function handleStallOfferReply(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const choice = classifyStallOfferReply(input.user_message);
  const suggested_phase = stallOfferChoiceToSuggestedPhase(choice);
  const choiceHint =
    choice === "continue_collecting"
      ? "用户选择继续补充信息"
      : choice === "degraded_delivery"
        ? "用户选择基于现有信息先给方向"
        : "用户未明确选择，按兜底先给方向处理";

  const { system, messages } = await buildPhaseTransportInput(
    input,
    `# 任务：止损选择回应

用户刚收到「继续聊 vs 先给方向」二选一。代码已判定：${choiceHint}。2-4 句自然承接，不要再次二选一，不要「稍等我去整理」。

输出 JSON：response, suggested_phase, context_updates`,
  );
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 900,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  return {
    response,
    suggested_phase,
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
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    stall_offer: false,
  };
}

export async function callConfirmationPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const agent = input.agent_state;
  const userMsg = input.user_message.trim();
  const existingSummary = agent?.current_summary ?? null;

  if (agent?.stall_offer_pending) {
    return handleStallOfferReply(input);
  }

  if (!existingSummary) {
    return generateSummaryPhase(input);
  }

  if (userMsg.includes("confirmed summary") || userMsg.includes("[SYSTEM:")) {
    return await handleConfirmProceed(input);
  }

  const { system, messages } = await buildPhaseTransportInput(
    input,
    `# 任务：确认阶段对话

用户已看到汇总，正在回应。要补充 → suggested_phase: "collecting_context"；明确确认可开始分析 → "delivered"；否则保持 "awaiting_confirmation"。不要在此输出完整破局交付。

${TRANSITION_CONSENT_RULES}

输出 JSON：response, suggested_phase, context_updates`,
  );
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 1200,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

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
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}
