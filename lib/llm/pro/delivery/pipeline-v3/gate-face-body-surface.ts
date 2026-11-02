/**
 * Face-native visible-body surface gate (Max iron rule 2026-11-01).
 *
 * User-visible face body = plain vernacular only.
 * Ban destiny/命理 classical jargon AND coined soft projections in body.
 * Soft/traditional allowed only in evidence-layer slots:
 *   verifiable_anchors / evidence_fold / evidence_pointer / chart_anchors.
 *
 * Wired via gateBodyCategoryB so content_body surface_deferred / surface_clean
 * and body_polish full surface both see the same ruler (Lab Face 02 #6 root cause:
 * faces previously fell through → always surface_clean).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { FACE_SEGMENT_FIELDS } from "@/lib/llm/pro/delivery/page-schema/face-types";
import { DECISION_PAGE_IDS, type DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { ContentGateVerdict } from "@/lib/llm/pro/delivery/pipeline-v3/gate-phase-a";
import { POJU_TERMS } from "@/lib/glossary/pojulife-terms";
import { isFaceDeliveryKey } from "@/lib/llm/pro/delivery/pipeline-v3/gate-face-format";

export const FACE_BODY_SURFACE_RULE_ID = "gate_face_body_visible_soft_or_destiny";

/** Evidence / anchor slots — soft + traditional OK here (dual-layer). */
const EVIDENCE_LAYER_KEYS = new Set([
  "verifiable_anchors",
  "evidence_fold",
  "evidence_pointer",
  "chart_anchors",
]);

/**
 * Classical destiny jargon in visible body (palace/star/god + elemental compounds).
 * Extends legacy VISIBLE_JARGON with 金土/木性/截伐-class hits that Lab Face 02 missed.
 */
export const FACE_BODY_DESTINY_JARGON_RE =
  /宫位|相冲|相害|相刑|冲刑害|半合|火局|大运|流年|流月|岁运|运岁|月令|时支|日支|奇门|死门|开门|休门|生门|伤门|杜门|景门|惊门|值符|值使|主客|客生主|客来生主|客克主|主生客|主克客|阴遁|阳遁|用神|喜神|忌神|忌旺|食神|食伤|伤官|偏印|正印|印星|财星|七杀|比劫|比肩|正财|偏财|官杀|命宫|财帛|官禄|迁移|仆役|田宅|福德|父母|夫妻|子女|兄弟|疾厄|紫微|天机|太阳|武曲|天同|廉贞|天府|太阴|贪狼|巨门|天相|天梁|七杀|破军|贪狼|化禄|化权|化科|化忌|[金木水火土]{2}|[金木水火土]性|截伐|截金|伐[金木水火土]|泄[金木水火土]|[金木水火土]泄|[金木水火土]旺/;

/**
 * Soft projections that FAIL human review when left in visible body
 * (STRUCTURE_SOFT_OK + coined stems). Keep in sync with phase10 isolation list.
 */
const STRUCTURE_SOFT_BODY_BAN: readonly string[] = [
  "核心定位域",
  "对照定位域",
  "生活领域图谱",
  "四向转化",
  "资源转化",
  "主动权转化",
  "认可转化",
  "摩擦转化",
  "长周期段",
  "年度周期",
  "核心驱动",
  "行动驱动",
  "行动落点域",
  "元素配置型",
  "同辈联结域",
  "伙伴关系域",
  "延续创造域",
  "资源流转域",
  "承压调适域",
  "流动切换域",
  "协作网络域",
  "职分事功域",
  "安顿根基域",
  "内在蓄养域",
  "来源支撑域",
  // stems without 域 — human FAIL examples
  "资源流转",
  "核心定位",
  "对照定位",
];

