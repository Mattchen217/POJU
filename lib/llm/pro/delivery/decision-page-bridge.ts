/**
 * 01–08 是页 id 真源。v1 出稿键是薄别名，折进这些脸：
 * - 书架槽：`deliveryShelfSlotIds`（cover、toc、01、02、04、05、06、题相关 07、08、03）
 * - 脸级 zod：`shelf-face-schema.ts` / `face-types.ts`。新书 `page`=`face`=01–08
 * - `resolveCanonicalDeliveryPage` 返回脸。新书 `resolveDeliverySegmentKey("06")` 即为脸 id
 * - DAG / Lab 任务 id 以脸为干（一脸一填）
 *
 * 07 题相关才进阅读序；写路径仍是 face 07 + sliceForPage。
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

/**
 * New books: one face id = one generator key.
 * Legacy paper aliases remain readable via page-id-remap (old sessions only).
 */
const SHELF_KEYS_BY_PAGE: Record<DecisionPageId, readonly string[]> = {
  "01": ["01"],
  "02": ["02"],
  "04": ["04"],
  "05": ["05"],
  "06": ["06"],
  "07": ["07"],
  "08": ["08"],
  "03": ["03"],
};

const PRIMARY_SHELF_KEY: Record<DecisionPageId, string | null> = {
  "01": "01",
  "02": "02",
  "04": "04",
  "05": "05",
  "06": "06",
  "07": "07",
  "08": "08",
  "03": "03",
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
