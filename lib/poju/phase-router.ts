/**
 * Thin phase router — prefer this entry over importing agent.ts god-file branches.
 *
 * Today: opening-owned handlers live in phases/opening; other phases still flow through agent.
 * Next steps: segment2 / collecting / delivery / tracking each get their own control module.
 */
export {
  handleUserMessage,
  handleUnderstandingGateAction,
  handleRegenerateBreakthroughCore,
  tryHandleRuleRejection,
  countSubstantiveOpeningTurns,
  extractOpeningProblem,
} from "@/lib/poju/agent";

export {
  applyUnderstandingGateSupplement,
  handleRetryOpeningUnderstanding,
  isOpeningControlPhase,
} from "@/lib/poju/phases/opening/control";
