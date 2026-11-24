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
  Face04V2Schema,
  Face04LegacySchema,
  Face05V2Schema,
  Face05LegacySchema,
  Face06V2Schema,
  Face06LegacySchema,
  Face06VerificationExperimentSchema,
  Face07V2Schema,
  Face07LegacySchema,
  Face08V2Schema,
  type Face01Legacy,
  type Face01V2,
  type Face02Legacy,
  type Face02V2,
  type Face03ChartLegacy,
  type Face03Glossary,
  type Face04V2,
  type Face04Legacy,
  type Face05V2,
  type Face05Legacy,
  type Face06V2,
  type Face06Legacy,
  type Face07V2,
  type Face07Legacy,
  type Face08V2,
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

/** 04 · 真正卡点 · dualTrack=fold · schema_version face04-v2 */
export const Face04Schema = Face04V2Schema;
/** Historical open: accept legacy bottleneck_name shape without rewriting storage. */
export const Face04ParseSchema = z.union([Face04V2Schema, Face04LegacySchema]);
export type Face04 = Face04V2 | Face04Legacy;
export { Face04V2Schema, Face04LegacySchema, type Face04V2, type Face04Legacy };

/** 05 · 可行路径与策略比较 · dualTrack=fold · schema_version face05-v2 */
export const Face05Schema = Face05V2Schema;
/** Historical open: accept legacy flat first/second/caution shape. */
export const Face05ParseSchema = z.union([Face05V2Schema, Face05LegacySchema]);
export type Face05 = Face05V2 | Face05Legacy;
export { Face05V2Schema, Face05LegacySchema, type Face05V2, type Face05Legacy };

/** 06 · 策略执行与验证 · dualTrack=reality · schema_version face06-v2 */
export const Face06Schema = Face06LegacySchema;
/** Historical open: accept legacy near-step shape and Face06V2. */
export const Face06ParseSchema = z.union([Face06V2Schema, Face06LegacySchema]);
export type Face06 = Face06V2 | Face06Legacy;
export {
  Face06V2Schema,
  Face06LegacySchema,
  Face06VerificationExperimentSchema,
  type Face06V2,
  type Face06Legacy,
};

/** 07 · 场域与关系 · dualTrack=abc · topic-gated · schema_version face07-v2 */
export const Face07Schema = Face07LegacySchema;
/** Historical open: accept legacy flat slots and Face07V2 (including structured skip). */
export const Face07ParseSchema = z.union([Face07V2Schema, Face07LegacySchema]);
export type Face07 = Face07V2 | Face07Legacy;
export {
  Face07V2Schema,
  Face07LegacySchema,
  type Face07V2,
  type Face07Legacy,
};

/** 08 · 风险监测与决策复盘 · dualTrack=reality · schema_version face08-v2 */
export const Face08LegacySchema = z.object({
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
export type Face08Legacy = z.infer<typeof Face08LegacySchema>;
/** Historical name kept for callers that still parse the flat self-check shape. */
export const Face08Schema = Face08LegacySchema;
/** Historical open: accept legacy red-light shape and Face08V2. */
export const Face08ParseSchema = z.union([Face08V2Schema, Face08LegacySchema]);
export type Face08 = Face08V2 | Face08Legacy;
export { Face08V2Schema, type Face08V2 };

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
  "04": Face04ParseSchema,
  "05": Face05ParseSchema,
  "06": Face06ParseSchema,
  "07": Face07ParseSchema,
  "08": Face08ParseSchema,
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
    { key: "preferred_path", segmentId: "A" },
    { key: "alternative_path", segmentId: "B" },
    { key: "cautious_path", segmentId: "C" },
    { key: "switching_exit", segmentId: "D" },
    { key: "path_comparison", segmentId: "E" },
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
        content_units: [
          {
            unit_id: "u_summary",
            kind: "conditional_explanation",
            text: "",
            claim_ids: [""],
            evidence_ids: [],
            related_reality_fact_unit_ids: [],
          },
          {
            unit_id: "u_personal",
            kind: "personal_interpretation",
            title: "",
            text: "",
            claim_ids: [""],
            evidence_ids: [""],
            source_domain: "convergence",
          },
          {
            unit_id: "u_fact",
            kind: "reality_fact",
            text: "",
            claim_ids: [""],
            evidence_ids: [""],
            fact_ids: [""],
          },
        ],
        page_summary_unit_ids: ["u_summary"],
        relevant_personal_factor_unit_ids: ["u_personal"],
        personal_reality_interplay_unit_ids: ["u_fact"],
        why_judgment_fits_unit_ids: ["u_summary"],
        page01_judgment_ref: "",
        explanation_boundary: {
          claim_ids: [""],
          personal_unit_ids: ["u_personal"],
          confirmed_fact_unit_ids: ["u_fact"],
          hypothesis_unit_ids: [],
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
        schema_version: "face05-v2",
        path_units: [],
        preferred_path_ids: [""],
        alternative_path_ids: [""],
        cautious_path_ids: [],
        path_comparison: { rows: [] },
        switching_rules: [],
        evidence_boundary: {
          claim_ids: [""],
          confirmed_fact_ids: [],
          hypothesis_notes: [],
          uncertainty_notes: [""],
          cautious_absent_note: "",
        },
        reading_order: [
          "preferred_path",
          "alternative_path",
          "cautious_path",
          "switching_exit",
          "path_comparison",
        ],
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
