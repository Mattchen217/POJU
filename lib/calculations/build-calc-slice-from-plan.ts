/**
 * Build prioritized calc slice from A0 plan + compact inventory fallback.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import { buildTopicTypedInventoryLine } from "@/lib/calculations/topic-typed-fields";
import { buildDayunPolarityInventoryLine } from "@/lib/calculations/dayun-polarity";
import {
  buildMetaphysicsPack,
  type MetaphysicsPack,
} from "@/lib/calculations/metaphysics-pack";
import type { CalcRelevancePlan } from "@/lib/llm/deepseek/calc-relevance-plan";
import { extractElementScoresRawFromBaseAnalysis } from "@/lib/poju/attach-metaphysics-pack";

export type CompactInventoryOptions = {
  questionCategory?: string | null;
};

/** One-line compact closed-set index — fallback safety net. */
export function buildCompactInventoryIndex(
  structured: ProfileStructured,
  opts?: CompactInventoryOptions,
): string {
  const shenSha = new Set<string>();
  const tenGods = new Set<string>();
  const lifeStages = new Set<string>();
  if (structured.pillars_detail) {
    for (const key of ["year", "month", "day", "hour"] as const) {
      const p = structured.pillars_detail[key];
      if (p.ten_god) tenGods.add(p.ten_god);
      for (const s of p.shen_sha ?? []) shenSha.add(s);
      if (p.life_stage_han) lifeStages.add(p.life_stage_han);
    }
  }
  const daYun = (structured.da_yun ?? [])
    .slice(0, 3)
    .map((d) => `${d.ganzhi}(${d.start_age}岁)`)
    .join("、");
  const topic = buildTopicTypedInventoryLine(structured, opts?.questionCategory);
  const dayun = buildDayunPolarityInventoryLine(structured, opts?.questionCategory);

  return [
    `神煞: ${[...shenSha].join("、") || "(无)"}`,
    `十神: ${[...tenGods].join("、") || "(无)"}`,
    `长生: ${[...lifeStages].join("、") || "(无)"}`,
    `大运样本: ${daYun || "(无)"}`,
    `用神: ${structured.yong_shen || "(无)"} | 忌神: ${(structured.ji_shen ?? []).join("、") || "(无)"}`,
    `强弱: ${structured.strength || "(无)"}`,
    topic,
    dayun,
  ]
    .filter(Boolean)
    .join("\n");
}

export type CalcSliceInput = {
  structured: ProfileStructured;
  plan: CalcRelevancePlan;
  questionCategory: string | null;
  base_analysis?: unknown;
  pack?: MetaphysicsPack | null;
};

function tryBuildPack(structured: ProfileStructured, base_analysis?: unknown): MetaphysicsPack | null {
  try {
    const raw = extractElementScoresRawFromBaseAnalysis(base_analysis);
    return buildMetaphysicsPack({
      structured,
      element_scores_raw: raw,
    });
  } catch {
    return null;
  }
}

export function buildSliceFromRelevancePlan(input: CalcSliceInput): string {
  const { structured, plan, questionCategory } = input;
  const pack = input.pack ?? tryBuildPack(structured, input.base_analysis);
  const families = new Set(plan.calc_families);
  const lines: string[] = [
    "【优先真算切片 · Call A0 选定】",
    `problem_focus: ${plan.problem_focus}`,
    `desired_outcome_lens: ${plan.desired_outcome_lens}`,
  ];

  if (families.has("topic_typed")) {
    lines.push(buildTopicTypedInventoryLine(structured, questionCategory));
  }
  if (families.has("dayun_pace")) {
    lines.push(buildDayunPolarityInventoryLine(structured, questionCategory));
  }
  if (families.has("directed_relations") || families.has("natal_relations")) {
    const { directedInventoryBlock } = resolveAgendaRelationContext(
      structured,
      questionCategory,
    );
    if (directedInventoryBlock) lines.push(directedInventoryBlock);
  }
  if (families.has("pack_yong_ji") || families.has("pack_dashboard")) {
    if (pack) {
      lines.push(
        `pack_yong_ji: yong=${pack.yong_shen.primary_yong_shen} ji=${pack.yong_shen.ji_shen.join(",") || "(无)"}`,
      );
      if (families.has("pack_dashboard")) {
        const d = pack.dashboard;
        lines.push(
          `pack_dashboard: output=${d.output_capacity} sustain=${d.sustain_capacity} resistance=${d.resistance_load}`,
        );
      }
    } else {
      lines.push("pack: (暂缺 — 用 structured 用神/忌神)");
    }
  }
  if (families.has("element_scores") && pack) {
    const e = pack.element_scores;
    lines.push(
      `element_scores: 木${e.wood} 火${e.fire} 土${e.earth} 金${e.metal} 水${e.water}`,
    );
  }
  if (families.has("strength")) {
    lines.push(`strength: ${structured.strength || "(无)"}`);
  }
  if (families.has("pattern") && structured.pattern) {
    lines.push(`pattern: ${structured.pattern}`);
  }
  if (families.has("ten_god_pillars") || families.has("shen_sha") || families.has("life_stage")) {
    lines.push(buildCompactInventoryIndex(structured, { questionCategory }));
  }

  if (plan.reckoning_dimensions.length > 0) {
    lines.push("【拟多维方向 · A0】");
    for (const d of plan.reckoning_dimensions) {
      lines.push(
        `- ${d.dimension}${d.required_anchors.length ? ` | 锚:${d.required_anchors.join("、")}` : ""}`,
      );
    }
  }

  lines.push("\n【闭集兜底索引】");
  lines.push(buildCompactInventoryIndex(structured, { questionCategory }));

  return lines.filter(Boolean).join("\n");
}

/** Warn if plan anchors not found in compact index (observability). */
export function validatePlanAnchorsInIndex(
  plan: CalcRelevancePlan,
  indexText: string,
): string[] {
  const missing: string[] = [];
  for (const d of plan.reckoning_dimensions) {
    for (const a of d.required_anchors) {
      if (a.length >= 2 && !indexText.includes(a)) missing.push(a);
    }
  }
  return missing;
}
