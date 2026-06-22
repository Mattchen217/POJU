import {
  MIN_COLLECTING_USER_TURNS,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { isAgendaSatisfied } from "@/lib/poju/investigation-agenda";
export type CollectionProgress = "advancing" | "stalled" | "resistant";
export type DeliveryMode = "full" | "degraded";

/** Consecutive stall/resistant rounds before suggesting refund (after stall-offer path). */
export const REFUND_SUGGEST_THRESHOLD = 3;

export type CollectingEscalationLevel =
  | "none"
  | "L1"
  | "L2"
  | "L3"
  | "refund"
  | "delivery_pullback";

/** Minimum collecting Q&A rounds before allowing confirmation. */
export const MIN_COLLECTING_TURNS = MIN_COLLECTING_USER_TURNS;
/** Hard cap on collecting turns — triggers degraded delivery (stop-loss). */
export const MAX_COLLECTING_TURNS = 12;
/** Consecutive stalled/resistant rounds before stop-loss. */
export const STALL_STOP_LOSS_THRESHOLD = 2;

export function parseCollectionProgress(raw: unknown): CollectionProgress | null {
  if (raw === "advancing" || raw === "stalled" || raw === "resistant") return raw;
  return null;
}

export function nextStallCount(current: number, progress: CollectionProgress): number {
  if (progress === "advancing") return 0;
  return current + 1;
}

export interface StopLossEvaluation {
  triggered: boolean;
  reason: string | null;
}

export function evaluateStopLoss(input: {
  stall_count: number;
  collection_progress: CollectionProgress | null;
  collecting_turn_count: number;
}): StopLossEvaluation {
  if (input.collection_progress === "resistant") {
    return { triggered: true, reason: "User resistant this turn" };
  }
  if (input.stall_count >= STALL_STOP_LOSS_THRESHOLD) {
    return {
      triggered: true,
      reason: `Consecutive stall/resist ≥${STALL_STOP_LOSS_THRESHOLD}`,
    };
  }
  if (input.collecting_turn_count >= MAX_COLLECTING_TURNS) {
    return {
      triggered: true,
      reason: `Collecting turn cap (${MAX_COLLECTING_TURNS})`,
    };
  }
  return { triggered: false, reason: null };
}

/** Pre-LLM tier for collecting-phase prompt injection (stall_count + pullback flags). */
export function resolvePreCallEscalation(input: {
  agent?: POJUAgentState | null;
  collecting_pullback?: boolean;
}): CollectingEscalationLevel {
  if (input.collecting_pullback) return "delivery_pullback";
  const agent = input.agent;
  if (!agent) return "L1";
  const stall = agent.stall_count ?? 0;
  if (stall >= REFUND_SUGGEST_THRESHOLD) return "refund";
  if (agent.resume_collecting_low_barrier) return "refund";
  if (stall >= 1) return "L2";
  return "L1";
}

/** Post-LLM: offer refund entry (never auto-refund). Skipped when stall_offer replaces the turn. */
export function shouldSuggestRefund(input: {
  agent: POJUAgentState;
  collection_progress: CollectionProgress;
  stall_offer?: boolean;
}): boolean {
  if (input.stall_offer) return false;
  const projected = nextStallCount(input.agent.stall_count ?? 0, input.collection_progress);
  if (projected >= REFUND_SUGGEST_THRESHOLD) return true;
  if (input.agent.resume_collecting_low_barrier && input.collection_progress === "resistant") {
    return true;
  }
  return false;
}

/** Block confirmation while turns or agenda coverage below gate. */
export function isPrematureCollectingPhase(
  state: POJUAgentState,
  userTurnCount: number,
): boolean {
  const turns = state.turn_count ?? userTurnCount;
  if (turns < MIN_COLLECTING_USER_TURNS) return true;
  const agenda = state.investigation_agenda ?? [];
  if (agenda.length === 0) return true;
  return !isAgendaSatisfied(agenda);
}

export function projectCollectingStopLoss(
  agent: POJUAgentState,
  collection_progress: CollectionProgress | null,
  isCollectingTurn: boolean,
): {
  counters: Pick<POJUAgentState, "stall_count" | "collecting_turn_count">;
  stopLoss: StopLossEvaluation;
} {
  const counters = applyCollectingTurnCounters(agent, {
    isCollectingTurn,
    collection_progress,
  });
  const stopLoss =
    isCollectingTurn && collection_progress != null
      ? evaluateStopLoss({
          stall_count: counters.stall_count,
          collection_progress,
          collecting_turn_count: counters.collecting_turn_count,
        })
      : { triggered: false, reason: null };
  return { counters, stopLoss };
}

export function applyCollectingTurnCounters(
  agent: POJUAgentState,
  input: {
    isCollectingTurn: boolean;
    collection_progress: CollectionProgress | null;
  },
): Pick<POJUAgentState, "stall_count" | "collecting_turn_count"> {
  const stall_count = agent.stall_count ?? 0;
  const collecting_turn_count = agent.collecting_turn_count ?? 0;

  if (!input.isCollectingTurn) {
    return { stall_count, collecting_turn_count };
  }

  const nextCollectingTurns = collecting_turn_count + 1;
  const progress = input.collection_progress;
  const nextStall =
    progress != null ? nextStallCount(stall_count, progress) : stall_count;

  return {
    stall_count: nextStall,
    collecting_turn_count: nextCollectingTurns,
  };
}
