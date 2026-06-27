import {
  evaluateAgendaCoverage,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";
import {
  normalizeAgentPhase,
  type AgentPhase,
  type POJUAgentState,
  createInitialAgentState,
} from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";

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
    flags: {
      relationship_conclusion_established: boolean;
      breakthrough_direction_confirmed: boolean;
      agenda_built: boolean;
    };
    agenda_checklist: { completed: string[]; pending: string[] };
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
  return {
    state_ledger: {
      current_state: agentPhaseToPojuState(agent.current_phase),
      original_question: agent.original_question ?? "",
      flags: {
        relationship_conclusion_established: Boolean(core?.relationship_conclusion),
        breakthrough_direction_confirmed: (core?.breakthrough_directions?.length ?? 0) > 0,
        agenda_built: agenda.length > 0,
      },
      agenda_checklist: {
        completed: agenda.filter((a) => a.status === "covered").map((a) => a.label),
        pending: agenda.filter((a) => a.status !== "covered").map((a) => a.label),
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
  topic_drift_signal?: "none" | "edge" | "off_topic";
  agenda_updates?: { completed_in_this_turn?: string[] };
  user_confirms_delivery?: boolean;
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
  understanding?: { sufficient?: boolean; missing?: string } | null;
  topic_drift_signal?: "none" | "edge" | "off_topic";
  agenda_updates?: { completed_in_this_turn?: string[] };
  user_confirms_delivery?: boolean;
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
    topic_drift_signal: source.topic_drift_signal,
    agenda_updates: source.agenda_updates,
    user_confirms_delivery: source.user_confirms_delivery,
  };
}

/** Minimum substantive opening turns before entering collecting (unless single message is rich). */
export const OPENING_RICH_CHARS = 80;
/** Minimum substantive opening turns when message is below OPENING_RICH_CHARS. */
export const OPENING_MIN_SUBSTANTIVE_TURNS = 2;

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
      const turns = signals.substantive_opening_turns ?? 0;
      const richSingle = userInput.trim().length >= OPENING_RICH_CHARS;
      const canAdvance =
        signals.understanding_sufficient === true &&
        signals.base_analysis_ready === true &&
        userInput.trim() &&
        userInput !== "__OPENING__" &&
        (richSingle || turns >= OPENING_MIN_SUBSTANTIVE_TURNS);

      if (canAdvance) {
        next = { ...agent, original_question: userInput.trim() };
        nextState = "collecting_context";
        triggerCore = true;
        transitionReason = richSingle
          ? "Rich single message, base analysis ready, entering collection"
          : "Substantive opening turns sufficient, entering collection";
      }
      break;
    }
    case "collecting_context": {
      const done = new Set(signals.agenda_updates?.completed_in_this_turn ?? []);
      const agenda = (agent.investigation_agenda ?? []).map((a) =>
        done.has(a.label) ? { ...a, status: "covered" as const } : a,
      );
      next = { ...agent, investigation_agenda: agenda };
      const cov = evaluateAgendaCoverage(agenda);
      if (cov.total > 0 && cov.criticalLeft === 0 && cov.coveredRatio >= 0.8) {
        nextState = "awaiting_confirmation";
        transitionReason = `Agenda satisfied (${Math.round(cov.coveredRatio * 100)}%)`;
      }
      break;
    }
    case "awaiting_confirmation": {
      if (signals.user_confirms_delivery === true) {
        nextState = "delivery";
        triggerDelivery = true;
        transitionReason = "User confirmed, generating delivery";
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