/** EN/camel soft surfaces that must not leak into latin body. */
const STRUCTURE_SOFT_BODY_BAN_LATIN: readonly string[] = [
  "CoreIdentityField",
  "CounterpartField",
  "LifeDomainMap",
  "FourShiftModes",
  "ResourceShift",
  "AgencyShift",
  "RecognitionShift",
  "FrictionShift",
  "LongCyclePhase",
  "YearlyCycle",
  "CoreDriver",
  "ActionDriver",
  "ActionDomain",
  "ElementalConfiguration",
  "Resource Flow Field",
  "Peer Bond Field",
  "Partnership Field",
  "Continuity Field",
  "Resilience Field",
  "Mobility Field",
  "Collab Network Field",
  "Role Craft Field",
  "Anchorage Field",
  "Inner Reserve Field",
  "Origin Support Field",
];

function collectZiweiSoftBodyBanSurfaces(): string[] {
  const out: string[] = [];
  for (const t of POJU_TERMS) {
    if (t.ns !== "ziwei") continue;
    for (const loc of ["zh", "en", "es", "de", "fr"] as const) {
      const s = String(t.term?.[loc] ?? "").trim();
      if (!s) continue;
      // Skip short common vernacular collisions (化解/使命/荣誉/文书…)
      if (loc === "zh" && s.length < 3) continue;
      if (loc === "zh" && s.length === 3 && !/[域轨型]$/.test(s) && !/转化|配置|周期|驱动|星轨/.test(s)) {
        // keep 3-char coined like 劫隙 only if clearly structural; skip everyday
        continue;
      }
      // Prefer structural soft: 域/星轨/转化/配置/周期/驱动 / Field/Track/Shift/Config
      const structuralZh =
        loc === "zh" &&
        (s.length >= 4 ||
          /域$|星轨$|转化$|配置型?$|周期$|驱动$|图谱$/.test(s) ||
          s.includes("星轨"));
      const structuralLatin =
        loc !== "zh" &&
        (/Field|Track|Shift|Config|Cycle|Driver|Domain|Map|Mode/i.test(s) ||
          /[A-Z][a-z]+[A-Z]/.test(s));
      if (structuralZh || structuralLatin) out.push(s);
    }
  }
  return out;
}

let _softBanSorted: string[] | null = null;

/** Longest-first soft ban list (zh + latin + SSOT ziwei structural soft). */
export function faceBodySoftBanSurfaces(): readonly string[] {
  if (_softBanSorted) return _softBanSorted;
  const set = new Set<string>([
    ...STRUCTURE_SOFT_BODY_BAN,
    ...STRUCTURE_SOFT_BODY_BAN_LATIN,
    ...collectZiweiSoftBodyBanSurfaces(),
  ]);
  _softBanSorted = [...set].sort((a, b) => b.length - a.length);
  return _softBanSorted;
}

function asFaceId(key: string): DecisionPageId | null {
  return (DECISION_PAGE_IDS as readonly string[]).includes(key)
    ? (key as DecisionPageId)
    : null;
}

/**
 * Visible body blob for a face page — excludes evidence-layer keys.
 * Always includes page_title / page_subtitle.
 */
export function faceVisibleBodyBlob(
  key: DeliverySegmentKey | string,
  page: DeliveryPageData | Record<string, unknown>,
): string {
  const faceId = asFaceId(String(key));
  const p = page as Record<string, unknown>;
  const parts: string[] = [
    String(p.page_title ?? ""),
    String(p.page_subtitle ?? ""),
  ];
  // Face 03 appendix slices are chart dumps (soft OK there); only chrome + contrast are body.
  const appendixSkip =
    faceId === "03"
      ? new Set(["bazi_slice", "ziwei_slice"])
      : null;
  if (faceId) {
    for (const { key: field } of FACE_SEGMENT_FIELDS[faceId]) {
      if (EVIDENCE_LAYER_KEYS.has(field)) continue;
      if (appendixSkip?.has(field)) continue;
      const v = p[field];
      if (Array.isArray(v)) {
        for (const item of v) parts.push(String(item ?? ""));
      } else {
        parts.push(String(v ?? ""));
      }
    }
  } else {
    // Unknown shape: scan all string fields except evidence keys
    for (const [k, v] of Object.entries(p)) {
      if (EVIDENCE_LAYER_KEYS.has(k)) continue;
      if (k === "page" || k === "face") continue;
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) {
        for (const item of v) if (typeof item === "string") parts.push(item);
      }
    }
  }
  return parts.join("\n");
}

