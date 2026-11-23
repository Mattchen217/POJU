/**
 * Face-native delivery page schemas (01–08).
 * Field names = DECISION_PAGE_SCHEMAS segment duties (EN keys).
 * New books emit these shapes — no primary/backup on face 01.
 *
 * Batch 0 (2026-11): Face01 = structured decision conclusion (v2);
 * Face03 = glossary appendix (no chart dump). Legacy shapes kept for history open.
 */

import { z } from "zod";
import {
  DECISION_PAGE_IDS,
  type DecisionPageId,
} from "@/lib/llm/pro/delivery/page-feed-matrix";
import {
  Face01LegacySchema,
  Face01V2Schema,
  Face02LegacySchema,
  Face02V2Schema,
  Face03ChartLegacySchema,
  Face03GlossarySchema,
  type Face01Legacy,
  type Face01V2,
  type Face02Legacy,
  type Face02V2,
  type Face03ChartLegacy,
  type Face03Glossary,
} from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

const NonEmpty = z.string().trim().min(1);

const FaceChromeSchema = z.object({
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  face: z.enum(DECISION_PAGE_IDS),
});

/** 01 · 本题决策结论 · dualTrack=pointer · schema_version face01-v2 */
export const Face01Schema = Face01V2Schema;
export type Face01 = Face01V2;
export { Face01LegacySchema, type Face01Legacy };

/** 02 · 为什么这个判断适合你 · dualTrack=abc · schema_version face02-v2 */
export const Face02Schema = Face02V2Schema;
/** Historical open: accept legacy destiny_reason shape without rewriting storage. */
export const Face02ParseSchema = z.union([Face02V2Schema, Face02LegacySchema]);
export type Face02 = Face02V2 | Face02Legacy;
export { Face02LegacySchema, type Face02Legacy };

/** 04 · 真正卡点 · dualTrack=fold */
export const Face04Schema = z.object({
  page: z.literal("04"),
  ...FaceChromeSchema.shape,
  face: z.literal("04"),
  bottleneck_name: NonEmpty.max(160),
  manifestation: NonEmpty.max(960),
  if_force_through: z.string().trim().max(720).optional().default(""),
  evidence_fold: NonEmpty.max(1200),
});
export type Face04 = z.infer<typeof Face04Schema>;

/** Product Stage 4 P5 — conditional recommendation caveats + evidence ids. */
const Face05Stage4Extras = {
  /** Unknowns / conflicts that may change ranking (required when DC has P5-critical gaps). */
  recommendation_conditions: z.string().trim().max(960).optional().default(""),
  /** Trace ids: fact:… / hypothesis:… / dir:… / conflict:… */
  evidence_trace: z.array(NonEmpty.max(120)).max(12).optional().default([]),
};

/** 05 · 路径排序 · dualTrack=fold · Product Stage 4 P5 */
export const Face05Schema = z.object({
  page: z.literal("05"),
  ...FaceChromeSchema.shape,
  face: z.literal("05"),
  first_choice: NonEmpty.max(720),
  second_choice: NonEmpty.max(720),
  caution_choice: NonEmpty.max(720),
  switch_or_stop: NonEmpty.max(720),
  contrast: z.string().trim().max(320).optional().default(""),
  ...Face05Stage4Extras,
});
export type Face05 = z.infer<typeof Face05Schema>;

/** Product Stage 4 P6 — verification experiment (7 questions). */
export const Face06VerificationExperimentSchema = z.object({
  hypothesis: NonEmpty.max(480),
  action: NonEmpty.max(480),
  observe: NonEmpty.max(480),
  window: NonEmpty.max(240),
  success_criteria: NonEmpty.max(480),
  if_fail: NonEmpty.max(480),
  defer_costs: NonEmpty.max(480),
});

/** 06 · 怎么落地 · dualTrack=reality · Product Stage 4 P6 */
export const Face06Schema = z.object({
  page: z.literal("06"),
  ...FaceChromeSchema.shape,
  face: z.literal("06"),
  near_step_principle: NonEmpty.max(960),
  stage_climate: NonEmpty.max(720),
  self_retune: NonEmpty.max(720),
  rhythm_note: NonEmpty.max(480),
  /** Stage 4: structured verification experiment (optional for legacy Lab fills). */
  verification_experiment: Face06VerificationExperimentSchema.optional(),
});
export type Face06 = z.infer<typeof Face06Schema>;

