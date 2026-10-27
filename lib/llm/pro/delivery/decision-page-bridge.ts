/**
 * 01–08 是页 id 真源。v1 出稿键是薄别名，折进这些脸：
 * - 书架槽：`deliveryShelfSlotIds`（cover、toc、01、02、04、05、06、题相关 07、08、03）
 * - 脸级 zod：`shelf-face-schema.ts`。填槽纸的 `page` 仍是别名，`face` 是脸 id
 * - `resolveCanonicalDeliveryPage` 返回脸。`resolveDeliverySegmentKey("06")` 仍落到主纸别名
 * - DAG 任务 id 以脸为干。折进来的纸在脸后面带别名
 * - `pageFeedFlags("06")` 用近步旗标；`shelfFaceFeed("06")` 同时给出 06-C
 *
 * 07 没有 DAG 任务。题目打开时，写路径是 `slice:07`（切片 + A–C + 用户问题）。
 */

import {
  DECISION_PAGE_IDS,
  type DecisionPageId,
} from "@/lib/llm/pro/delivery/page-feed-matrix";
import {
  contentPageIdForLegacyKey,
  remapRowForLegacyKey,
  type LegacyPageRemap,
} from "@/lib/llm/pro/delivery/page-id-remap";
import {
  DECISION_PAGE_SCHEMAS,
  type DecisionPageSchema,
} from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import { readingOrderForTopic } from "@/lib/llm/pro/delivery/slice-for-page";

export { page07Applies, readingOrderForTopic } from "@/lib/llm/pro/delivery/slice-for-page";

/** 一页内容可能对应多张现网纸。07 没有纸。 */
const SHELF_KEYS_BY_PAGE: Record<DecisionPageId, readonly string[]> = {
  "01": ["decision_brief"],
  "02": ["situation_analysis", "personal_decision_patterns"],
  "04": ["bottleneck_analysis", "personal_decision_patterns"],
  "05": ["strategic_options", "recommended_strategy"],
  "06": ["execution_guidance", "self_regulation"],
  "07": [],
  "08": ["validation_risk", "validation_close"],
  "03": ["appendix"],
};

const PRIMARY_SHELF_KEY: Record<DecisionPageId, string | null> = {
  "01": "decision_brief",
  "02": "situation_analysis",
  "04": "bottleneck_analysis",
  "05": "strategic_options",
  "06": "execution_guidance",
  "07": null,
  "08": "validation_risk",
  "03": "appendix",
};

export type DecisionPageRoute = {
  pageId: DecisionPageId;
  schema: DecisionPageSchema;
  /** 直接传入 01–08 时为 null。 */
  remap: LegacyPageRemap | null;
  /** 旧键落在新页的段，例如 self_regulation → 06-C。整页落地则为 null。 */
  segment: string | null;
  primaryShelfKey: string | null;
  shelfKeys: readonly string[];
};

export function shelfKeysForPage(pageId: DecisionPageId): readonly string[] {
  return SHELF_KEYS_BY_PAGE[pageId];
}

export function primaryShelfKeyForPage(pageId: DecisionPageId): string | null {
  return PRIMARY_SHELF_KEY[pageId];
}

/** Face id. V1 keys, legacy aliases, and face ids all land here. Retired keys return null. */
export function canonicalFaceId(raw: string | null | undefined): DecisionPageId | null {
  return resolveDecisionPage(raw)?.pageId ?? null;
}

export const resolveCanonicalDeliveryPage = canonicalFaceId;

/**
 * DAG id stem. The primary paper of a face is the face id.
 * A folded paper keeps its alias after the face: `06.self_regulation`.
 */
export function canonicalDispatchStem(raw: string): string {
  const key = raw.trim();
  const route = resolveDecisionPage(key);
  if (!route) return key;
  const paper = route.pageId === key ? route.primaryShelfKey : key;
  if (!paper || paper === route.primaryShelfKey) return route.pageId;
  return `${route.pageId}.${paper}`;
}

/** Old `p.decision_brief.fill` and new `p.01.fill` name the same task. */
export function equateDispatchTaskId(id: string): string {
  if (id === "finalize.assemble" || id === "wave_b.gate" || id === "assemble") return id;
  const finalized = /^finalize\.(.+)$/.exec(id);
  if (finalized) return `finalize.${canonicalDispatchStem(finalized[1] ?? id)}`;
  const step =
    "assign|write\\.c\\d+|write\\.merge|fill|mark(?:\\.c\\d+|\\.merge)?|ready";
  const matched = new RegExp(`^p\\.(.+)\\.(${step})$`).exec(id);
  if (!matched) return id;
  return `p.${canonicalDispatchStem(matched[1] ?? id)}.${matched[2]}`;
}

function asPageId(value: string): DecisionPageId | null {
  return (DECISION_PAGE_IDS as readonly string[]).includes(value) ? (value as DecisionPageId) : null;
}

/**
 * 旧出稿键、九模块键、或已经是 01–08 的 pageId → 内容页。
 * 退役键（thirty_day、rhythm、E）返回 null。
 */
export function resolveDecisionPage(raw: string | null | undefined): DecisionPageRoute | null {
  if (!raw?.trim()) return null;
  const key = raw.trim();
  const direct = asPageId(key);
  const remap = direct ? null : remapRowForLegacyKey(key);
  const pageId = direct ?? remap?.pageId ?? contentPageIdForLegacyKey(key);
  if (!pageId) return null;
  return {
    pageId,
    schema: DECISION_PAGE_SCHEMAS[pageId],
    remap,
    segment: remap?.segment ?? null,
    primaryShelfKey: primaryShelfKeyForPage(pageId),
    shelfKeys: shelfKeysForPage(pageId),
  };
}

/** 给调用方一个不依赖书架实现的阅读序。 */
export function decisionReadingOrder(topic?: string | null): DecisionPageRoute[] {
  return readingOrderForTopic(topic).map((pageId) => resolveDecisionPage(pageId)!);
}