export type FaceBodySurfaceHit = {
  kind: "destiny_jargon" | "soft_coined";
  hit: string;
};

/** Find first destiny or soft-coined leak in face visible body. */
export function findFaceBodySurfaceHit(visible: string): FaceBodySurfaceHit | null {
  const text = String(visible ?? "");
  if (!text.trim()) return null;

  const softHit = faceBodySoftBanSurfaces().find((s) => s.length >= 2 && text.includes(s));
  if (softHit) return { kind: "soft_coined", hit: softHit };

  const m = text.match(FACE_BODY_DESTINY_JARGON_RE);
  if (m) return { kind: "destiny_jargon", hit: m[0]! };

  return null;
}

export function faceBodySurfaceGateDetail(hit: FaceBodySurfaceHit): string {
  if (hit.kind === "soft_coined") {
    return `Face 可见正文含软投影/自造软词「${hit.hit}」。正文只许白话；软投影与传统真词只进依据折层/指针/可核对锚（D）。回改正文或润色后重跑——闸门不改稿。`;
  }
  return `Face 可见正文含命理专名/五行截伐类「${hit.hit}」。正文只许白话；真词只进依据折层/指针/可核对锚。回改正文或润色后重跑——闸门不改稿。`;
}

/**
 * Surface-class gate for face keys. null = clean or not a face key.
 * Call with surface=full (polish) to hard-fail; substance_only callers use
 * surfacePreview to label surface_deferred.
 */
export function gateFaceBodySurface(input: {
  key: DeliverySegmentKey | string;
  page_schema?: DeliveryPageData | Record<string, unknown> | null;
  surface?: "full" | "substance_only";
}): ContentGateVerdict | null {
  if (!input.page_schema) return null;
  if (!isFaceDeliveryKey(String(input.key))) return null;

  const surface = input.surface ?? "full";
  // Soft/destiny in body is surface-class — same as legacy VISIBLE_JARGON:
  // substance_only → null (content_body defers); full → hard-fail (polish / surfacePreview).
  if (surface === "substance_only") return null;

  const visible = faceVisibleBodyBlob(input.key, input.page_schema);
  const hit = findFaceBodySurfaceHit(visible);
  if (!hit) return null;

  return {
    passed: false,
    failed_rule: FACE_BODY_SURFACE_RULE_ID,
    detail: faceBodySurfaceGateDetail(hit),
    notes: [
      "gate_phase:b_early_body",
      "ruler:face_body_vernacular_iron",
      `surface:${surface}`,
      `kind:${hit.kind}`,
      `hit:${hit.hit.slice(0, 32)}`,
    ],
  };
}

export function buildFaceBodySurfaceAvoidanceForPolish(): string {
  return [
    `- \`${FACE_BODY_SURFACE_RULE_ID}\`（Max 铁律）：可见正文（含 page_title/subtitle、main_recommendation/conditions/not_choosing、destiny_reason/science_mechanism/convergence 等）= **纯白话**。`,
    `  禁命理专名报幕（宫星十神用忌干支岁运合冲、五行并写如金土/木性、截伐类）。`,
    `  禁软投影/自造软词进正文（如核心定位域、资源流转、资源转化、*Field/*Track/*Shift）。`,
    `  软投影与传统真词 **只** 进 evidence_pointer / evidence_fold / verifiable_anchors（D 锚）；禁改事实方向。`,
  ].join("\n");
}
