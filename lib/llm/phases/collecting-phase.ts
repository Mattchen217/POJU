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

  stripAgendaFieldsFromContextUpdates,

} from "@/lib/poju/investigation-agenda";

import { callStallOfferPhase } from "@/lib/llm/phases/stall-offer-phase";

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
import { buildStateLedger } from "@/lib/llm/phases/state-ledger";
import { buildToolSuggestionPhaseAppendix } from "@/lib/llm/phases/tool-suggestion-phase-appendix";

import { parseToolSuggestionFromParsed } from "@/lib/poju/tool-suggestion";

import { parseTopicDriftFromParsed } from "@/lib/poju/topic-drift";



const VALID_SUGGESTED: AgentPhase[] = ["collecting_context", "awaiting_confirmation"];

const VALID_ACTIONS: PojuV4ActionRequested[] = [

  "continue_chat",

  "show_birth_form",

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

  const focus = getNextAgendaFocus(agenda);

  const focusText = focus.map((a) => `- ${a.label} (${a.id}, ${a.status})`).join("\n") || "- 优先把必查项弄清楚";

  return `



## 调查议程（你的私有收集计划）

${formatAgendaForPrompt(agenda)}



下一个该弄清的：

${focusText}`;

}



function buildCollectingTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const q = input.session.original_question;
  const spineBlock = buildSpineBlock(agent);
  const agendaBlock = agent ? buildAgendaTrackingBlock(agent) : "";

  const ledger = buildStateLedger(
    agent ?? null,
    "收集·验证演进",
    "拿他的回答验证/修正你的破局方向，弄清你还需要知道的关键项",
    "必查项全 covered 且覆盖≥80%→征询出完整分析，进确认",
  );

  return `${ledger}

# 任务：收集阶段 —— 在脊柱上验证与演进

用户的问题："${q}"

你已经有一条推理脊柱（关系结论 + 2–3 条破局方向）和一份由它倒推出的调查议程。
这一阶段你不是"重新认识他"，而是【拿他的回答去验证 / 修正你的破局方向】。

${spineBlock}

${agendaBlock}

## 任务与要求
这一格你拿他的回答去验证或修正你的破局方向，顺着自然弄清你还需要知道的关键项；判断变了就在 \`breakthrough_core_updates\` 里演进对应方向。
怎么回应、说多少、这一轮要不要发问、从哪切入，全凭你作为一位有温度、直指要害的东方智者对这一刻的判断——不套任何固定结构。
已 covered 的角度别重问；完整方案留到交付。议程是私有计划，不要照念给用户。

## 红线
- 还不交付完整方案；他催就告诉他"完整分析里一次给你，先把情况弄清楚"。

## 他不配合时（委婉拉回阶梯，不暴露机制）
- 含糊 → 温和请他具体点；敷衍/想跳过 → 认真而不指责；持续不配合 → 坦诚提退款选项。
- 绝不说"系统要求/还没到轮数/流程规定"。一旦配合就回到正常聊。

## 每轮必判跑题（topic_drift_signal）
- 相关 none / 沾边 edge（简短确认相关性）/ 完全偏离 off_topic（说明需另开会话，should_show_new_session_button=true）

## 信息齐了
必查项全 covered → 征询他是否现在就出完整分析。

## 输出 JSON（response 第一个键）
{
  "response": "...",
  "suggested_phase": "collecting_context" | "awaiting_confirmation" | null,
  "action_requested": "continue_chat" | "show_birth_form",
  "question_category": "career"|"relationship"|"wealth"|"health"|"family"|"decision"|"interpersonal"|"other"|null,
  "context_updates": { "agenda_status_updates": { "<id>": "partial"|"covered" } },
  "breakthrough_core_updates": { "breakthrough_directions": [ { "direction": "...", "status": "reinforced"|"weakened"|"selected", "structural_basis": "...", "what_would_confirm": "..." } ] },
  "collection_progress": "advancing"|"stalled"|"resistant",
  "topic_drift_signal": "none"|"edge"|"off_topic",
  "drift_reason": "若偏离一句话说明，否则空字符串",
  "should_show_new_session_button": false
}

（breakthrough_core_updates 无变化时省略该键。议程已生成，不再输出 investigation_agenda。）

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: false })}`;
}



export async function callCollectingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {

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

  let action_requested: PojuV4ActionRequested | null =

    rawAction && VALID_ACTIONS.includes(rawAction as PojuV4ActionRequested)

      ? (rawAction as PojuV4ActionRequested)

      : null;

  if (!action_requested && rawAction === "show_birth_form") {

    action_requested = "show_birth_form";

  }



  const drift = parseTopicDriftFromParsed(parsed);

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

    suggest_refund,

    served_provider: result.provider ?? null,

    ...drift,

  };

}


