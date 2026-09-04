/**
 * Call A0 — calc relevance plan (model reads question → picks calc families).
 * Code validates anchors against closed-set inventory afterward.
 *
 * Default: feed nearly all families into Segment-2. Exclude at most 1–2 that are
 * clearly irrelevant — never the old “pick 3–6 and drop half” stance.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { POJUAgentState } from "@/lib/poju/agent-state";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { formatSegment1UnderstandingForPrompt } from "@/lib/poju/agent-state";
import { buildCompactInventoryIndex } from "@/lib/calculations/build-calc-slice-from-plan";

/** Closed-set calc family ids the model may reference. */
export const CALC_FAMILY_IDS = [
  "topic_typed",
  "directed_relations",
  "natal_relations",
  "dayun_pace",
  "pack_yong_ji",
  "pack_dashboard",
  "ten_god_pillars",
  "shen_sha",
  "life_stage",
  "element_scores",
  "strength",
  "pattern",
] as const;

export type CalcFamilyId = (typeof CALC_FAMILY_IDS)[number];

/** Max families A0 may drop; fewer selected → code expands to full set. */
export const CALC_FAMILY_MAX_EXCLUDE = 2;

export type CalcRelevanceDimensionPlan = {
  dimension: string;
  required_anchors: string[];
};

export type CalcRelevancePlan = {
  problem_focus: string;
  desired_outcome_lens: string;
  calc_families: CalcFamilyId[];
  reckoning_dimensions: CalcRelevanceDimensionPlan[];
};

const A0_TASK = `【Call A0 · 相关性规划 · 唯一产出】
先读用户困境与期望，再决定本盘应动哪些本地真算族、拟做多维真算的维度名。
禁止输出多维判断正文、禁止收敛主辅、禁止写 response。

# calc_families（硬 · 默认全量）
闭集共 ${CALC_FAMILY_IDS.length} 类: ${CALC_FAMILY_IDS.join(", ")}
- 【默认】把闭集【几乎全部】写入 calc_families（含 life_stage / shen_sha / natal_relations 等），供后续假设腿真算。
- 【排除上限】最多排除 ${CALC_FAMILY_MAX_EXCLUDE} 类，且仅当该类与本题【确定完全无关】时才可省略；禁止先收窄到 3–6 类再猜。
- 拿不准是否相关 → 【保留】该类，不要排除。

reckoning_dimensions: 维度名按本题需要自定数量(勿人为压到很少) + required_anchors(须来自下方 compact 索引里的闭集实例名)

输出 JSON:
{
  "problem_focus": "一句",
  "desired_outcome_lens": "一句",
  "calc_families": ["..."],
  "reckoning_dimensions": [
    { "dimension": "...", "required_anchors": ["..."] }
  ]
}`;

export function buildCalcRelevancePlanPrompt(input: {
  structured: ProfileStructured;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
  questionCategory: string | null;
}): { system: string; user: string } {
  const segment1 = input.agent_v2
    ? formatSegment1UnderstandingForPrompt(input.agent_v2)
    : "（无 segment1）";
  const compactIndex = buildCompactInventoryIndex(input.structured, {
    questionCategory: input.questionCategory,
  });

  const system = stitchPromptSections(
    buildOutputPolicyForPoju(),
    A0_TASK,
  );

  const user = `【locale】${input.locale}

【第1段理解】
${segment1}

【用户原始问题】
"${input.original_question}"

【问题类别】
${input.questionCategory ?? "other"}

【本盘闭集索引 · 只能引用这里出现的实例】
${compactIndex}

只输出 calc_relevance_plan JSON。`;

  return { system, user };
}

function isCalcFamilyId(v: string): v is CalcFamilyId {
  return (CALC_FAMILY_IDS as readonly string[]).includes(v);
}

/**
 * Expand under-narrowed family lists to the full closed set.
 * Trusts the model only when it kept ≥ (all − maxExclude) families.
 */
export function resolveCalcFamilies(selected: readonly CalcFamilyId[]): CalcFamilyId[] {
  const uniq = [...new Set(selected.filter(isCalcFamilyId))];
  const minKeep = CALC_FAMILY_IDS.length - CALC_FAMILY_MAX_EXCLUDE;
  if (uniq.length >= minKeep) return uniq;
  return [...CALC_FAMILY_IDS];
}

export class CalcRelevancePlanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalcRelevancePlanParseError";
  }
}

export function parseCalcRelevancePlan(raw: string): CalcRelevancePlan {
  let parsed: unknown;
  try {
    const t = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(t);
  } catch {
    throw new CalcRelevancePlanParseError("invalid_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CalcRelevancePlanParseError("not_object");
  }
  const o = parsed as Record<string, unknown>;
  const problem_focus = typeof o.problem_focus === "string" ? o.problem_focus.trim() : "";
  const desired_outcome_lens =
    typeof o.desired_outcome_lens === "string" ? o.desired_outcome_lens.trim() : "";
  if (!problem_focus) throw new CalcRelevancePlanParseError("missing_problem_focus");

  const rawFamilies: CalcFamilyId[] = [];
  if (Array.isArray(o.calc_families)) {
    for (const f of o.calc_families) {
      if (typeof f === "string" && isCalcFamilyId(f)) rawFamilies.push(f);
    }
  }

  const reckoning_dimensions: CalcRelevanceDimensionPlan[] = [];
  if (Array.isArray(o.reckoning_dimensions)) {
    for (const item of o.reckoning_dimensions) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const dimension = typeof row.dimension === "string" ? row.dimension.trim() : "";
      if (!dimension) continue;
      const anchors: string[] = [];
      if (Array.isArray(row.required_anchors)) {
        for (const a of row.required_anchors) {
          if (typeof a === "string" && a.trim()) anchors.push(a.trim());
        }
      }
      reckoning_dimensions.push({ dimension, required_anchors: anchors });
    }
  }

  const calc_families = resolveCalcFamilies(rawFamilies);

  if (calc_families.length === 0 && reckoning_dimensions.length === 0) {
    throw new CalcRelevancePlanParseError("empty_plan");
  }

  return {
    problem_focus,
    desired_outcome_lens,
    calc_families,
    reckoning_dimensions,
  };
}

/** Fallback when A0 fails — full family set (category only shapes dimension hints). */
export function fallbackCalcRelevancePlan(
  questionCategory: string | null,
  originalQuestion: string,
): CalcRelevancePlan {
  const cat = questionCategory ?? "other";
  const dims: CalcRelevanceDimensionPlan[] = [
    { dimension: "结构张力", required_anchors: [] },
    { dimension: "阶段节奏", required_anchors: [] },
    { dimension: "用忌极性", required_anchors: [] },
  ];
  if (cat === "relationship" || cat === "interpersonal" || cat === "family") {
    dims.push({ dimension: "关系场域", required_anchors: [] });
  }
  if (cat === "career" || cat === "wealth") {
    dims.push({ dimension: "事业资源轴", required_anchors: [] });
  }
  return {
    problem_focus: originalQuestion.slice(0, 120) || "用户困境",
    desired_outcome_lens: "用户期望方向",
    calc_families: [...CALC_FAMILY_IDS],
    reckoning_dimensions: dims,
  };
}
