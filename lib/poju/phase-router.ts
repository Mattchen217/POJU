/**
 * Thin phase router — prefer this entry over importing agent.ts god-file branches.
 *
 * Opening + segment2 own their handlers; remaining phases still flow through agent.
 */
export {
  handleUserMessage,
  tryHandleRuleRejection,
  countSubstantiveOpeningTurns,
  extractOpeningProblem,
} from "@/lib/poju/agent";

export {
  applyUnderstandingGateSupplement,
  handleRetryOpeningUnderstanding,
  isOpeningControlPhase,
} from "@/lib/poju/phases/opening/control";

export {
  startSegment2AfterGateConfirm,
  startSegment2Regenerate,
  applySegment2PollSuccess,
  finalizeSegment2JobSuccess,
  finalizeSegment2JobFailure,
  createSegment2XhighJob,
  buildSegment2AnalysisReply,
  buildCollectingTransitionReplyFromCore,
  segment2CoreGenerationFailedMessage,
  segment2RegenerateButtonLabel,
} from "@/lib/poju/phases/segment2";
