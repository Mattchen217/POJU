/**
 * Face-native page keys (01–08) are the generator order for new books.
 * v1 九模块出稿 key · legacy 六页别名 — 只读旧会话。
 * 内容页结构真源（2026-10-27）是 page-feed-matrix 的 DecisionPageId。
 */

/** New-book generator / assemble order (07 is topic-gated, inserted by shelf). */
export const FACE_DELIVERY_PAGE_KEYS = [
  "01",
  "02",
  "04",
  "05",
  "06",
  "08",
  "03",
] as const;

export type FaceDeliveryPageKey = (typeof FACE_DELIVERY_PAGE_KEYS)[number];

/** Active prose pages (v1). appendix / thirty_day handled elsewhere. Legacy read only. */
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

export type DeliverySegmentKey =
  | FaceDeliveryPageKey
  | "07"
  | V1DeliverySegmentKey
  | LegacyDeliverySegmentKey;

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
): V1DeliverySegmentKey | FaceDeliveryPageKey | "07" | null {
  if (!raw) return null;
  const k = raw.trim();
  if ((FACE_DELIVERY_PAGE_KEYS as readonly string[]).includes(k) || k === "07") {
    return k as FaceDeliveryPageKey | "07";
  }
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
