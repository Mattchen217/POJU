import {
  evaluateAgendaCoverage,
  isAgendaFullyCovered,
  selectCurrentAgendaFocus,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";
import {
  normalizeAgentPhase,
  type ActiveQuestionState,
  type AgentPhase,
  type POJUAgentState,
  createInitialAgentState,
  getUnderstandingMissingFields,
  hasSubstantiveDilemmaAndDirection,
  isUnderstandingComplete,
} from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";
import { classifyConfirmationAffirmative } from "@/lib/poju/confirmation-reply";
import type { QuestionStatus, SessionAction } from "@/lib/poju/question-status";
import { parseQuestionStatus, parseSessionAction } from "@/lib/poju/question-status";

export type PojuState =
  | "opening"
  | "awaiting_understanding_confirm"
  | "collecting_context"
  | "awaiting_confirmation"
  | "delivery"
  | "tracking";

/** ① 投给 LLM 的标准快照（拼在 user 消息最前端） */
export interface StateLedgerSnapshot {
  state_ledger: {
    current_state: PojuState;
    original_question: string;
    question_category: string | null;
    flags: {
      relationship_conclusion_established: boolean;
      breakthrough_direction_confirmed: boolean;
      agenda_built: boolean;
      problem_understood: boolean;
    };
    agenda_checklist: {
      completed: string[];
      pending: string[];
      current_focus: string | null;
      /** 当前项的收集验收尺(collection_goal)——给第3阶段判"收够没够"。 */
      current_focus_goal: string | null;
    };
    /**
     * 单问题小状态机全貌(本项来回 + round + stage + goal)。
     * 切 focus 即重置;①只喂模型看见,②③再接判断/终局。
     */
    active_question_state: ActiveQuestionState | null;
    /** Segment 1 gate — control plane only (not model self-report). */
    understanding_gate: {
      complete: boolean;
      missing: string[];
    };
  };
}

/**
 * 组装/对齐 active_question_state。
 * question_key 变(切 focus)→ 整结构重置;同项 → 沿用 round/stage/history。
 */
export function buildActiveQuestionState(
  agent: POJUAgentState,
  focus: AgendaItem | null,
): ActiveQuestionState | null {
  if (!focus) return null;
  const prev = agent.active_question_state;
  const sameQuestion = prev?.question_key === focus.id;
  if (!sameQuestion) {
    return {
      question_key: focus.id,
      focus_label: focus.label,
      collection_goal: focus.collection_goal ?? null,
      round_on_this_item: 1,
      escalation_stage: 0,
      history_on_this_item: [],
    };
  }
  return {
    ...prev,
    focus_label: focus.label,
    collection_goal: focus.collection_goal ?? null,
  };
}

export function agentPhaseToPojuState(phase: AgentPhase | string | null | undefined): PojuState {
  const normalized = normalizeAgentPhase(phase ?? undefined);
  if (normalized === "delivered") return "delivery";
  if (normalized) return normalized as PojuState;
  return "opening";
}

export function pojuStateToAgentPhase(state: PojuState): AgentPhase {
  if (state === "delivery") return "delivered";
  return state as AgentPhase;
}

export function buildStateSnapshot(agent: POJUAgentState): StateLedgerSnapshot {
  const core = agent.breakthrough_core ?? null;
  const agenda: AgendaItem[] = agent.investigation_agenda ?? [];
  const pendingItems = agenda.filter((a) => a.status !== "covered");
  const focus = selectCurrentAgendaFocus(agenda);
  return {
    state_ledger: {
      current_state: agentPhaseToPojuState(agent.current_phase),
      original_question: agent.original_question ?? "",
      question_category: agent.question_category ?? null,
      flags: {
        problem_understood: isUnderstandingComplete(agent),
        relationship_conclusion_established: Boolean(core?.situation_conclusion),
        breakthrough_direction_confirmed: (core?.modern_action_frames?.length ?? 0) > 0,
        agenda_built: agenda.length > 0,
      },
      agenda_checklist: {
        completed: agenda.filter((a) => a.status === "covered").map((a) => a.label),
        pending: pendingItems.map((a) => a.label),
        current_focus: focus ? focus.label : null,
        current_focus_goal: focus?.collection_goal ?? null,
      },
      active_question_state: buildActiveQuestionState(agent, focus),
      understanding_gate: {
        complete: isUnderstandingComplete(agent),
        missing: getUnderstandingMissingFields(agent),
      },
    },
  };
}

/** JSON snapshot block prepended to the latest user message each turn. */
export function buildTurnContextSnapshot(agent: POJUAgentState | null | undefined): string {
  const snapshot = buildStateSnapshot(
    agent ?? createInitialAgentState({ original_question: "" }),
  );
  return `[SYSTEM STATE MACHINE SNAPSHOT]\n${JSON.stringify(snapshot, null, 2)}`;
}

/** Active chat phase — session.main_delivery_done forces tracking. */
export function resolveActiveAgentPhase(session: POJUSessionState): AgentPhase {
  if (session.main_delivery_done) return "tracking";
  const normalized = normalizeAgentPhase(session.agent_v2?.current_phase);
  if (normalized) return normalized;
  return "opening";
}

/** Model judgment of whether this user turn answered the current ask. */
export type ReplyQuality = "clear" | "vague";

/** 模型每轮回吐的结构化信号（数据面 → 控制面） */
export interface ModelTurnSignals {
  response: string;
  understanding_sufficient?: boolean;
  base_analysis_ready?: boolean;
  /** Substantive user turns counted from session history (opening gate). */
  substantive_opening_turns?: number;
  /** Core problem statement extracted from first 1–2 substantive opening messages. */
  opening_problem_statement?: string;
  topic_drift_signal?: "none" | "edge" | "off_topic";
  /**
   * clear = answered (incl. clear refusal/negative); vague = zero-help / noise.
   * Collecting: cover only when clear + focus in completed_in_this_turn.
   * 过渡兼容：以 question_status 为准时由 clamp 镜像填入。
   */
  reply_quality?: ReplyQuality;
  /** 单问题小状态机放行准绳（clamp 后）。 */
  question_status?: QuestionStatus;
  /** 终局/暂停信号（clamp 后）；terminate_refund 仅配 terminal。 */
  session_action?: SessionAction | null;
  agenda_updates?: { completed_in_this_turn?: string[] };
  user_confirms_delivery?: boolean;
  confirmation_signal?: "confirmed" | "wants_to_add" | "unclear";
}

export function parseReplyQuality(raw: unknown): ReplyQuality | undefined {
  if (raw === "clear" || raw === "vague") return raw;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase();
  if (t === "clear" || t === "answered" || t === "ok" || t === "good") return "clear";
  if (t === "vague" || t === "unclear" || t === "fuzzy" || t === "invalid" || t === "zero_gain") {
    return "vague";
  }
  return undefined;
}

export interface AdvanceResult {
  next_state: PojuState;
  next_agent: POJUAgentState;
  trigger_breakthrough_core: boolean;
  /** 汇总段(第4段):确认门2 → synthesis job。子步E接线;此前恒为 false。 */
  trigger_synthesis: boolean;
  trigger_delivery: boolean;
  show_new_session_button: boolean;
  transition_reason: string;
}

export function extractModelTurnSignals(source: {
  response?: string;
  understanding_sufficient?: boolean;
  base_analysis_ready?: boolean;
  substantive_opening_turns?: number;
  opening_problem_statement?: string;
  understanding?: { sufficient?: boolean; missing?: string } | null;
  topic_drift_signal?: "none" | "edge" | "off_topic";
  reply_quality?: ReplyQuality | string | null;
  question_status?: QuestionStatus | string | null;
  session_action?: SessionAction | string | null;
  agenda_updates?: { completed_in_this_turn?: string[] };
  user_confirms_delivery?: boolean;
  confirmation_signal?: "confirmed" | "wants_to_add" | "unclear";
}): ModelTurnSignals {
  const understanding_sufficient =
    typeof source.understanding_sufficient === "boolean"
      ? source.understanding_sufficient
      : typeof source.understanding?.sufficient === "boolean"
        ? source.understanding.sufficient
        : undefined;

  const question_status = parseQuestionStatus(source.question_status);
  const sessionParsed = parseSessionAction(source.session_action);
  const session_action =
    sessionParsed === undefined ? undefined : sessionParsed;

  return {
    response: source.response ?? "",
    understanding_sufficient,
    base_analysis_ready: source.base_analysis_ready,
    substantive_opening_turns: source.substantive_opening_turns,
    opening_problem_statement: source.opening_problem_statement,
    topic_drift_signal: source.topic_drift_signal,
    reply_quality: parseReplyQuality(source.reply_quality),
    question_status,
    session_action,
    agenda_updates: source.agenda_updates,
    user_confirms_delivery: source.user_confirms_delivery,
    confirmation_signal: source.confirmation_signal,
  };
}

/** Minimum substantive opening turns before entering collecting (unless single message is rich). */
export const OPENING_RICH_CHARS = 80;
/** Soft cue for prompt-side converge hints (not the force-advance wall). */
export const OPENING_MAX_SUBSTANTIVE_TURNS = 5;
/**
 * 硬上限 · 防死循环安全网(【不是】正常收口手段)。
 * 正常收口只靠 canAdvance(模型 understanding_sufficient=true + 字段真实填充)。
 * 仅当模型连续说"没够"、一路问到撞这个很宽的硬上限,才强制兜底收口——平时永不触发。
 */
export const OPENING_HARD_CEILING = 8;

/** Minimum substantive opening turns when message is below OPENING_RICH_CHARS. */
export const OPENING_MIN_SUBSTANTIVE_TURNS = 2;

/** Control-plane ceiling: inject force-converge when turns reach max-1 and base analysis is ready. */
export function shouldForceConverge(
  substantiveOpeningTurns: number,
  baseAnalysisReady: boolean,
): boolean {
  return (
    baseAnalysisReady &&
    substantiveOpeningTurns >= OPENING_MAX_SUBSTANTIVE_TURNS - 1
  );
}

/** ② 唯一的确定性流转函数：读模型信号，确定性更新状态 */
export function advanceStateMachine(
  agent: POJUAgentState,
  signals: ModelTurnSignals,
  userInput: string,
): AdvanceResult {
  const state = agentPhaseToPojuState(agent.current_phase);
  let next = agent;
  let nextState: PojuState = state;
  let triggerCore = false;
  let triggerSynthesis = false;
  let triggerDelivery = false;
  let transitionReason = "No transition condition met";
  const showNewSession = signals.topic_drift_signal === "off_topic";

  switch (state) {
    case "opening": {
      const structComplete = isUnderstandingComplete(agent);
      const turns = signals.substantive_opening_turns ?? agent.opening_substantive_turns ?? 0;
      const overHardCeiling = turns >= OPENING_HARD_CEILING;
      const hasInput = Boolean(userInput.trim() && userInput !== "__OPENING__");
      const baseReady = signals.base_analysis_ready === true;
      const modelDone = signals.understanding_sufficient === true;

      const canAdvance = structComplete && baseReady && hasInput && modelDone;
      // 收口交给模型:canAdvance(模型说够 + 字段真实)是【唯一正常收口路径】。
      // forceAdvance 降级为【极宽安全网】——只在撞硬上限(防模型永远说没够的死循环)才兜底,平时永不触发。
      const forceAdvance =
        !canAdvance && baseReady && hasInput && overHardCeiling && hasSubstantiveDilemmaAndDirection(agent);

      if (canAdvance || forceAdvance) {
        const lockedQuestion =
          signals.opening_problem_statement?.trim() || userInput.trim();
        next = { ...agent, original_question: lockedQuestion };
        nextState = "awaiting_understanding_confirm";
        transitionReason = canAdvance
          ? "Understanding structure complete and model sufficient, awaiting confirmation"
          : "Opening hard ceiling reached — substantive fields, awaiting confirmation";
        if (forceAdvance) {
          console.info("[poju-gate] opening hard ceiling force advance to understanding confirm", {
            turns,
            missing: getUnderstandingMissingFields(agent),
          });
        }
      } else if (structComplete && baseReady && hasInput && !modelDone) {
        transitionReason =
          "Structure complete but model still gathering — stay in opening (no confirm gate)";
        console.info("[poju-gate] struct complete, model not sufficient — continue opening", {
          turns,
          over_hard_ceiling: overHardCeiling,
        });
      } else if (signals.understanding_sufficient === true && !structComplete) {
        transitionReason =
          "Model reported sufficient but understanding structure incomplete (control plane blocked)";
        console.info("[poju-gate] blocked opening→collecting", {
          model_sufficient: true,
          turns,
          over_hard_ceiling: overHardCeiling,
          missing: getUnderstandingMissingFields(agent),
        });
      }
      break;
    }
    case "awaiting_understanding_confirm": {
      const sig = signals.confirmation_signal;
      if (sig === "confirmed") {
        nextState = "collecting_context";
        triggerCore = true;
        transitionReason = "User confirmed understanding summary, entering collection";
      } else if (sig === "wants_to_add") {
        nextState = "opening";
        transitionReason = "User wants to supplement understanding";
      } else {
        nextState = "awaiting_understanding_confirm";
        transitionReason = "Awaiting explicit understanding confirmation (button)";
      }
      break;
    }
    case "collecting_context": {
      const agenda = agent.investigation_agenda ?? [];
      const focus = selectCurrentAgendaFocus(agenda);

      const reportedRaw = signals.agenda_updates?.completed_in_this_turn ?? [];
      const reported = new Set(
        focus ? reportedRaw.filter((label) => label === focus.label) : [],
      );
      const hasUserInput =
        userInput.trim().length > 0 &&
        userInput.trim() !== "__OPENING__" &&
        !userInput.trim().startsWith("[SYSTEM:");
      const quality = signals.reply_quality;
      /** Cover only on model-reported completion of focus — never on input count. Vague blocks cover. */
      const reportedFocus = Boolean(focus && reported.has(focus.label));
      const qualityCover = hasUserInput && reportedFocus && quality !== "vague";
      /**
       * Vague for streak: explicit vague, OR no clear cover this turn unless model
       * explicitly marked clear (clear-without-complete stays partial, no streak).
       */
      const isVague =
        hasUserInput &&
        !qualityCover &&
        (quality === "vague" || quality !== "clear");

      const updated = agenda.map((a) => {
        if (!focus || a.label !== focus.label) {
          if (a.unqualified_streak && a.unqualified_streak > 0 && a.status !== "covered") {
            return { ...a, unqualified_streak: 0 };
          }
          return a;
        }

        if (qualityCover) {
          return {
            ...a,
            status: "covered" as const,
            stale_turns: 0,
            unqualified_streak: 0,
          };
        }

        if (isVague) {
          const streak = Math.min(4, (a.unqualified_streak ?? 0) + 1);
          const nextStatus: AgendaItem["status"] =
            a.status === "unexplored" ? "partial" : a.status;
          return {
            ...a,
            status: nextStatus,
            unqualified_streak: streak,
            stale_turns: a.stale_turns,
          };
        }

        // Explicit clear without completed_in_this_turn: mark partial, reset streak.
        if (hasUserInput) {
          return {
            ...a,
            status: a.status === "unexplored" ? ("partial" as const) : a.status,
            unqualified_streak: 0,
          };
        }
        return a;
      });

      const postFocus = selectCurrentAgendaFocus(updated);
      const withStale = updated.map((a) => {
        if (!postFocus || a.label !== postFocus.label) return a;
        if (a.status === "covered") return { ...a, stale_turns: 0 };
        return { ...a, stale_turns: (a.stale_turns ?? 0) + 1 };
      });
      next = { ...agent, investigation_agenda: withStale };

      if (hasUserInput && isVague && focus) {
        const streak =
          withStale.find((a) => a.label === focus.label)?.unqualified_streak ?? 0;
        transitionReason = `Vague answer on focus — streak ${streak}/4 (no cover)`;
      } else if (qualityCover && focus) {
        transitionReason = `Focus covered by clear answer: ${focus.label}`;
      }

      const cov = evaluateAgendaCoverage(withStale);
      if (cov.total > 0 && isAgendaFullyCovered(withStale)) {
        nextState = "awaiting_confirmation";
        transitionReason = `Agenda fully covered (${cov.coveredCount}/${cov.total})`;
      }
      break;
    }
    case "awaiting_confirmation": {
      const sig = signals.confirmation_signal;
      const inferred = classifyConfirmationAffirmative(userInput);
      if (
        sig === "confirmed" ||
        signals.user_confirms_delivery === true ||
        inferred === "confirmed"
      ) {
        // 五阶段:确认门2 先触发【汇总段】(收敛主辅+方案),不再直接交付。
        // 汇总 job 写回主辅后,由 finalizeSynthesisJobSuccess 再启动交付 job。
        // nextState 停在 awaiting_confirmation;synthesis_status=pending 驱动 Preparing UI。
        triggerSynthesis = true;
        transitionReason = "User confirmed, generating synthesis (汇总定方案)";
      } else if (sig === "wants_to_add" || inferred === "wants_to_add") {
        nextState = "collecting_context";
        transitionReason = "User wants to add more context";
      }
      break;
    }
    case "delivery":
      nextState = "tracking";
      transitionReason = "Main delivery done, entering tracking mode";
      break;
    case "tracking":
      break;
  }

  const nextPhase = pojuStateToAgentPhase(nextState);
  const fromPhase = normalizeAgentPhase(agent.current_phase) ?? agent.current_phase;
  let nextAgent: POJUAgentState = { ...next, current_phase: nextPhase };

  if (nextPhase !== fromPhase) {
    nextAgent = {
      ...nextAgent,
      phase_history: [
        ...agent.phase_history,
        {
          from_phase: fromPhase,
          to_phase: nextPhase,
          triggered_at: new Date().toISOString(),
          reason: transitionReason,
        },
      ],
    };
  }

  return {
    next_state: nextState,
    next_agent: nextAgent,
    trigger_breakthrough_core: triggerCore,
    trigger_synthesis: triggerSynthesis,
    trigger_delivery: triggerDelivery,
    show_new_session_button: showNewSession,
    transition_reason: transitionReason,
  };
}