/** 07 · 场域与关系 · dualTrack=abc · topic-gated */
export const Face07Schema = z.object({
  page: z.literal("07"),
  ...FaceChromeSchema.shape,
  face: z.literal("07"),
  field_judgment: NonEmpty.max(960),
  relation_interaction: NonEmpty.max(960),
  evidence_fold: NonEmpty.max(1200),
  align_with_01_05: z.string().trim().max(480).optional().default(""),
});
export type Face07 = z.infer<typeof Face07Schema>;

/** 08 · 自检清单 · dualTrack=reality · Product Stage 4 P8 */
export const Face08Schema = z.object({
  page: z.literal("08"),
  ...FaceChromeSchema.shape,
  face: z.literal("08"),
  red_lights: z.array(NonEmpty.max(240)).min(1).max(8),
  review_questions: z.array(NonEmpty.max(240)).min(1).max(8),
  when_to_rerun: NonEmpty.max(480),
  /** Shared with P6 experiment observables — must not be replaced by path-only metrics. */
  shared_core_metrics: z.array(NonEmpty.max(240)).max(8).optional().default([]),
  review_decision: z
    .enum(["continue", "adjust", "stop", "rerun"])
    .optional(),
  review_decision_rationale: z.string().trim().max(720).optional().default(""),
});
export type Face08 = z.infer<typeof Face08Schema>;

/**
 * 03 · 本报告术语索引（glossary appendix）· dualTrack=appendix
 * No chart dump; term_ids resolved from SSOT at render.
 */
export const Face03Schema = Face03GlossarySchema;
export type Face03 = Face03Glossary;
export { Face03ChartLegacySchema, type Face03ChartLegacy };

export const FACE_PAGE_SCHEMAS = {
  "01": Face01Schema,
  "02": Face02ParseSchema,
  "04": Face04Schema,
  "05": Face05Schema,
  "06": Face06Schema,
  "07": Face07Schema,
  "08": Face08Schema,
  "03": Face03Schema,
} as const;

export type FacePageData =
  | Face01
  | Face02
  | Face04
  | Face05
  | Face06
  | Face07
  | Face08
  | Face03;

export function facePageSchema(pageId: DecisionPageId) {
  return FACE_PAGE_SCHEMAS[pageId];
}

/** Segment field keys per face (for prompt shape + UI). */
export const FACE_SEGMENT_FIELDS: Record<
  DecisionPageId,
  readonly { key: string; segmentId: string }[]
> = {
  "01": [
    { key: "core_judgment", segmentId: "A" },
    { key: "why_this_path", segmentId: "B" },
    { key: "recommendation_conditions", segmentId: "C" },
    { key: "not_recommended", segmentId: "D" },
    { key: "applicability_boundary", segmentId: "E" },
  ],
  "02": [
    { key: "page_summary", segmentId: "A" },
    { key: "relevant_personal_factors", segmentId: "B" },
    { key: "personal_reality_interplay", segmentId: "C" },
    { key: "why_judgment_fits", segmentId: "D" },
    { key: "explanation_boundary", segmentId: "E" },
  ],
  "04": [
    { key: "bottleneck_name", segmentId: "A" },
    { key: "manifestation", segmentId: "B" },
    { key: "if_force_through", segmentId: "C" },
    { key: "evidence_fold", segmentId: "D" },
  ],
  "05": [
    { key: "first_choice", segmentId: "A" },
    { key: "second_choice", segmentId: "B" },
    { key: "caution_choice", segmentId: "C" },
    { key: "switch_or_stop", segmentId: "D" },
    { key: "contrast", segmentId: "E" },
  ],
  "06": [
    { key: "near_step_principle", segmentId: "A" },
    { key: "stage_climate", segmentId: "B" },
    { key: "self_retune", segmentId: "C" },
    { key: "rhythm_note", segmentId: "D" },
  ],
  "07": [
    { key: "field_judgment", segmentId: "A" },
    { key: "relation_interaction", segmentId: "B" },
    { key: "evidence_fold", segmentId: "C" },
    { key: "align_with_01_05", segmentId: "D" },
  ],
  "08": [
    { key: "red_lights", segmentId: "A" },
    { key: "review_questions", segmentId: "B" },
    { key: "when_to_rerun", segmentId: "C" },
  ],
  "03": [
    { key: "reading_note", segmentId: "A" },
    { key: "term_ids", segmentId: "B" },
  ],
};

