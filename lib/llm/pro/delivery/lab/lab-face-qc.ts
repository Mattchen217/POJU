/**
 * Lab face QC helpers — slice feed, topic gate, quality checklist, assemble faces.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { isFaceDeliveryKey } from "@/lib/llm/pro/delivery/pipeline-v3/gate-face-format";
import {
  chartPackFromDeliveryText,
  formatPageFeedAllowlistHeader,
} from "@/lib/llm/pro/delivery/page-slice-feed";
import {
  deliveryTopicFromSignals,
  page07Applies,
  readingOrderForTopic,
  sliceForPage,
  sliceStaysInAllowlist,
  type PageFeedPacks,
  type PageSliceResult,
} from "@/lib/llm/pro/delivery/slice-for-page";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import { ensureLabZiweiFactPack } from "@/lib/ziwei/lab-ziwei";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";

export const FACE_QUALITY_CHECK_IDS = [
  "dual_track_holds",
  "01_points_to_02",
  "05_real_options",
  "06_action_done_look",
  "collapses_without_slice",
  "07_no_marriage_scare",
] as const;

export type FaceQualityCheckId = (typeof FACE_QUALITY_CHECK_IDS)[number];

export const FACE_QUALITY_CHECK_LABELS: Record<FaceQualityCheckId, string> = {
  dual_track_holds: "02/07 双轨站得住",
  "01_points_to_02": "01 带条件主推可指回 02",
  "05_real_options": "05 真选项（非空泛平衡）",
  "06_action_done_look": "06 动作类型+完成样貌（非勾选）",
  collapses_without_slice: "删切片后主张垮",
  "07_no_marriage_scare": "07 无合婚恐吓",
};

export type FaceQualityReview = {
  checks: Partial<Record<FaceQualityCheckId, boolean>>;
  notes: string;
  updated_at: string;
};

export function asFaceId(key: string | undefined | null): DecisionPageId | null {
  if (!key) return null;
  return (DECISION_PAGE_IDS as readonly string[]).includes(key)
    ? (key as DecisionPageId)
    : null;
}

export function labTopic(lab: DeliveryLabSession): string | null {
  return deliveryTopicFromSignals({
    question: lab.source.original_question,
  });
}

export function buildLabPageFeedPacks(
  lab: DeliveryLabSession,
  opts?: { ziwei?: ZiweiFactPack | null },
): PageFeedPacks {
  const pre = lab.artifacts.prealloc as
    | { chart_fact_pack?: string }
    | undefined;
  const chart = chartPackFromDeliveryText(pre?.chart_fact_pack);
  const question = lab.source.original_question?.trim() ?? "";
  const topic = labTopic(lab);
  const ziwei =
    opts?.ziwei !== undefined
      ? opts.ziwei
      : ensureLabZiweiFactPack(lab);
  return {
    chart,
    zfp: ziwei ?? null,
    topic,
    user: question
      ? { Q: question, expect: question, detail: question }
      : null,
  };
}

export type LabFaceSliceFeed = {
  faceId: DecisionPageId;
  sliced: PageSliceResult;
  user_feed: string;
  allowlist_ok: boolean;
  zfpOmitted: boolean;
};

/** Force user_feed = slice JSON + allowlist ✓/✗ (Lab QC contract). */
export function buildLabFaceSliceFeed(
  lab: DeliveryLabSession,
  key: DeliverySegmentKey | string,
  opts?: { ziwei?: ZiweiFactPack | null },
): LabFaceSliceFeed | null {
  const faceId = asFaceId(key);
  if (!faceId) return null;
  const packs = buildLabPageFeedPacks(lab, opts);
  const sliced = sliceForPage(faceId, packs);
  const allowlist_ok = sliceStaysInAllowlist(faceId, sliced.slice);
  const header = formatPageFeedAllowlistHeader(faceId) ?? "";
  const mark = allowlist_ok
    ? "sliceStaysInAllowlist ✓"
    : "sliceStaysInAllowlist ✗ · 越权键红标";
  const user_feed = [
    header,
    `## ${mark}`,
    `zfpOmitted=${sliced.zfpOmitted}`,
    `## 本页切片（JSON.stringify(sliceForPage("${faceId}"))）`,
    JSON.stringify(sliced.slice, null, 2),
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    faceId,
    sliced,
    user_feed,
    allowlist_ok,
    zfpOmitted: sliced.zfpOmitted,
  };
}

export type TopicGateResult = {
  topic: string | null;
  applies: boolean;
  reason: string;
  unlock_07_chain: boolean;
};

export function evaluateTopicGate(lab: DeliveryLabSession): TopicGateResult {
  const topic = labTopic(lab);
  const applies = page07Applies(topic);
  if (applies) {
    return {
      topic,
      applies: true,
      reason: `题门命中 topic=${topic}；解锁 Face 07 主链。`,
      unlock_07_chain: true,
    };
  }
  return {
    topic,
    applies: false,
    reason: topic
      ? `topic=${topic} 不在 page07Applies 集合；跳过 07 整链。`
      : "未从问题抽出场域 topic；跳过 07 整链。",
    unlock_07_chain: false,
  };
}

export function topicGateUnlocks07(lab: DeliveryLabSession): boolean {
  const gate = lab.steps["07.gate_topic"];
  if (!gate || gate.status !== "approved") return false;
  const last = gate.attempts[gate.attempts.length - 1];
  const out = last?.output_to_next_stage as
    | { applies?: boolean; unlock_07_chain?: boolean }
    | undefined;
  return Boolean(out?.applies || out?.unlock_07_chain);
}

/** Face pages ready for companion seal (01 + 05). */
export function companionFaceBriefReady(lab: DeliveryLabSession): boolean {
  const f01 = lab.artifacts.by_page["01" as DeliverySegmentKey]?.page_schema;
  const f05 = lab.artifacts.by_page["05" as DeliverySegmentKey]?.page_schema;
  return Boolean(f01 && f05);
}

export function collectAssembleFacePages(lab: DeliveryLabSession): {
  order: DecisionPageId[];
  topic: string | null;
  pages: Array<{
    faceId: DecisionPageId;
    title: string;
    dualTrack: string;
    page_schema: unknown | null;
  }>;
} {
  const topic = labTopic(lab);
  const order = readingOrderForTopic(topic);
  const pages = order.map((faceId) => {
    const schema = DECISION_PAGE_SCHEMAS[faceId];
    const art = lab.artifacts.by_page[faceId as DeliverySegmentKey];
    return {
      faceId,
      title: schema.title,
      dualTrack: schema.dualTrack,
      page_schema: art?.page_schema ?? null,
    };
  });
  return { order, topic, pages };
}

export function isFaceLabStepKey(page: string | undefined): boolean {
  return Boolean(page && isFaceDeliveryKey(page));
}
