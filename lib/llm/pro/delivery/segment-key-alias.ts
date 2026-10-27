/**
 * v1 九模块出稿 key · legacy 六页别名。
 * 运行时出稿列表见 delivery-schema DELIVERY_SEGMENT_KEYS。
 * 内容页结构真源（2026-10-27）是 page-feed-matrix 的 DecisionPageId；
 * 旧键映射见 page-id-remap.ts。本文件继续把旧会话读成 v1 键，不改读路径。
 */

/** Active prose pages (v1). appendix / thirty_day handled elsewhere. */
export const V1_DELIVERY_SEGMENT_KEYS = [
  "decision_brief",
  "situation_analysis",
  "personal_decision_patterns",
  "bottleneck_analysis",
  "strategic_options",
  "recommended_strategy",
  "execution_guidance",
  "self_regulation",
  "validation_risk",
  "validation_close",
] as const;

export type V1DeliverySegmentKey = (typeof V1_DELIVERY_SEGMENT_KEYS)[number];

/** Retired / legacy keys still appear in old sessions & transitional code. */
export type LegacyDeliverySegmentKey =
  | "direct_answer"
  | "foundation"
  | "science_action"
  | "metaphysics_action"
  | "risk_guard"
  | "signals_close"
  | "thirty_day";

export type DeliverySegmentKey = V1DeliverySegmentKey | LegacyDeliverySegmentKey;

/** Old six-page → canonical v1 (primary landing when one-to-many). */
export const LEGACY_SIX_TO_V1: Record<string, V1DeliverySegmentKey> = {
  direct_answer: "decision_brief",
  foundation: "situation_analysis",
  science_action: "execution_guidance",
  metaphysics_action: "self_regulation",
  risk_guard: "validation_risk",
  signals_close: "validation_close",
};

/** When reading old foundation/science blobs, also seed sibling pages empty — remap target only. */
export function canonicalizeDeliverySegmentKey(
  raw: string | null | undefined,
): V1DeliverySegmentKey | null {
  if (!raw) return null;
  const k = raw.trim();
  if ((V1_DELIVERY_SEGMENT_KEYS as readonly string[]).includes(k)) {
    return k as V1DeliverySegmentKey;
  }
  const fromSix = LEGACY_SIX_TO_V1[k];
  if (fromSix) return fromSix;
  return null;
}

/** Prompt/switch helpers: treat legacy id as its v1 twin. */
export function effectivePageKey(key: string): string {
  return canonicalizeDeliverySegmentKey(key) ?? key;
}
