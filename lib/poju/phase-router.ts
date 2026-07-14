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
  startSegment2AgendaRegenerate,
  applySegment2PollSuccess,
  finalizeSegment2JobSuccess,
  finalizeSegment2JobFailure,
  finalizeSegment2ReportSuccess,
  finalizeSegment2AgendaBridgeSuccess,
  finalizeSegment2AgendaBridgeFailure,
  createSegment2XhighJob,
  createSegment2AgendaJob,
  buildSegment2AnalysisReply,
  buildCollectingTransitionReplyFromCore,
  segment2CoreGenerationFailedMessage,
  segment2RegenerateButtonLabel,
  segment2RegenerateQuestionButtonLabel,
  SEGMENT2_INPUT_LOCK_HARD_MS,
} from "@/lib/poju/phases/segment2";
