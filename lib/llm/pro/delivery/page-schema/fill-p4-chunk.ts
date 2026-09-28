/**
 * P4 compress fill · chunked invokes (quality-first).
 * Write already chunks 1 unit/xhigh; fill was one-shot 6 dims → thin look-through.
 * Chunk size 2: three invokes for a 6-unit page, then one full-page sanitize.
 */

import { chunkPaths } from "./deep-evidence-assign";
import type { DeepEvidencePlan } from "./deep-evidence-prompt";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";

/** Dims per fill invoke — keep prompt focused; still ≥1 moat class per chunk typically. */
export const P4_FILL_CHUNK_SIZE = 2;

export function shouldChunkP4CompressFill(
  key: DeliverySegmentKey,
  fill_mode: "full" | "compress" | undefined,
  plan: DeepEvidencePlan | null | undefined,
): boolean {
  return (
    key === "metaphysics_action" &&
    (fill_mode ?? "full") === "compress" &&
    (plan?.units.length ?? 0) >= 4
  );
}

export function sliceDeepEvidencePlanForFillChunk(
  plan: DeepEvidencePlan,
  chunkUnits: DeepEvidencePlan["units"],
): DeepEvidencePlan {
  return { page: plan.page, units: [...chunkUnits] };
}

export function buildP4FillChunks(
  plan: DeepEvidencePlan,
): DeepEvidencePlan["units"][] {
  return chunkPaths(plan.units, P4_FILL_CHUNK_SIZE);
}

export type P4FillChunkMeta = {
  index: number;
  total: number;
  include_page_chrome: boolean;
  parent_unit_count: number;
  paths: readonly string[];
};

/** Extra user-side instructions appended for a fill chunk. */
export function formatP4FillChunkUserHint(meta: P4FillChunkMeta): string {
  const paths = meta.paths.join("、");
  const chrome = meta.include_page_chrome
    ? "本枪同时写 page_title / page_subtitle / question_anchor / desired_outcome。"
    : "本枪不要重写页眉；只输出 page + dimensions（本枪 path）。";
  return [
    `【P4 fill 分枪 · ${meta.index + 1}/${meta.total}】整页共 ${meta.parent_unit_count} 维；本枪只写：${paths}（恰好 ${meta.paths.length} 条 dimensions，顺序对齐）。`,
    chrome,
    "跨枪去重：禁止复读其它枪已写的同一可指认动作；本枪按本枪 path 的批断 + 约束帧自写 means（禁抄跨案套话）。",
    "奇门 timing 枪：strategy 必须写出敌虚实（虚高/画饼/压出手位）+ 我方攻守 + 近窗或节奏差。",
    "论证绑定：每条 means 须能被本维批断证明「只对此人成立」；strategy 须扣住本维批断机制核（删批断后不得单独成立）。",
    "域硬：means 主语=局/气/场域/身心节奏；禁试水期/技术交付/不可替代性/每周固定工时/倒水窗边默认模板；主辅兼职全职只锚一句。",
    "禁剥薄：禁把 P3 工具句写进 strategy 后半/means（合同/条款/股权/律师…）；禁让对方同意/改变；禁水边/绿植物化——写了会被剥掉导致 means_thin。",
  ].join("\n");
}
