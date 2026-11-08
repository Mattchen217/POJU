/**
 * Decision Intake 2.0 — Mainline M1 public surface.
 */

export * from "./types";
export { interpretUserAnswer } from "./answer-interpretation";
export { applyAnswerEventToSessionDc } from "./apply-answer-to-dc";
export { ensureDecisionBlueprint, directionIdForDir, blueprintAllowsDir } from "./blueprint";
export {
  buildUnderstandingState,
  evaluatePersonalPatternInsight,
  defaultBudget,
} from "./understanding-state";
export {
  validateScopeDepthBudget,
  bumpBudgetAfterAsk,
  DEFAULT_SOFT_BUDGET,
  DEFAULT_HARD_BUDGET,
  DEFAULT_DEPTH_CAP,
} from "./scope-budget";
export {
  generateQuestionText,
  buildAdaptiveQuestionPlan,
  assertQuestionMatchesPlan,
} from "./question-generation";
export {
  runAdaptiveQuestionTurn,
  attachAuthorizedAssistantQuestion,
} from "./adaptive-turn";
export { projectAdaptiveQuestionForUi } from "./ui-projection";
