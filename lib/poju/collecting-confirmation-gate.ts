import {
  canTransitionToConfirmation,
} from "@/lib/poju/investigation-agenda";
import {
  findMissingFields,
  MIN_COLLECTING_USER_TURNS,
  type POJUAgentState,
  type QuestionCategory,
} from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";

export const MAJOR_QUESTION_CATEGORIES = ["career", "relationship", "decision"] as const;
export const MIN_MAJOR_COLLECTING_USER_TURNS = MIN_COLLECTING_USER_TURNS;

export function countEffectiveCollectingTurns(session: POJUSessionState): number {
  return session.messages.filter((m) => m.role === "user" && !m.is_rejected).length;
}

export function isMajorQuestionCategory(category: QuestionCategory): boolean {
  return (
    category !== null &&
    (MAJOR_QUESTION_CATEGORIES as readonly string[]).includes(category)
  );
}

/** All general + category-specific required fields are filled. */
export function areRequiredFieldsComplete(state: POJUAgentState): boolean {
  if (!state.question_category) return false;
  const missing = findMissingFields(state);
  return missing.general.length === 0 && missing.category_specific.length === 0;
}

export function meetsCollectingTurnMinimum(state: POJUAgentState, userTurnCount: number): boolean {
  const turns = state.turn_count ?? userTurnCount;
  return turns >= MIN_COLLECTING_USER_TURNS;
}

export interface CollectingConfirmationGateResult {
  allowed: boolean;
  reason: string;
}

export function evaluateCollectingConfirmationGate(
  state: POJUAgentState,
  userTurnCount: number,
): CollectingConfirmationGateResult {
  const turns = state.turn_count ?? userTurnCount;
  const result = canTransitionToConfirmation({
    agent: state,
    userTurns: turns,
    userMessage: "",
  });
  if (result.allowed) {
    return { allowed: true, reason: result.reason };
  }
  if (turns < MIN_COLLECTING_USER_TURNS) {
    return {
      allowed: false,
      reason: `Requires ≥${MIN_COLLECTING_USER_TURNS} user turns (have ${turns})`,
    };
  }
  const agenda = state.investigation_agenda ?? [];
  if (agenda.length === 0) {
    return { allowed: false, reason: "Investigation agenda not yet generated" };
  }
  return { allowed: false, reason: result.reason };
}

/** @deprecated Use userHardPushed from investigation-agenda. */
export function userExplicitlyRequestsConfirmation(userMessage: string): boolean {
  return /(?:就现在给我结果|直接给结论|不用再问了|skip ahead|just give me (?:the )?(?:result|analysis)|don'?t need more questions)/i.test(
    userMessage,
  );
}
