/**
 * Call A0 — calc relevance plan (model reads question → picks calc families).
 * Code validates anchors against closed-set inventory afterward.
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
先读用户困境与期望，再决定本盘应动哪些本地真算族、拟做多维真算的维度名(3–6个)。
禁止输出多维判断正文、禁止收敛主辅、禁止写 response。

calc_families 只能从闭集选: ${CALC_FAMILY_IDS.join(", ")}

reckoning_dimensions: 每个维度名 + required_anchors(须来自下方 compact 索引里的闭集实例名)

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

  const calc_families: CalcFamilyId[] = [];
  if (Array.isArray(o.calc_families)) {
    for (const f of o.calc_families) {
      if (typeof f === "string" && isCalcFamilyId(f)) calc_families.push(f);
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

/** Fallback when A0 fails — category-driven defaults. */
export function fallbackCalcRelevancePlan(
  questionCategory: string | null,
  originalQuestion: string,
): CalcRelevancePlan {
  const cat = questionCategory ?? "other";
  const families: CalcFamilyId[] = [
    "topic_typed",
    "dayun_pace",
    "pack_yong_ji",
    "pack_dashboard",
    "ten_god_pillars",
  ];
  if (cat === "relationship" || cat === "interpersonal" || cat === "family") {
    families.push("directed_relations", "shen_sha");
  }
  if (cat === "career" || cat === "wealth") {
    families.push("directed_relations", "pattern");
  }
  return {
    problem_focus: originalQuestion.slice(0, 120) || "用户困境",
    desired_outcome_lens: "用户期望方向",
    calc_families: [...new Set(families)],
    reckoning_dimensions: [
      { dimension: "结构张力", required_anchors: [] },
      { dimension: "阶段节奏", required_anchors: [] },
      { dimension: "用忌极性", required_anchors: [] },
    ],
  };
}
