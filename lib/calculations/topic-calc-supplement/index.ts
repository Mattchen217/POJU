export {
  findDirectionalWordingInRhythmSummary,
  assertRhythmSummaryNeutral,
  coerceNeutralRhythmSummary,
  RHYTHM_SUMMARY_BANNED_TOKENS,
} from "@/lib/calculations/topic-calc-supplement/rhythm-summary-neutral";
export type {
  TopicCalcSupplement,
  TopicCalcSupplementMeta,
  TopicCalcRhythmSignal,
  TopicCalcYongShenActivation,
  TopicCalcTopicSlice,
  TopicCalcThesisFeedHooks,
  TopicCalcPalace,
  YongShenElementStance,
} from "@/lib/calculations/topic-calc-supplement/types";
export {
  TOPIC_CALC_DEFAULT_PALACES,
  TOPIC_CALC_DEFAULT_TEN_GODS,
  TOPIC_CALC_AUTHORITY,
} from "@/lib/calculations/topic-calc-supplement/types";
export {
  buildTopicCalcSupplement,
  elementalStanceVsYong,
  computeTopicCalcRelations,
  buildRhythmSignalsFromRelations,
  type BuildTopicCalcSupplementInput,
} from "@/lib/calculations/topic-calc-supplement/build-topic-calc-supplement";
