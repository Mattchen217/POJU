/**
 * Pipeline v3 · Step2 Phase A gate — shape + early Phase B categories.
 * Never mutates draft. Human review covers remaining soft quality.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { gateJudgmentCategoryB } from "@/lib/llm/pro/delivery/pipeline-v3/gate-judgment-category";

export type ContentGateVerdict = {
  passed: boolean;
  failed_rule?: string;
  detail?: string;
  notes: string[];
};

/**
 * Phase A: draft present + minimal JSON shape for Lab preview.
 * Early Phase B: already-repeated judgment categories (只验不改).
 */
export function gateContentPhaseA(input: {
  key: DeliverySegmentKey;
  page_schema: DeliveryPageData | null | undefined;
  deep_evidence_plan?: DeepEvidencePlan | null;
}): ContentGateVerdict {
  const notes: string[] = ["gate_phase:a", "ruler:shape_only_no_mutate"];
  const page = input.page_schema;
  if (!page || typeof page !== "object") {
    return {
      passed: false,
      failed_rule: "gate_missing_page_schema",
      detail: "内容步未产出可预览正文 JSON。回改提示词/喂料后重跑内容步。",
      notes,
    };
  }
  const plan = input.deep_evidence_plan;
  if (!plan?.units?.length) {
    return {
      passed: false,
      failed_rule:
        input.key === "direct_answer"
          ? "gate_p1_missing_judgment"
          : "gate_missing_judgment",
      detail:
        input.key === "direct_answer"
          ? "P1 须先有主辅真算批断（core_judgment/primary/backup）。回改批断枪后重跑。"
          : "有依据页缺原始批断。回改内容步批断枪。",
      notes,
    };
  }
  notes.push(`judgment_units:${plan.units.length}`);
  if (input.key === "direct_answer") {
    notes.push("p1_judgment:internal_only_no_ui_fold");
  }
  const title = String(
    (page as { page_title?: unknown }).page_title ?? "",
  ).trim();
  if (!title) {
    notes.push("warn_empty_page_title");
  }
  if (input.key === "direct_answer") {
    const p1 = page as {
      core_judgment?: unknown;
      primary?: { name?: unknown; core_logic?: unknown };
      backup?: { name?: unknown; core_logic?: unknown };
    };
    const hasDual =
      Boolean(String(p1.core_judgment ?? "").trim()) &&
      Boolean(String(p1.primary?.name ?? "").trim()) &&
      Boolean(String(p1.primary?.core_logic ?? "").trim()) &&
      Boolean(String(p1.backup?.name ?? "").trim()) &&
      Boolean(String(p1.backup?.core_logic ?? "").trim());
    if (!hasDual) {
      return {
        passed: false,
        failed_rule: "gate_p1_missing_primary_backup",
        detail:
          "P1 必须是 core_judgment + primary + backup（一主一辅）。当前缺主辅轨——回改正文提示后重跑内容步。",
        notes,
      };
    }
    notes.push("p1_dual_track:present");
  }

  const cat = gateJudgmentCategoryB({
    key: input.key,
    deep_evidence_plan: plan,
  });
  if (cat && !cat.passed) {
    return {
      ...cat,
      notes: [...notes, ...cat.notes],
    };
  }
  if (cat?.notes?.length) {
    notes.push(...cat.notes);
  }

  notes.push("phase_a_pass_pending_human_review");
  return {
    passed: true,
    detail:
      "形状 + 已升闸类别可过。请按 P1–P6 / pivot 人审其余项；不合格勿点通过——回改提示词后重跑内容步。",
    notes,
  };
}
