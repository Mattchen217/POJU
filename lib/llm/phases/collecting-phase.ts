import {

  countEffectiveCollectingTurns,

  evaluateCollectingConfirmationGate,

} from "@/lib/poju/collecting-confirmation-gate";

import {

  evaluateStopLoss,

  isPrematureCollectingPhase,

  nextStallCount,

  parseCollectionProgress,

  projectCollectingStopLoss,

  shouldSuggestRefund,

} from "@/lib/poju/collection-progress";

import {

  applyAgendaStatusUpdates,

  extractAgendaStatusUpdates,

  formatAgendaForPrompt,

  getNextAgendaFocus,

  selectCurrentAgendaFocus,

  stripAgendaFieldsFromContextUpdates,

} from "@/lib/poju/investigation-agenda";

import { callStallOfferPhase } from "@/lib/llm/phases/stall-offer-phase";
import { callOpeningPhase } from "@/lib/llm/phases/opening-phase";

import { extractQuestionCategory, mergeContextUpdates, recordToLLMContextUpdates } from "@/lib/poju/context-extractor";

import type { AgentPhase, BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";

import {

  calculateCompleteness,

  mergeBreakthroughCoreUpdates,

  parseBreakthroughCoreUpdatesFromLlm,

} from "@/lib/poju/agent-state";

import {

  callPhaseJsonTransport,

  getPhaseResponseFallback,

  resolvePhaseResponse,

  withPhaseStreamOpts,

  isPhaseParseFailed,

} from "@/lib/llm/phases/phase-transport";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";

import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";

import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";

import type { PojuV4ActionRequested } from "@/lib/poju/types";

import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

import { buildSpineBlock } from "@/lib/llm/phases/spine-block";
import { buildToolSuggestionPhaseAppendix } from "@/lib/llm/phases/tool-suggestion-phase-appendix";

import { parseToolSuggestionFromParsed } from "@/lib/poju/tool-suggestion";

import { parseTopicDriftFromParsed } from "@/lib/poju/topic-drift";



const VALID_SUGGESTED: AgentPhase[] = ["collecting_context", "awaiting_confirmation"];

const VALID_ACTIONS: PojuV4ActionRequested[] = [
  "continue_chat",
  "deliver_main",
  "track_progress",
];



function projectAgentAfterUpdates(

  agent: POJUAgentState,

  contextUpdates: Record<string, unknown>,

  questionCategory: string | null,

  breakthroughCoreUpdates?: Partial<BreakthroughCore> | null,

): POJUAgentState {

  const stripped = stripAgendaFieldsFromContextUpdates(contextUpdates);

  const structured = recordToLLMContextUpdates(stripped);

  let investigation_agenda = agent.investigation_agenda ?? [];

  const agenda_generated = agent.agenda_generated ?? false;



  const statusUpdates = extractAgendaStatusUpdates(contextUpdates);

  if (agenda_generated && statusUpdates) {

    investigation_agenda = applyAgendaStatusUpdates(investigation_agenda, statusUpdates);

  }



  let breakthrough_core = agent.breakthrough_core;

  if (breakthrough_core && breakthroughCoreUpdates) {

    breakthrough_core = mergeBreakthroughCoreUpdates(breakthrough_core, breakthroughCoreUpdates);

  }



  const merged: POJUAgentState = {

    ...agent,

    context_collected: mergeContextUpdates(agent.context_collected, structured),

    question_category:

      extractQuestionCategory(stripped) ??

      (questionCategory as POJUAgentState["question_category"]) ??

      agent.question_category,

    investigation_agenda,

    agenda_generated,

    breakthrough_core,

  };

  return { ...merged, collection_completeness: calculateCompleteness(merged) };

}



function clampCollectingSuggestedPhase(

  suggested_phase: AgentPhase | null,

  agent: POJUAgentState,

  session: PhaseLLMInput["session"],

  contextUpdates: Record<string, unknown>,

  questionCategory: string | null,

  collectionProgress: ReturnType<typeof parseCollectionProgress>,

  breakthroughCoreUpdates?: Partial<BreakthroughCore> | null,

): AgentPhase | null {

  if (suggested_phase !== "awaiting_confirmation") return suggested_phase;

  const projected = projectAgentAfterUpdates(

    agent,

    contextUpdates,

    questionCategory,

    breakthroughCoreUpdates,

  );

  const userTurns = countEffectiveCollectingTurns(session);

  if (isPrematureCollectingPhase(projected, userTurns)) {

    console.warn("[collecting-phase] Blocked premature awaiting_confirmation: agenda or turns below gate");

    return "collecting_context";

  }

  if (collectionProgress) {

    const projectedStall = nextStallCount(agent.stall_count ?? 0, collectionProgress);

    const stopLoss = evaluateStopLoss({

      stall_count: projectedStall,

      collection_progress: collectionProgress,

      collecting_turn_count: agent.collecting_turn_count ?? userTurns,

    });

    if (stopLoss.triggered) {

      console.warn("[collecting-phase] Blocked awaiting_confirmation: stop-loss", stopLoss.reason);

      return "collecting_context";

    }

  }

  const gate = evaluateCollectingConfirmationGate(

    projected,

    countEffectiveCollectingTurns(session),

  );

  if (gate.allowed) return suggested_phase;

  console.warn("[collecting-phase] Blocked premature awaiting_confirmation:", gate.reason);

  return "collecting_context";

}



function buildAgendaTrackingBlock(agent: POJUAgentState): string {

  const agenda = agent.investigation_agenda ?? [];

  if (agenda.length === 0) return "";

  const focus = selectCurrentAgendaFocus(agenda);

  const focusText = focus
    ? `- ${focus.label} (${focus.id}, ${focus.status})`
    : "- 优先把必查项弄清楚";

  return `



## 调查议程（你的私有收集计划）

${formatAgendaForPrompt(agenda)}



下一个该弄清的：

${focusText}`;

}



function buildLastAgendaItemDirective(agent: POJUAgentState): string {
  const agenda = agent.investigation_agenda ?? [];
  const focus = selectCurrentAgendaFocus(agenda);
  if (!focus) return "";
  const pending = agenda.filter((a) => a.status !== "covered");
  if (pending.length !== 1 || pending[0]?.label !== focus.label) return "";
  return `

## 本轮是最后一项议程（答到位后控制面将切到 awaiting_confirmation）
用户刚回应的是最后一项。若判定答到位：写进 completed，**不要**再追问新议程。
用核对口吻凝练总结 + **末尾必须明确问**：「回复可以或没有了我就生成完整破局方案」——**禁止只总结不提问**。`;
}

function buildFirstCollectingInsightDirective(agent: POJUAgentState): string {
  if (!agent.breakthrough_core) return "";
  const collectingTurns = agent.collecting_turn_count ?? 0;
  if (collectingTurns > 0) {
    return `

## 本轮动作
快照里关系结论与破局方向已确立（✓），**不要重复**第一阶段洞见；严格按议程 pending 第一项推进。`;
  }
  return `

## 本轮动作（首次进入 collecting · 关系结论本回合刚确立）
2–4 句第一阶段洞见：他卡在哪一层 + 一个破局大方向。**不要**说「愿意的话我们深入推演」——用户看不到内部议程列表。
收尾**必须立刻**问 snapshot \`current_focus\` 对应的那一个问题（只问这一句，不列 pending）。**绝不**交付完整 3 条行动。`;
}

function buildCollectingTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const q = input.session.original_question;
  const spineBlock = buildSpineBlock(agent);
  const agendaBlock = agent ? buildAgendaTrackingBlock(agent) : "";
  const insightDirective = agent ? buildFirstCollectingInsightDirective(agent) : "";
  const lastItemDirective = agent ? buildLastAgendaItemDirective(agent) : "";

  return `# 动态上下文 · collecting
用户的问题："${q}"

${spineBlock}

${agendaBlock}
${insightDirective}
${lastItemDirective}

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: false })}`.trim();
}



