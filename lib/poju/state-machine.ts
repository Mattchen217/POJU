import {
  evaluateAgendaCoverage,
  isAgendaFullyCovered,
  selectCurrentAgendaFocus,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";
import {
  normalizeAgentPhase,
  type AgentPhase,
  type POJUAgentState,
  createInitialAgentState,
  getUnderstandingMissingFields,
  isUnderstandingComplete,
} from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";
import { classifyConfirmationAffirmative } from "@/lib/poju/confirmation-reply";

export type PojuState =
  | "opening"
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
    };
    /** Segment 1 gate — control plane only (not model self-report). */
    understanding_gate: {
      complete: boolean;
      missing: string[];
    };
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
        relationship_conclusion_established: Boolean(core?.relationship_conclusion),
        breakthrough_direction_confirmed: (core?.breakthrough_directions?.length ?? 0) > 0,
        agenda_built: agenda.length > 0,
      },
      agenda_checklist: {
        completed: agenda.filter((a) => a.status === "covered").map((a) => a.label),
        pending: pendingItems.map((a) => a.label),
        current_focus: focus ? focus.label : null,
      },
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
  agenda_updates?: { completed_in_this_turn?: string[] };
  user_confirms_delivery?: boolean;
  confirmation_signal?: "confirmed" | "wants_to_add" | "unclear";
}

export interface AdvanceResult {
  next_state: PojuState;
  next_agent: POJUAgentState;
  trigger_breakthrough_core: boolean;
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

  return {
    response: source.response ?? "",
    understanding_sufficient,
    base_analysis_ready: source.base_analysis_ready,
    substantive_opening_turns: source.substantive_opening_turns,
    opening_problem_statement: source.opening_problem_statement,
    topic_drift_signal: source.topic_drift_signal,
    agenda_updates: source.agenda_updates,
    user_confirms_delivery: source.user_confirms_delivery,
    confirmation_signal: source.confirmation_signal,
  };
}

/** Minimum substantive opening turns before entering collecting (unless single message is rich). */
export const OPENING_RICH_CHARS = 80;
/** Maximum substantive opening turns before control plane forces convergence. */
export const OPENING_MAX_SUBSTANTIVE_TURNS = 4;

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
  let triggerDelivery = false;
  let transitionReason = "No transition condition met";
  const showNewSession = signals.topic_drift_signal === "off_topic";

  switch (state) {
    case "opening": {
      const structComplete = isUnderstandingComplete(agent);
      const canAdvance =
        structComplete &&
        signals.base_analysis_ready === true &&
        userInput.trim() &&
        userInput !== "__OPENING__";

      if (canAdvance) {
        const lockedQuestion =
          signals.opening_problem_statement?.trim() || userInput.trim();
        next = { ...agent, original_question: lockedQuestion };
        nextState = "collecting_context";
        triggerCore = true;
        transitionReason = "Understanding structure complete, entering collection";
      } else if (signals.understanding_sufficient === true && !structComplete) {
        transitionReason =
          "Model reported sufficient but understanding structure incomplete (control plane blocked)";
        console.info("[poju-gate] blocked opening→collecting", {
          model_sufficient: true,
          missing: getUnderstandingMissingFields(agent),
        });
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

      const updated = agenda.map((a) => {
        if (!focus || a.label !== focus.label) return a;

        if (reported.has(a.label) && hasUserInput) {
          return { ...a, status: "covered" as const, stale_turns: 0 };
        }

        if (hasUserInput) {
          const nextStatus = a.status === "partial" ? ("covered" as const) : ("partial" as const);
          return {
            ...a,
            status: nextStatus,
            stale_turns: nextStatus === "covered" ? 0 : a.stale_turns,
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
        nextState = "delivery";
        triggerDelivery = true;
        transitionReason = "User confirmed, generating delivery";
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
    trigger_delivery: triggerDelivery,
    show_new_session_button: showNewSession,
    transition_reason: transitionReason,
  };
}
