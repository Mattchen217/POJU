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



  return `# 任务：收集阶段 —— 在脊柱上验证与演进



用户的问题："${q}"



你已经有一条推理脊柱（关系结论 + 2–3 条破局方向）和一份由它倒推出的调查议程。

这一阶段你不是"重新认识他"，而是【拿他的回答去验证 / 修正你的破局方向】。



${spineBlock}

${agendaBlock}



## 每一轮你做三件事（但怎么说完全自然，绝不套固定骨架）

1. 从脊柱掏真洞见：用他上一轮回答，印证或推翻某条破局方向，把"为什么会这样"再讲深一层。

   有真东西才说，没有就老实接住、别硬凑命盘、别每句"你的核心是…"。

2. 悄悄推进议程：朝"还没弄清的关键项"问一步——像老师追问，不像表格。已 covered 的角度禁止重问。

3. 演进脊柱：如果他的回答改变了你对某条破局方向的判断（强化/削弱/需换方向），

   在 breakthrough_core_updates 里更新对应 direction 的 status 与措辞；没变化就不输出该字段。



## 每轮的分量（别敷衍，也别注水）
- 每一轮 response 必须落地【至少一个真洞见】—— 从脊柱里掏出来、扣住他这轮说的话、
  让他对自己的处境多看清一层。只"嗯我懂了 + 问一句"是不合格的。
- 篇幅指引：中文约 150–320 字 / 英文约 110–230 词。够你把一个洞见讲透 + 自然带出下一个要弄清的点。
  明显短于此，多半是洞见没给够。
- 但"分量" = 洞见密度，不是堆字、不是堆术语。真没有新东西可给时宁可短，
  也绝不许用漂亮空话 / 重复命盘词凑长度（金字仍每段 ≤2）。



## 红线（违反即回退机器人 · 灵魂文档 3.2）

- 绝不"每轮必问 1-2 题"的固定模板；有时一整轮只是认真听、点一句，也很好。

- 绝不"我听到了 / 我明白了"开头。

- 议程是私有计划，不是逐条念给用户的清单；聊天表层永远"边给光边问"。

- 还不交付完整方案；他催就告诉他"完整分析里一次给你，先把情况弄清楚"。



## 他不配合时（委婉拉回阶梯，不暴露机制）

- 含糊 → 温和请他具体点；敷衍/想跳过 → 认真而不指责；持续不配合 → 坦诚提退款选项。

- 绝不说"系统要求/还没到轮数/流程规定"。一旦配合就回到正常聊。



## 每轮必判跑题（topic_drift_signal）

- 相关 none / 沾边 edge（简短确认相关性）/ 完全偏离 off_topic（说明需另开会话，should_show_new_session_button=true）



## 信息齐了

必查项全 covered → 用明确征询问句问他"要不要现在就出完整分析"（问号收尾）。



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



  if (resolved.compliance_failed) {

    console.warn(

      "[collecting-phase] compliance failed — using fallback (no re-POST)",

      transport.provider ?? "—",

    );

    resolved = {

      ...resolved,

      response: getPhaseResponseFallback(input.locale),

      used_fallback: true,

      compliance_failed: false,

    };

  }



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


