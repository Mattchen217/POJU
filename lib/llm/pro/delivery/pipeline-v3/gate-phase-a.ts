/**
 * Pipeline v3 · Step2 Phase A gate — shape + early Phase B categories.
 * Never mutates draft. Human review covers remaining soft quality.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { gateJudgmentCategoryB } from "@/lib/llm/pro/delivery/pipeline-v3/gate-judgment-category";
import { gateBodyCategoryB } from "@/lib/llm/pro/delivery/pipeline-v3/gate-body-category";
import { scareRedlineSnippet } from "@/lib/llm/compliance/audit-output";
import {
  gateFaceFormat,
  isFaceDeliveryKey,
} from "@/lib/llm/pro/delivery/pipeline-v3/gate-face-format";

export type ContentGateVerdict = {
  passed: boolean;
  failed_rule?: string;
  detail?: string;
  notes: string[];
};

/**
 * Phase A: draft present + minimal JSON shape for Lab preview.
 * Early Phase B: judgment + body **substance** categories (只验不改).
 * Surface (jargon / quotes / X%) → body_polish full；Skip polish 时对正文回退 full。
 */
export function gateContentPhaseA(input: {
  key: DeliverySegmentKey;
  page_schema: DeliveryPageData | null | undefined;
  deep_evidence_plan?: DeepEvidencePlan | null;
  /**
   * Default substance_only (gate before polish).
   * Pass full only when polish was skipped and surface must hard-fail here.
   */
  body_surface?: "full" | "substance_only";
  /**
   * Same collecting / reality allowlist the body step used.
   * #11 invented-number (and other grounded substance rulers) treat an
   * omitted blob as "user gave nothing", so a quantity body already
   * allowlisted fails here as invented.
   */
  reality_blob?: string | null;
  partner_bazi?: "absent" | "present" | null;
  pivot_chart_path?: "solo" | "dyad" | null;
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

  // Face-native books: format gate replaces primary/backup hard fail.
  if (isFaceDeliveryKey(input.key)) {
    const faceGate = gateFaceFormat({ key: input.key, page_schema: page });
    if (!faceGate.passed) {
      return { ...faceGate, notes: [...notes, ...faceGate.notes] };
    }
    notes.push(...faceGate.notes);
    const planFace = input.deep_evidence_plan;
    if (!planFace?.units?.length && input.key !== "01" && input.key !== "03") {
      notes.push("warn_missing_judgment_units");
    }
    notes.push("phase_a_pass_pending_human_review");
    notes.push("face_native:format_ok");
    return { passed: true, notes };
  }

  const scare = scareRedlineSnippet(JSON.stringify(page));
  if (scare) {
    return {
      passed: false,
      failed_rule: "scare_redline",
      detail: `恐吓红线命中「${scare}」。改成带条件的明确主推后重跑本步。`,
      notes,
    };
  }
  const plan = input.deep_evidence_plan;
  if (!plan?.units?.length) {
    return {
      passed: false,
      failed_rule: "gate_missing_judgment",
      detail: "有依据页缺原始批断。回改内容步批断枪。",
      notes,
    };
  }
  notes.push(`judgment_units:${plan.units.length}`);
  const title = String(
    (page as { page_title?: unknown }).page_title ?? "",
  ).trim();
  if (!title) {
    notes.push("warn_empty_page_title");
  }
  // Legacy decision_brief path: no longer hard-fail on primary/backup for new books
  // (face path above). Old labs still shape-check if they emit dual tracks.
  if (input.key === "decision_brief") {
    notes.push("legacy_decision_brief:shape_soft");
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

  const bodySurface = input.body_surface ?? "substance_only";
  const catBody = gateBodyCategoryB({
    key: input.key,
    page_schema: page,
    surface: bodySurface,
    reality_blob: input.reality_blob,
    partner_bazi: input.partner_bazi,
    pivot_chart_path: input.pivot_chart_path,
  });
  if (catBody && !catBody.passed) {
    return {
      ...catBody,
      notes: [...notes, ...catBody.notes],
    };
  }
  if (catBody?.notes?.length) {
    notes.push(...catBody.notes);
  }

  notes.push("phase_a_pass_pending_human_review");
  notes.push(
    bodySurface === "substance_only"
      ? "body_surface:substance_only·surface_at_polish"
      : "body_surface:full",
  );
  return {
    passed: true,
    detail:
      bodySurface === "substance_only"
        ? "形状 + 事实/门槛类别可过。表面类（专名/引号等）留给润色步；请人审值钱/页角色/因果——不合格勿点通过。"
        : "形状 + 全表面类别可过。请人审其余项；不合格勿点通过——回改内容步。",
    notes,
  };
}