/** Empty JSON shape for fill skeleton / prompt. */
export function faceFillShapeSkeleton(pageId: DecisionPageId): Record<string, unknown> {
  const base = { page: pageId, face: pageId, page_title: "", page_subtitle: "" };
  switch (pageId) {
    case "01":
      return {
        ...base,
        schema_version: "face01-v2",
        core_judgment: { text: "", claim_ids: [""] },
        why_this_path: [
          {
            text: "",
            claim_ids: [""],
            evidence_ids: [""],
            target_page: "02",
            target_evidence_ids: [""],
          },
        ],
        recommendation_conditions: [
          { condition: "", status: "unconfirmed", source_ids: [""] },
          { condition: "", status: "unconfirmed", source_ids: [""] },
        ],
        not_recommended: [
          {
            option: "",
            reason: "",
            cost_or_conflict: "",
            claim_ids: [""],
            evidence_ids: [""],
          },
        ],
        applicability_boundary: {
          current_basis: [""],
          invalidation_conditions: [""],
          page02_evidence_ids: [""],
          page08_review_refs: [],
        },
      };
    case "02":
      return {
        ...base,
        schema_version: "face02-v2",
        page_summary: "",
        relevant_personal_factors: [
          {
            factor_id: "",
            title: "",
            text: "",
            claim_ids: [""],
            evidence_ids: [""],
            source_domain: "convergence",
          },
        ],
        personal_reality_interplay: [
          {
            text: "",
            personal_evidence_ids: [""],
            reality_fact_ids: [""],
            mechanism_evidence_ids: [],
            claim_ids: [""],
            conditionality: "",
          },
        ],
        why_judgment_fits: {
          text: "",
          claim_ids: [""],
          evidence_ids: [""],
          page01_judgment_ref: "",
        },
        explanation_boundary: {
          personal_analysis_basis: [""],
          confirmed_fact_basis: [""],
          hypothesis_notes: [],
          uncertainty_notes: [""],
        },
        reading_order: [
          "page_summary",
          "relevant_personal_factors",
          "personal_reality_interplay",
          "why_judgment_fits",
          "explanation_boundary",
        ],
      };
    case "04":
      return {
        ...base,
        bottleneck_name: "",
        manifestation: "",
        if_force_through: "",
        evidence_fold: "",
      };
    case "05":
      return {
        ...base,
        first_choice: "",
        second_choice: "",
        caution_choice: "",
        switch_or_stop: "",
        contrast: "",
        recommendation_conditions: "",
        evidence_trace: [],
      };
    case "06":
      return {
        ...base,
        near_step_principle: "",
        stage_climate: "",
        self_retune: "",
        rhythm_note: "",
        verification_experiment: {
          hypothesis: "",
          action: "",
          observe: "",
          window: "",
          success_criteria: "",
          if_fail: "",
          defer_costs: "",
        },
      };
    case "07":
      return {
        ...base,
        field_judgment: "",
        relation_interaction: "",
        evidence_fold: "",
        align_with_01_05: "",
      };
    case "08":
      return {
        ...base,
        red_lights: [""],
        review_questions: [""],
        when_to_rerun: "",
        shared_core_metrics: [""],
        review_decision: "continue",
        review_decision_rationale: "",
      };
    case "03":
      return {
        ...base,
        kind: "glossary_appendix",
        reading_note: "",
        term_ids: [],
      };
  }
}

/** True when payload looks like a face-native page (not v1 paper). */
export function isFaceNativePage(data: unknown): data is FacePageData {
  if (!data || typeof data !== "object") return false;
  const page = (data as { page?: unknown }).page;
  return typeof page === "string" && (DECISION_PAGE_IDS as readonly string[]).includes(page);
}

/** Reject legacy primary/backup on new-book face JSON. */
export function faceJsonHasLegacyPrimaryBackup(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return "primary" in o || "backup" in o || "primary_toolkit" in o || "backup_toolkit" in o;
}
