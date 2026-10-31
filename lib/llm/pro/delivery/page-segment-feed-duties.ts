/**
 * Per-page / per-segment CFP+ZFP feed duties for soft/body/pack prompts.
 *
 * Source of truth: PAGE_SEGMENT_ALLOWLISTS in page-feed-matrix.ts.
 * When zfpOmitted=true, ZFP lines are omitted (do not invent stars).
 * When zfpOmitted=false, list ZFP fields for that segment — but on-topic only:
 * use a listed field only when it supports this segment's claim; never dump the whole chart.
 */

import {
  DECISION_PAGE_IDS,
  PAGE_SEGMENT_ALLOWLISTS,
  type DecisionPageId,
  type FeedFieldCode,
  type PageSegmentId,
  type SegmentAllowlist,
} from "@/lib/llm/pro/delivery/page-feed-matrix";

export type SegmentFeedDutiesOpts = {
  /** When true, omit every ZFP.* line (紫微未稳 / no patternHits). */
  zfpOmitted?: boolean;
  /** Limit to these pages; default all DECISION_PAGE_IDS. */
  pages?: readonly DecisionPageId[];
  /** Title language. */
  locale?: string;
};

function isZfp(code: FeedFieldCode): boolean {
  return code.startsWith("ZFP.");
}

function isCfp(code: FeedFieldCode): boolean {
  return code.startsWith("CFP.");
}

function isUser(code: FeedFieldCode): boolean {
  return code.startsWith("User.");
}

function isSci(code: FeedFieldCode): boolean {
  return code.startsWith("Sci.");
}

function splitFields(
  seg: SegmentAllowlist,
  zfpOmitted: boolean,
): { cfp: string[]; zfp: string[]; user: string[]; sci: string[] } {
  const optional = new Set(seg.optionalFields);
  const cfp: string[] = [];
  const zfp: string[] = [];
  const user: string[] = [];
  const sci: string[] = [];
  for (const f of seg.fields) {
    const opt = optional.has(f) ? "（可选）" : "";
    const cell = `${f}${opt}`;
    if (isZfp(f)) {
      if (!zfpOmitted) zfp.push(cell);
    } else if (isCfp(f)) {
      cfp.push(cell);
    } else if (isUser(f)) {
      user.push(cell);
    } else if (isSci(f)) {
      sci.push(cell);
    }
  }
  return { cfp, zfp, user, sci };
}

function formatOneSegment(
  pageId: DecisionPageId,
  seg: SegmentAllowlist,
  zfpOmitted: boolean,
): string {
  if (seg.facts === "none") {
    return `- ${pageId}.${seg.id} ${seg.label}：不喂盘面字段${seg.note ? `（${seg.note}）` : ""}`;
  }
  const { cfp, zfp, user, sci } = splitFields(seg, zfpOmitted);
  const bits: string[] = [];
  if (cfp.length) bits.push(`CFP=[${cfp.join(", ")}]`);
  if (zfp.length) bits.push(`ZFP=[${zfp.join(", ")}]`);
  if (user.length) bits.push(`User=[${user.join(", ")}]`);
  if (sci.length) bits.push(`Sci=[${sci.join(", ")}]`);
  if (seg.facts === "optional" && zfpOmitted && !cfp.length && !user.length && !sci.length) {
    return `- ${pageId}.${seg.id} ${seg.label}：紫微未稳 · 整段可跳过`;
  }
  const role =
    cfp.length && zfp.length
      ? "双盘共担"
      : zfp.length && !cfp.length
        ? "紫微主担"
        : cfp.length
          ? "八字主担"
          : "非盘锚";
  const note = seg.note ? ` · ${seg.note}` : "";
  return `- ${pageId}.${seg.id} ${seg.label}（${role}）：${bits.join(" · ") || "（无字段）"}${note}`;
}

/**
 * Format segment-level CFP+ZFP duties for one page (face fill / body).
 */
export function formatPageSegmentFeedDuties(
  pageId: DecisionPageId,
  opts?: SegmentFeedDutiesOpts,
): string {
  const zfpOmitted = Boolean(opts?.zfpOmitted);
  const segs = PAGE_SEGMENT_ALLOWLISTS[pageId];
  if (!segs?.length) return "";
  const lines = segs.map((s) => formatOneSegment(pageId, s, zfpOmitted));
  const header =
    opts?.locale === "en"
      ? `## Page ${pageId} segment feed duties (CFP+ZFP · on-topic only)`
      : `## 本页段级喂料职责（CFP+ZFP · 相关才用 · 禁整盘灌段）`;
  const rules = zfpOmitted
    ? [
        "紫微未稳（zfpOmitted=true）：本页只写 CFP/User/Sci 列到的键；禁止编造宫星格局。",
        "段上未列的字段不要塞进该段。",
      ]
    : [
        "zfpOmitted=false：凡段上列了 ZFP 键，且本盘切片有值、且与本段主张相关 → 必须用到（自由传统词写入依据/批断；正文只用软投影白话）。",
        "段上列了但与本段无关 → 省略，勿硬塞整盘紫微。",
        "CFP 与 ZFP 是共担职责，不是「八字模板 + 紫微贴纸」——命理段应用两盘交叉支撑同一断语。",
        "段上未列的字段不要塞进该段。",
      ];
  return [header, ...rules, ...lines].join("\n");
}

/**
 * Format duties across pages (BookJudgmentPack one-shot / destiny shot).
 */
export function formatGlobalSegmentFeedDuties(opts?: SegmentFeedDutiesOpts): string {
  const zfpOmitted = Boolean(opts?.zfpOmitted);
  const pages = opts?.pages?.length
    ? opts.pages
    : (DECISION_PAGE_IDS as readonly DecisionPageId[]);
  const blocks: string[] = [];
  for (const pageId of pages) {
    const segs = PAGE_SEGMENT_ALLOWLISTS[pageId];
    if (!segs?.length) continue;
    blocks.push(
      `### Face ${pageId}`,
      ...segs.map((s) => formatOneSegment(pageId, s, zfpOmitted)),
    );
  }
  const header =
    opts?.locale === "en"
      ? `## Global segment feed duties (CFP+ZFP · on-topic)`
      : `## 全书段级喂料职责（CFP+ZFP · 相关才用 · 禁整盘灌段）`;
  const rules = zfpOmitted
    ? [
        "zfpOmitted=true：destiny 只写 CFP 锚；pattern_hits_used 可空。",
        "serves_face + serves_segment 必须对齐下表字段职责。",
      ]
    : [
        "zfpOmitted=false：destiny 单元落在下列含 ZFP 的段时，claim/anchors 须纳入相关紫微传统真词（本盘闭集），并在 pattern_hits_used 登记实际用到的 hit:id:level。",
        "无关段（如纯科学 B）不要硬塞紫微；含 ZFP 的命理段不要只写八字模板。",
        "CFP+ZFP 共担同一断语——禁止「八字正文 + 紫微贴纸」。",
        "serves_face + serves_segment 对齐下表；未列字段勿塞。",
      ];
  return [header, ...rules, ...blocks].join("\n");
}

export type { PageSegmentId };
