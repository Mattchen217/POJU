/**
 * Shared face fill/body prompt skeleton (§生成规格 C).
 * One template per face; shape from face zod; feed from sliceForPage only.
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { formatPageSegmentFeedDuties } from "@/lib/llm/pro/delivery/page-segment-feed-duties";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import {
  FACE_SEGMENT_FIELDS,
  faceFillShapeSkeleton,
} from "@/lib/llm/pro/delivery/page-schema/face-types";
import { faceSegmentLabel } from "@/lib/llm/pro/delivery/face-segment-locale";
import { deliveryTranslateTargetName } from "@/lib/llm/pro/delivery/delivery-locale";
import type { PageSliceResult } from "@/lib/llm/pro/delivery/slice-for-page";

const FACE_EXTRA_SYSTEM: Record<DecisionPageId, string> = {
  "01": "1–2 句主推+条件（从 pack claim 装配，禁复述题面）；D「依据见 02」须列本页全部 pack unit id（含 science），本页不展开论证矩阵。有 Formal Decision Context 时：主推必须与冻结 DC 的 confirmed facts / constraints 一致，不得把 hypothesis 写成已确认事实。",
  "02": "A+B+C 必出（只解释为何如此）；A=结构/精力白话（由 CFP+ZFP 共担推得；相关才用，禁贴纸；正文禁专名与软投影）；交汇禁手段处方；D≤6 行可核对锚（此处才允许传统/软）；禁十二宫全列。",
  "04": "卡点命名清楚；C 写成本不写灾祸；D 依据可折。",
  "05": "Product Stage4 P5：路径 2–4 条（可含隐藏/组合/分阶段/可逆/低成本试验路径，勿机械凑三个传统选项）；每条写清依据、成本、前置、风险、可逆性、退出；首选必须条件式推荐；填写 recommendation_conditions（未知/冲突如何改排序）与 evidence_trace；D 切轨/停止必出；缺数据≠不可行；禁把 Hypothesis 当事实；禁空泛「平衡」。",
  "06": "Product Stage4 P6：必须填写 verification_experiment 七字段（hypothesis/action/observe/window/success_criteria/if_fail/defer_costs）；优先低成本可逆验证；近步仍是动作类型+完成样貌，不是 to-do/30天勾选清单；禁虚构 KPI/成功概率；禁流日择日假日历。",
  "07": "边界双轨；无 otherChart 不编对方盘；禁合婚恐吓。",
  "08": "Product Stage4 P8：除红灯/问句/重跑外，必须填写 shared_core_metrics（与 P6 观察对象对齐）与 review_decision=continue|adjust|stop|rerun + rationale；专属指标不得替代共享核心指标；禁编造阈值；不展开全盘。",
  "03": "只列本题用到的锚；紫微未稳整段跳过，不注水假宫；不要求科学双段。",
};

export type FacePromptAlignHints = {
  /** 01 main recommendation summary for 05/07 align */
  main_recommendation_summary?: string;
  /** 05 path summary for 01/07 align */
  path_summary?: string;
};

export type BuildFacePromptInput = {
  faceId: DecisionPageId;
  locale: string;
  slice: PageSliceResult | { pageId: DecisionPageId; dump?: unknown };
  align?: FacePromptAlignHints;
  /** When true, ZFP lines omitted from segment feed duties. */
  zfpOmitted?: boolean;
  /** Product Stage 4: formal frozen Decision Context feed block (read-only). */
  decisionContextFeed?: string | null;
};

export function buildFaceSystemPrompt(input: BuildFacePromptInput): string {
  const { faceId, locale } = input;
  const schema = DECISION_PAGE_SCHEMAS[faceId];
  const lang = deliveryTranslateTargetName(locale);
  const zfpOmitted =
    input.zfpOmitted ??
    ("zfpOmitted" in input.slice && typeof (input.slice as PageSliceResult).zfpOmitted === "boolean"
      ? (input.slice as PageSliceResult).zfpOmitted
      : false);
  const segLines = schema.segments.map((s) => {
    const label = faceSegmentLabel(faceId, s.id, locale);
    const field = FACE_SEGMENT_FIELDS[faceId].find((f) => f.segmentId === s.id)?.key ?? s.id;
    return `- ${s.id} ${label} (JSON key: ${field}): ${s.duty}`;
  });
  const shape = faceFillShapeSkeleton(faceId);
  const feedDuties = formatPageSegmentFeedDuties(faceId, {
    zfpOmitted,
    locale,
  });

  return [
    `你只写 Face ${faceId}「${schema.title}」。读者问题：${schema.question}`,
    `输出语言 = ${lang} / locale=${locale}（整页一致，禁中英混排标题与正文）。`,
    `只填下列字段（face zod）；禁止 primary/backup、primary_toolkit/backup_toolkit；禁止写其他脸职责。`,
    `dualTrack=${schema.dualTrack}：${schema.dualTrackNote}`,
    `本脸加严：${FACE_EXTRA_SYSTEM[faceId]}`,
    `段职责：`,
    ...segLines,
    feedDuties,
    `双层（Max 铁律）：可见标题+A/B/C=纯白话（零命理专名——含裸词「命理」作报幕；零软投影/自造软词如「核心定位域」「资源流转」「资源转化」「金土/木性/截伐」）；传统真词与软投影只进批断/依据折层/指针/可核对锚（D），禁止贴贴纸式整盘灌段。`,
    `硬禁：恐吓红线（必散/大祸/克应逼迫/付费消灾）；编造未喂锚；把全文盘塞进本页。`,
    `输出必须是单个 JSON 对象，形状示意（填实值，勿留空字符串当交付）：`,
    "```json",
    JSON.stringify(shape, null, 2),
    "```",
  ].join("\n");
}

export function buildFaceUserPrompt(input: BuildFacePromptInput): string {
  const { faceId, slice, align } = input;
  const dump =
    "dump" in slice && slice.dump != null
      ? slice.dump
      : "segments" in slice
        ? slice
        : { pageId: faceId, note: "empty_slice" };

  const parts: string[] = [
    `本题切片（仅下列键，已按 PageFeedMatrix 裁切 face=${faceId}）：`,
    "```json",
    JSON.stringify(dump, null, 2),
    "```",
  ];

  if (input.decisionContextFeed?.trim()) {
    parts.push("", input.decisionContextFeed.trim());
  }

  if (faceId === "01" || faceId === "05" || faceId === "07") {
    const alignBits: string[] = [];
    if (align?.main_recommendation_summary?.trim()) {
      alignBits.push(`已定主推荐摘要：${align.main_recommendation_summary.trim()}`);
    }
    if (align?.path_summary?.trim()) {
      alignBits.push(`路径摘要：${align.path_summary.trim()}`);
    }
    if (alignBits.length) {
      parts.push("", "对齐用（勿另开盘字段）：", ...alignBits);
    }
  }

  parts.push("", "按 zod 输出 JSON（page 与 face 均为本脸 id）。");
  return parts.join("\n");
}

export function buildFacePromptPair(input: BuildFacePromptInput): {
  system: string;
  user: string;
} {
  return {
    system: buildFaceSystemPrompt(input),
    user: buildFaceUserPrompt(input),
  };
}