export async function callCollectingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const agent = input.agent_state;
  if (agent?.current_phase === "collecting_context" && agent.breakthrough_core == null) {
    return callOpeningPhase(input);
  }

  const structured = normalizeBaseAnalysisInput(input.base_analysis ?? null).structured ?? null;

  const { system, messages } = await buildPhaseTransportInput(

    input,

    buildCollectingTaskBlock(input),

  );



  let transport = await callPhaseJsonTransport(

    system,

    messages,

    withPhaseStreamOpts(input, {

      call_type: "collection_flash",

      max_tokens: 8000,

      temperature: 0.5,

      thinking_effort: "xhigh",

    }),

  );



  let resolved = resolvePhaseResponse(transport.content, {

    locale: input.locale,

    phase_name: "collecting_context",

    call_type: "collection_flash",

    model: transport.model,

    finish_reason: transport.finish_reason,

    provider: transport.provider,

    structured,

    use_fallback: true,

  });



  if (!resolved.response.trim()) {

    resolved = {

      ...resolved,

      response: getPhaseResponseFallback(input.locale),

      used_fallback: true,

    };

  }



  return finishCollectingPhase(input, transport, resolved.parsed, resolved.response, structured);

}



async function finishCollectingPhase(

  input: PhaseLLMInput,

  result: Awaited<ReturnType<typeof callPhaseJsonTransport>>,

  parsed: Record<string, unknown>,

  response: string,

  _structured: ProfileStructured | null,

): Promise<PhaseLLMResult> {



  const context_updates =

    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)

      ? (parsed.context_updates as Record<string, unknown>)

      : {};



  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;

  let suggested_phase =
    !isPhaseParseFailed(parsed) &&
    rawPhase &&
    VALID_SUGGESTED.includes(rawPhase as AgentPhase)
      ? (rawPhase as AgentPhase)
      : null;



  const questionCategory = typeof parsed.question_category === "string" ? parsed.question_category : null;

  const collection_progress = parseCollectionProgress(parsed.collection_progress);

  const breakthrough_core_updates = isPhaseParseFailed(parsed)
    ? null
    : parseBreakthroughCoreUpdatesFromLlm(parsed.breakthrough_core_updates);



  if (input.agent_state && suggested_phase) {

    suggested_phase = clampCollectingSuggestedPhase(

      suggested_phase,

      input.agent_state,

      input.session,

      context_updates,

      questionCategory,

      collection_progress,

      breakthrough_core_updates,

    );

  }



  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;

  const action_requested: PojuV4ActionRequested | null =
    rawAction && VALID_ACTIONS.includes(rawAction as PojuV4ActionRequested)
      ? (rawAction as PojuV4ActionRequested)
      : "continue_chat";

  const drift = parseTopicDriftFromParsed(parsed);

  const agenda_updates =
    parsed.agenda_updates &&
    typeof parsed.agenda_updates === "object" &&
    !Array.isArray(parsed.agenda_updates)
      ? (parsed.agenda_updates as { completed_in_this_turn?: string[] })
      : undefined;

  const tool_suggestion = parseToolSuggestionFromParsed(parsed);



  let suggest_refund = false;

  if (input.agent_state && collection_progress) {

    const { stopLoss } = projectCollectingStopLoss(input.agent_state, collection_progress, true);

    suggest_refund = shouldSuggestRefund({

      agent: input.agent_state,

      collection_progress,

      stall_offer: false,

    });

    if (stopLoss.triggered && !suggest_refund) {

      console.info("[collecting-phase] Stop-loss → stall offer:", stopLoss.reason);

      const stallResult = await callStallOfferPhase(input);

      return {

        ...stallResult,

        collection_progress,

      };

    }

  }



  return {

    response,

    suggested_phase,

    action_requested,

    context_updates,

    question_category: questionCategory,

    current_summary: null,

    main_delivery_data: null,

    actions: [],

    tokens_used: result.tokens_used,

    total_cost: 0,

    call_count: 1,

    model: result.model,

    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),

    tool_suggestion,

    start_new_cycle: false,

    new_cycle_question: null,

    collection_progress,

    investigation_agenda: null,

    breakthrough_core_updates,

    agenda_updates,

    suggest_refund,

    served_provider: result.provider ?? null,

    ...drift,

  };

}


