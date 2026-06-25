/**
 * Step I — AI 主动开场（东方破局顾问定位）
 */
import { normalizeAgentPhase, type AgentPhase } from "@/lib/poju/agent-state";
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

const VALID_SUGGESTED: AgentPhase[] = ["opening", "collecting_context"];

function buildOpeningTaskBlock(input: PhaseLLMInput): string {
  const deliveryHandoff = Boolean(input.tool_injection_context?.includes("交付页延续"));
  if (!deliveryHandoff) return "";
  const q = input.session.original_question;
  return `# 交付页转入 · 动态上下文
用户刚从工具交付页进入 POJU；原始问题："${q}"
从注入资料中锚定他要深入的那件具体困境，自然开口承接。`;
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

  const understanding_sufficient =
    typeof parsed.understanding_sufficient === "boolean"
      ? parsed.understanding_sufficient
      : typeof parsed.understanding === "object" &&
          parsed.understanding !== null &&
          typeof (parsed.understanding as { sufficient?: unknown }).sufficient === "boolean"
        ? Boolean((parsed.understanding as { sufficient: boolean }).sufficient)
        : false;

  const understanding = {
    sufficient: understanding_sufficient,
    missing:
      typeof parsed.understanding === "object" &&
      parsed.understanding !== null &&
      typeof (parsed.understanding as { missing?: unknown }).missing === "string"
        ? (parsed.understanding as { missing: string }).missing
        : "",
  };

  const suggestedRaw = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase : null;
  const suggested = suggestedRaw ? normalizeAgentPhase(suggestedRaw) : null;
  const suggested_phase =
    understanding.sufficient && suggested && VALID_SUGGESTED.includes(suggested) ? suggested : null;

  console.log("[poju-diag] phase-transition", {
    from: "opening",
    to: suggested_phase ?? "opening",
    sufficient: understanding.sufficient,
    understanding_sufficient,
    suggested: suggested_phase,
    parse_failed: isPhaseParseFailed(parsed),
  });

  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;
  const action_requested: PojuV4ActionRequested | null =
    rawAction === "continue_chat" ? rawAction : "continue_chat";

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
    understanding_sufficient,
  };
}
