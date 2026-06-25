import { parseBreakthroughCoreUpdatesFromLlm, type AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";
import { buildSpineBlock } from "@/lib/llm/phases/spine-block";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildToolSuggestionPhaseAppendix } from "@/lib/llm/phases/tool-suggestion-phase-appendix";
import {
  parseStartNewCycleFromParsed,
  parseToolSuggestionFromParsed,
} from "@/lib/poju/tool-suggestion";
import { parseTopicDriftFromParsed } from "@/lib/poju/topic-drift";

function buildTrackingTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const spineBlock = buildSpineBlock(agent);
  const actions = agent?.actions ?? [];
  const actionLines =
    actions.length > 0
      ? actions
          .map((a, i) => `${i + 1}. [${a.category}] [${a.status}] ${a.text.slice(0, 120)}`)
          .join("\n")
      : "(交付行动列表暂不可用 — 根据对话追问具体进展。)";

  const archiveCompleted =
    input.archive_data?.actions
      ?.filter((a) => a.status === "completed")
      .map((a, i) => `${i + 1}. 【${a.title}】${a.user_feedback ? ` — 用户备注: ${a.user_feedback}` : ""}`)
      .join("\n") ?? "";

  const archiveBlock = archiveCompleted
    ? `

## 用户已在 Archive 中标记完成的行动
${archiveCompleted}`
    : "";

  return `# 动态上下文 · tracking
原始问题："${input.session.original_question}"

${spineBlock}

## 已给出的行动
${actionLines}${archiveBlock}

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: true })}`.trim();
}

export async function callTrackingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const { system, messages } = await buildPhaseTransportInput(
    input,
    buildTrackingTaskBlock(input),
  );
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "tracking_flash",
      max_tokens: 7000,
      temperature: 0.45,
      thinking_effort: "xhigh",
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase: AgentPhase | null = rawPhase === "tracking" ? "tracking" : "tracking";

  const drift = parseTopicDriftFromParsed(parsed);
  const tool_suggestion = parseToolSuggestionFromParsed(parsed);
  const { start_new_cycle, new_cycle_question } = parseStartNewCycleFromParsed(parsed);
  const breakthrough_core_updates = parseBreakthroughCoreUpdatesFromLlm(parsed.breakthrough_core_updates);

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  return {
    response,
    suggested_phase,
    context_updates,
    question_category: typeof parsed.question_category === "string" ? parsed.question_category : null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    tool_suggestion,
    start_new_cycle,
    new_cycle_question,
    breakthrough_core_updates,
    ...drift,
  };
}
