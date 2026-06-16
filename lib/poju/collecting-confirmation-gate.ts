import {
  findMissingFields,
  type POJUAgentState,
  type QuestionCategory,
} from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";

export const MAJOR_QUESTION_CATEGORIES = ["career", "relationship", "decision"] as const;
export const MIN_MAJOR_COLLECTING_USER_TURNS = 3;

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
  if (!isMajorQuestionCategory(state.question_category)) return true;
  return userTurnCount >= MIN_MAJOR_COLLECTING_USER_TURNS;
}

export interface CollectingConfirmationGateResult {
  allowed: boolean;
  reason: string;
}

export function evaluateCollectingConfirmationGate(
  state: POJUAgentState,
  userTurnCount: number,
): CollectingConfirmationGateResult {
  if (!areRequiredFieldsComplete(state)) {
    return { allowed: false, reason: "Required fields incomplete" };
  }
  if (!meetsCollectingTurnMinimum(state, userTurnCount)) {
    return {
      allowed: false,
      reason: `Major topic requires ≥${MIN_MAJOR_COLLECTING_USER_TURNS} user turns`,
    };
  }
  return { allowed: true, reason: "Required fields complete and turn minimum met" };
}

export function userExplicitlyRequestsConfirmation(userMessage: string): boolean {
  return /(?:差不多了|可以分析了|你来说吧|开始分析|可以了|够了|tell me|ready for analysis|go ahead|you can analyze)/i.test(
    userMessage,
  );
}
