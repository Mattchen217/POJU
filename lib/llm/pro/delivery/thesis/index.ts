export type {
  ChartThesis,
  ChecklistItemStatus,
  ThesisCalcFeed,
  ThesisCalcFeedDimension,
  ThesisDimension,
  ThesisDimensionId,
  ThesisWuxingRelation,
} from "@/lib/llm/pro/delivery/thesis/types";

export {
  THESIS_ABSENT_SUMMARY_ZH,
  THESIS_DIMENSION_IDS,
  THESIS_DIMENSION_NAME_ZH,
  THESIS_EMPTY_CONCLUSION_ZH,
} from "@/lib/llm/pro/delivery/thesis/types";

export {
  extractThesisFingerprintPayload,
  fingerprintThesisStructured,
} from "@/lib/llm/pro/delivery/thesis/fingerprint";

export { buildThesisCalcFeed } from "@/lib/llm/pro/delivery/thesis/build-thesis-calc-feed";

export {
  buildChartThesisFromStructured,
  buildJudgmentCoreFromFeed,
} from "@/lib/llm/pro/delivery/thesis/build-judgment-core";

export { applyAgendaDepth } from "@/lib/llm/pro/delivery/thesis/apply-agenda-depth";
export { formatChartThesisForPrompt } from "@/lib/llm/pro/delivery/thesis/format-for-prompt";
export { extendThesisDimension } from "@/lib/llm/pro/delivery/thesis/extend-thesis-dimension";
export type { ExtendThesisResult } from "@/lib/llm/pro/delivery/thesis/extend-thesis-dimension";
export { validateAssignmentThesisCoverage } from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
export type { ThesisCoverageOpts } from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
export {
  detectKnownThirdPartyAgency,
  extractKnownThirdParties,
  isPartnershipFrictionSurface,
  isRelationshipFrictionSurface,
  partnershipFrictionInferenceTemplate,
  relationshipFrictionInferenceTemplate,
  softRepairThirdPartyAgencyProse,
} from "@/lib/llm/pro/delivery/thesis/third-party-agency";
export {
  buildThesisAssignMenu,
  groupAssignMenuByDimension,
  isAssignMenuEligibleSlug,
} from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
export type { ThesisAssignMenuItem } from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
