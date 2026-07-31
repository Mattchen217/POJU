/**
 * Step I — AI 主动开场（东方破局顾问定位）
 */
import { normalizeAgentPhase, type AgentPhase } from "@/lib/poju/agent-state";
import {
  callPhaseJsonTransport,
  formatPhaseMessageHistory,
  resolvePhaseResponse,
  withPhaseStreamOpts,
  isPhaseParseFailed,
} from "@/lib/llm/phases/phase-transport";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { parseOpeningConversionPayload } from "@/lib/poju/opening-conversion-payload";
import { extractQuestionCategory } from "@/lib/poju/context-extractor";

const VALID_SUGGESTED: AgentPhase[] = ["opening", "collecting_context"];

function buildOpeningTaskBlock(input: PhaseLLMInput): string {
  const deliveryHandoff = Boolean(input.tool_injection_context?.includes("交付页延续"));
  if (!deliveryHandoff) return "";
  const q = input.session.original_question;
  return `# 交付页转入 · 动态上下文
用户刚从工具交付页进入 Pivot；原始问题："${q}"
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
      max_tokens: 16000,
      thinking_effort: "xhigh",
    }),
  );

  const structured = normalizeBaseAnalysisInput(input.base_analysis ?? null).structured;

  const { parsed, response: rawResponse } = resolvePhaseResponse(result.content, {
    locale: input.locale,
    structured,
    phase_name: "opening",
    call_type: "chat_flash",
    provider: result.provider ?? undefined,
    model: result.model,
    finish_reason: result.finish_reason ?? undefined,
    raw_length: result.content.length,
  });
  let response = rawResponse;

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
  let suggested = suggestedRaw ? normalizeAgentPhase(suggestedRaw) : null;

  let question_category = extractQuestionCategory(parsed);
  let breakthrough_core: PhaseLLMResult["breakthrough_core"] = null;
  let investigation_agenda: PhaseLLMResult["investigation_agenda"] = null;
  let problem_summary: string | null = null;

  if (understanding_sufficient) {
    const conversion = parseOpeningConversionPayload(parsed, response, input.locale);
    if (conversion) {
      response = conversion.response;
      breakthrough_core = conversion.breakthrough_core;
      investigation_agenda = conversion.investigation_agenda;
      question_category = conversion.question_category ?? question_category;
      problem_summary = conversion.problem_summary;
      suggested = "collecting_context";
      console.info("[opening-conversion] envelope parsed", {
        agenda: investigation_agenda.length,
        category: question_category,
      });
    } else {
      console.warn("[opening-conversion] understanding_sufficient but envelope parse failed — fallback core may run");
    }
  }

  const suggested_phase =
    understanding_sufficient && suggested && VALID_SUGGESTED.includes(suggested)
      ? suggested
      : understanding.sufficient && suggested && VALID_SUGGESTED.includes(suggested)
        ? suggested
        : null;

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
    question_category,
    current_summary: problem_summary,
    problem_summary,
    breakthrough_core,
    investigation_agenda,
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
