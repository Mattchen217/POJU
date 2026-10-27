/**
 * 01–08 是书架脸。内部出稿键仍是 v1，折进这些脸：
 * - 书架槽：`deliveryShelfSlotIds`（cover、toc、01、02、04、05、06、题相关 07、08、03）
 * - 脸级 zod：`shelf-face-schema.ts`。生成槽 `DeliveryPageSchemaByKey` 仍按内部键
 * - `resolveDeliverySegmentKey("06")` 落到 execution_guidance。07 与 03 没有内部键
 * - duty 仍按内部键写。书架上 06 是一页，08 是一页
 * - `pageFeedFlags("06")` 用近步旗标；`shelfFaceFeed("06")` 同时给出 06-C
 * - DAG 任务 id 仍是内部键。`shelfFaceDispatchKeys` 把它们收成一页
 *
 * 07 没有内部纸，也没有 DAG 任务。题目打开时，读路径用页骨架写一页。
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
