/**
 * 把 ChartFactPack / ZiweiFactPack 收成一页切片，供页级模型调用阅读。
 * 整包 text、十二宫索引、source 不进 user 消息。缺字段按 sliceForPage 省略。
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  PAGE_UNION_ALLOWLISTS,
  type DecisionPageId,
} from "@/lib/llm/pro/delivery/page-feed-matrix";
import { contentPageIdForLegacyKey } from "@/lib/llm/pro/delivery/page-id-remap";
import {
  sliceDumpKeys,
  sliceForPage,
  type CfpShortInput,
  type PageFeedPacks,
} from "@/lib/llm/pro/delivery/slice-for-page";
import type { ChartFactPack } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

/**
 * Ops Lab / call-trace: show which PageFeedMatrix fields this face may eat.
 * Does not dump values — only the allowlist contract for quality review.
 */
export function formatPageFeedAllowlistHeader(
  key: DeliverySegmentKey | string,
): string | null {
  const pageId = contentPageIdForLegacyKey(key) as DecisionPageId | null;
  if (!pageId) return null;
  const union = PAGE_UNION_ALLOWLISTS[pageId];
  if (!union) return null;
  return [
    `## PageFeedMatrix allowlist（face ${pageId} · 只列可喂字段，不含值）`,
    `user: ${union.user.join(", ") || "(none)"}`,
    `cfp: ${union.cfp.join(", ") || "(none)"}`,
    `zfp: ${union.zfp.join(", ") || "(none)"}`,
    `sci: ${union.sci === false ? "no" : union.sci}`,
  ].join("\n");
}

const QIMEN_MARK = "【奇门锁盘";

export function chartPackFromDeliveryText(text: string | null | undefined): ChartFactPack | null {
  const raw = text?.trim() ?? "";
  if (!raw) return null;
  const qimenAt = raw.indexOf(QIMEN_MARK);
  const bazi = (qimenAt >= 0 ? raw.slice(0, qimenAt) : raw).trim();
  if (!bazi) return null;
  const dayMaster = /^日主：\s*([^（(\n]+)/m.exec(bazi)?.[1]?.trim() ?? "";
  return { text: bazi, day_master: dayMaster, ganzhi: [], shen_sha: [] };
}

export function formatPageSliceFeed(input: {
  key: DeliverySegmentKey | string;
  chartText?: string | null;
  ziwei?: ZiweiFactPack | null;
  question?: string | null;
  topic?: string | null;
  locale?: string | null;
  cfp?: CfpShortInput | null;
  sciHooks?: string | readonly string[] | null;
  /** Prepend PageFeedMatrix allowlist header (Lab call-trace QC). Default false. */
  withAllowlistHeader?: boolean;
}): string | null {
  const pageId = contentPageIdForLegacyKey(input.key);
  if (!pageId) return null;
  const chart = chartPackFromDeliveryText(input.chartText);
  if (!chart && input.ziwei == null) {
    if (input.withAllowlistHeader) {
      return formatPageFeedAllowlistHeader(input.key);
    }
    return null;
  }
  const question = input.question?.trim() ?? "";
  const packs: PageFeedPacks = {
    chart,
    zfp: input.ziwei ?? null,
    cfp: input.cfp ?? null,
    topic: input.topic,
    locale: input.locale ?? "zh",
    user: question ? { Q: question, expect: question, detail: question } : null,
    sci: input.sciHooks ? { hooks: input.sciHooks } : null,
  };
  const sliced = sliceForPage(pageId, packs);
  const dumped = sliceDumpKeys(sliced.slice);
  if (dumped.length > 0) {
    throw new Error(`formatPageSliceFeed: refused dump keys ${dumped.join(",")}`);
  }
  const body = `## 本页切片（page ${pageId} · 只含 allowlist 里有值的键）\n${JSON.stringify(sliced.slice)}`;
  if (!input.withAllowlistHeader) return body;
  const header = formatPageFeedAllowlistHeader(input.key);
  return header ? `${header}\n\n${body}` : body;
}

/** 有切片就推进 user 消息，并告诉调用方不要再附整包事实档或闭集 inventory。 */
export function appendPageSliceFeed(
  parts: string[],
  input: Parameters<typeof formatPageSliceFeed>[0],
): boolean {
  const block = formatPageSliceFeed(input);
  if (!block) return false;
  parts.push(block);
  return true;
}
