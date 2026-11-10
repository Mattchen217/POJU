/**
 * Decision Intake 2.0 — Mainline M1/M2 public surface.
 */

export * from "./types";
export {
  interpretUserAnswer,
  activeTargets,
  classifyAnswer,
  writesFor,
  answerEventFromModelDraft,
  ANSWER_INTERPRETATION_VERSION,
  MODEL_ANSWER_INTERPRETER_VERSION,
} from "./answer-interpretation";
export {
  interpretAnswerWithModel,
  parseAndValidateModelAnswerDraft,
  buildModelInterpretationContext,
  ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS,
  MODEL_ANSWER_INTERPRETER_VERSION as MODEL_ANSWER_INTERPRETER_VERSION_MODEL,
} from "./answer-interpretation-model";
export { applyAnswerEventToSessionDc } from "./apply-answer-to-dc";
export {
  ensureDecisionBlueprint,
  activateNextBlueprintPriorityBand,
  directionIdForDir,
  blueprintAllowsDir,
  blueprintAllowsDdr,
  buildCatalogBlueprintScope,
  resolveDdrIdsForDir,
  gateClassForDirFromCatalog,
  mergeCatalogDirsIntoDc,
  seedDirFromDefinition,
} from "./blueprint";
export {
  classifyDecisionTopic,
  filterCatalogLegalIds,
} from "./topic-classify";
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
export {
  bootstrapFreshSessionMainLoop,
  M1R_STARTER_DIRS,
  __setM1rPersistForTests,
} from "./fresh-session-bootstrap";
export { projectAdaptiveQuestionForUi } from "./ui-projection";
export {
  confirmUnderstandingAndFreeze,
  isFinalUnderstandingConfirmText,
  isFinalUnderstandingAddMoreText,
  sessionReadyForFinalConfirm,
} from "./confirm-and-freeze";
export {
  M22_REPORT_SCHEMA_VERSION,
  M22_SNAPSHOT_SCHEMA_VERSION,
  freezeIdFromBinding,
  buildReportIdempotencyKey,
  loadAuthoritativeFreeze,
  verifyFrozenSnapshot,
  createFrozenReportSnapshot,
  deepFreezeValue,
  reportBindingFromSnapshot,
  defaultGeneratePage,
  assertCompleteEightPageReport,
  generateEightPageReport,
  createOrGetReportJob,
  requestFreezeBoundEightPageReport,
  retryFreezeBoundEightPageReport,
  getCompletedFreezeBoundReport,
  prepareFreezeBoundFinalDelivery,
  completeFreezeBoundReportFromDeliveryPages,
  releaseFreezeBoundReportClaim,
  failFreezeBoundReportJob,
  __resetFreezeBoundReportInFlightForTests,
  __createClaimOpsForTests,
  FreezeBoundReportError,
} from "./freeze-bound-report";
export type {
  FreezeBoundReportJobStatus,
  ReportBinding,
  FrozenReportSnapshot,
  FreezeBoundReportPage,
  FreezeBoundReportJob,
  EightPageReport,
  FreezeBoundReportDeps,
  FreezeBoundReportResult,
  FreezeReportClaimOps,
} from "./freeze-bound-report";
