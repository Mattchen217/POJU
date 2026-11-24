/**
 * Zod schemas for Decision Report V2 shared contracts.
 */

import { z } from "zod";

const NonEmpty = z.string().trim().min(1);

export const DecisionReportLocaleSchema = z.enum([
  "zh",
  "en",
  "es",
  "fr",
  "de",
]);

export const DecisionReportPageIdSchema = z.enum([
  "01",
  "02",
  "04",
  "05",
  "06",
  "07",
  "08",
]);

export const FactStatusSchema = z.enum([
  "confirmed",
  "unverified",
  "unknown",
  "declined",
  "not_applicable",
]);

export const VerificationLevelSchema = z.enum([
  "user_asserted",
  "independently_verified",
  "user_estimate",
  "none",
]);

export const ReportClaimTypeSchema = z.enum([
  "recommendation",
  "personal_interpretation",
  "reality_analysis",
  "risk",
  "condition",
  "action",
  "hypothesis",
]);

export const EvidenceRequirementSchema = z.enum([
  "required",
  "optional",
  "not_required",
]);

export const ReportEvidenceSourceTypeSchema = z.enum([
  "personal_reading",
  "reality_fact",
  "reality_mechanism",
  "explicit_hypothesis",
]);

export const ReportClaimSchema = z.object({
  claim_id: NonEmpty.max(80),
  page_id: DecisionReportPageIdSchema,
  segment_id: NonEmpty.max(16),
  body_text: NonEmpty.max(1200),
  claim_type: ReportClaimTypeSchema,
  evidence_ids: z.array(NonEmpty.max(80)).max(24),
  evidence_requirement: EvidenceRequirementSchema,
  limitation: z.string().trim().max(480).optional(),
  /**
   * Program-certified DIR bindings (Page02). Optional; never model-authored
   * as a trusted association without certification.
   */
  related_dir_ids: z.array(NonEmpty.max(80)).max(24).optional(),
});

export const ReportEvidenceSchema = z.object({
  evidence_id: NonEmpty.max(80),
  source_type: ReportEvidenceSourceTypeSchema,
  source_id: NonEmpty.max(120),
  term_ids: z.array(NonEmpty.max(80)).max(24),
  explanation: NonEmpty.max(1600),
  supports_claim_ids: z.array(NonEmpty.max(80)).max(24),
  limits_claim_ids: z.array(NonEmpty.max(80)).max(24),
  verification_status: z.string().trim().max(80).optional(),
  /** Program-certified; optional for historical evidence rows. */
  source_domain: z.string().trim().max(80).nullable().optional(),
  source_version: z.string().trim().max(120).nullable().optional(),
  mechanism_kind: z.string().trim().max(80).nullable().optional(),
});

export const ReportSegmentBodySchema = z.object({
  text: NonEmpty.max(2000),
  claim_ids: z.array(NonEmpty.max(80)).max(24),
});

export const ReportSegmentEvidenceSchema = z.object({
  items: z.array(ReportEvidenceSchema).max(24),
});

export const ReportSegmentSchema = z.object({
  segment_id: NonEmpty.max(16),
  heading: NonEmpty.max(80),
  body: ReportSegmentBodySchema,
  evidence: ReportSegmentEvidenceSchema.nullable(),
});

export const DecisionReportRealityFactSchema = z.object({
  fact_id: NonEmpty.max(120),
  content: NonEmpty.max(2000),
  status: FactStatusSchema,
  verification: VerificationLevelSchema,
  source_reference: z.string().trim().max(240).optional(),
});

export const PersonalAnalysisAnchorSchema = z.object({
  anchor_id: NonEmpty.max(120),
  source_domain: NonEmpty.max(80),
  source_reference: NonEmpty.max(240),
  term_id: z.string().trim().max(80).optional(),
  internal_anchor: z.unknown(),
  approved_interpretation: NonEmpty.max(1600),
  availability_status: NonEmpty.max(80),
});

export const ApprovedReadingSchema = z.object({
  reading_id: NonEmpty.max(120),
  anchor_ids: z.array(NonEmpty.max(120)).min(1).max(24),
  term_ids: z.array(NonEmpty.max(80)).max(24),
  interpretation: NonEmpty.max(2000),
  scope: NonEmpty.max(240),
  confidence_status: NonEmpty.max(80),
});

export const TermAllowlistEntrySchema = z.object({
  term_id: NonEmpty.max(80),
  soft_label: NonEmpty.max(80),
  definition: NonEmpty.max(480),
  related_reading_ids: z.array(NonEmpty.max(120)).max(24),
});

export const DecisionReportInputSchema = z.object({
  report_id: NonEmpty.max(120),
  locale: DecisionReportLocaleSchema,
  decision: z.object({
    question: NonEmpty.max(800),
    desired_outcome: z.string().trim().max(800).default(""),
    decision_definition: z.unknown(),
    decision_constraints: z.unknown(),
  }),
  reality_context: z.object({
    facts: z.array(DecisionReportRealityFactSchema).max(200),
    conflicts: z.array(z.unknown()).max(50),
    hypotheses: z.array(z.unknown()).max(50),
  }),
  personal_analysis: z.object({
    profile_version: z.string().trim().max(80).default(""),
    available_domains: z.array(NonEmpty.max(80)).max(24),
    relevant_anchors: z.array(PersonalAnalysisAnchorSchema).max(40),
    approved_readings: z.array(ApprovedReadingSchema).max(40),
  }),
  report_analysis: z.object({
    decision_synthesis: z.unknown(),
    candidate_paths: z.array(z.unknown()).max(12),
    key_claims: z.array(ReportClaimSchema).max(40),
    unresolved_issues: z.array(z.unknown()).max(40),
  }),
});

export const ConditionStatusSchema = z.enum([
  "satisfied",
  "unconfirmed",
  "conflicted",
  "not_applicable",
]);

/** Face 01 — 本题决策结论 (SoT 2026-11-22). */
export const Face01V2Schema = z.object({
  page: z.literal("01"),
  face: z.literal("01"),
  schema_version: z.literal("face01-v2").default("face01-v2"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  core_judgment: z.object({
    text: NonEmpty.max(720),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
  }),
  why_this_path: z
    .array(
      z.object({
        text: NonEmpty.max(360),
        claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
        evidence_ids: z.array(NonEmpty.max(80)).min(1).max(8),
        target_page: z.literal("02"),
        target_evidence_ids: z.array(NonEmpty.max(80)).min(1).max(8),
      }),
    )
    .min(1)
    .max(3),
  recommendation_conditions: z
    .array(
      z.object({
        condition: NonEmpty.max(240),
        status: ConditionStatusSchema,
        source_ids: z.array(NonEmpty.max(120)).min(1).max(8),
      }),
    )
    .min(2)
    .max(4),
  not_recommended: z
    .array(
      z.object({
        option: NonEmpty.max(240),
        reason: NonEmpty.max(360),
        cost_or_conflict: NonEmpty.max(360),
        claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
        evidence_ids: z.array(NonEmpty.max(80)).min(1).max(8),
      }),
    )
    .min(1)
    .max(2),
  applicability_boundary: z.object({
    current_basis: z.array(NonEmpty.max(240)).min(1).max(6),
    invalidation_conditions: z.array(NonEmpty.max(240)).min(1).max(6),
    page02_evidence_ids: z.array(NonEmpty.max(80)).min(1).max(12),
    page08_review_refs: z.array(NonEmpty.max(120)).max(8).default([]),
  }),
});

export type Face01V2 = z.infer<typeof Face01V2Schema>;

/**
 * Face02 content units — sole V2 authority for reader/PDF body.
 * Free-text section prose is not an authority source for new generation.
 */
export const Face02ContentUnitSchema = z.discriminatedUnion("kind", [
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("personal_interpretation"),
    text: NonEmpty.max(720),
    title: z.string().trim().max(120).optional().default(""),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    source_domain: z.enum(["bazi", "ziwei", "science", "convergence"]),
  }),
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("reality_fact"),
    text: NonEmpty.max(720),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    /** Must be reality_fact evidence ids (typically ev_fact_<fact_id>). */
    evidence_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    /** Canonical raw DC fact ids. */
    fact_ids: z.array(NonEmpty.max(120)).min(1).max(8),
  }),
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("reality_mechanism"),
    text: NonEmpty.max(720),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: z.array(NonEmpty.max(80)).min(1).max(8),
  }),
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("conditional_explanation"),
    text: NonEmpty.max(720),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: z.array(NonEmpty.max(80)).max(8),
    /**
     * If this unit discusses DC reality, point at validated reality_fact units.
     * Do not embed unverified free-text facts here.
     */
    related_reality_fact_unit_ids: z.array(NonEmpty.max(80)).max(8),
  }),
]);

export type Face02ContentUnit = z.infer<typeof Face02ContentUnitSchema>;

/** Face 02 — 为什么这个判断适合你 (structured content units · 2026-11-23). */
export const Face02V2Schema = z.object({
  page: z.literal("02"),
  face: z.literal("02"),
  schema_version: z.literal("face02-v2").default("face02-v2"),
  /**
   * Report locale stamped at production/attach time — Reader UI may override
   * display locale; PDF `pageSchemaToArgumentBodies` reads this so titles/order
   * match the same section-assembly SSOT (no hard-coded zh-only table).
   */
  locale: DecisionReportLocaleSchema.optional(),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  /** Validated content units — sole body authority for V2 generation. */
  content_units: z.array(Face02ContentUnitSchema).min(1).max(24),
  /** Section assembly: ordered unit_ids into reading slots. */
  page_summary_unit_ids: z.array(NonEmpty.max(80)).min(1).max(6),
  relevant_personal_factor_unit_ids: z.array(NonEmpty.max(80)).max(8),
  personal_reality_interplay_unit_ids: z.array(NonEmpty.max(80)).max(8),
  why_judgment_fits_unit_ids: z.array(NonEmpty.max(80)).min(1).max(8),
  page01_judgment_ref: z.string().trim().max(240).optional().default(""),
  explanation_boundary: z.object({
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    /** personal_interpretation unit ids (empty when no personal domain). */
    personal_unit_ids: z.array(NonEmpty.max(80)).max(8),
    /** reality_fact units whose DC status is confirmed. */
    confirmed_fact_unit_ids: z.array(NonEmpty.max(80)).max(8),
    /** Units that state hypotheses (not confirmed DC facts). */
    hypothesis_unit_ids: z.array(NonEmpty.max(80)).max(8),
    /** Non-authoritative uncertainty notes — must not alter DC status. */
    uncertainty_notes: z.array(NonEmpty.max(240)).min(1).max(6),
  }),
  /**
   * Preferred reading order. Assembly always normalizes via
   * normalizePage02ReadingOrder (unique; drops unknown; never omits defined
   * sections). Schema still rejects duplicate ids in the stored array.
   * Historical pages may omit optional slots; Reader/PDF rehydrate the full set.
   */
  reading_order: z
    .array(
      z.enum([
        "page_summary",
        "relevant_personal_factors",
        "personal_reality_interplay",
        "why_judgment_fits",
        "explanation_boundary",
      ]),
    )
    .min(3)
    .max(5)
    .default([
      "page_summary",
      "relevant_personal_factors",
      "personal_reality_interplay",
      "why_judgment_fits",
      "explanation_boundary",
    ])
    .superRefine((order, ctx) => {
      const seen = new Set<string>();
      for (const id of order) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate reading_order section_id: ${id}`,
          });
          return;
        }
        seen.add(id);
      }
      for (const required of [
        "page_summary",
        "why_judgment_fits",
        "explanation_boundary",
      ] as const) {
        if (!seen.has(required)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `reading_order missing required section: ${required}`,
          });
        }
      }
    }),
  /**
   * Architecture envelope (Batch 1) — optional for historical pages.
   * Program attaches these; model must not invent gap closure.
   */
  generation_status: z
    .enum([
      "blocked_on_required_inputs",
      "ready_for_generation",
      "generated_with_gaps",
      "generated_complete",
      "failed_structure",
      "incomplete",
    ])
    .optional(),
  input_manifest: z
    .array(
      z.object({
        field_id: NonEmpty.max(80),
        section_id: z.enum([
          "page_summary",
          "relevant_personal_factors",
          "personal_reality_interplay",
          "why_judgment_fits",
          "explanation_boundary",
        ]),
        source_kind: z.enum([
          "personal_analysis",
          "reality_context",
          "analytical_result",
          "system_metadata",
          "derived_data",
        ]),
        present: z.boolean(),
        collection_status: z.enum([
          "ready",
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        value_summary: z.string().trim().max(240).nullable(),
      }),
    )
    .max(40)
    .optional(),
  missing_inputs: z
    .array(
      z.object({
        gap_id: NonEmpty.max(120),
        page_id: z.literal("02"),
        section_id: z.enum([
          "page_summary",
          "relevant_personal_factors",
          "personal_reality_interplay",
          "why_judgment_fits",
          "explanation_boundary",
        ]),
        field_id: NonEmpty.max(120),
        status: z.enum([
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        why_needed: NonEmpty.max(400),
        affects_content: NonEmpty.max(400),
        follow_up_collect_hint: NonEmpty.max(400),
        handling: z.enum([
          "omit_section_content",
          "defer_generation",
          "generate_conditional_only",
          "show_gap_note_only",
        ]),
      }),
    )
    .max(48)
    .optional(),
  sections: z
    .array(
      z.object({
        section_id: z.enum([
          "page_summary",
          "relevant_personal_factors",
          "personal_reality_interplay",
          "why_judgment_fits",
          "explanation_boundary",
        ]),
        segment_letter: NonEmpty.max(4),
        title_zh: NonEmpty.max(80),
        title_en: NonEmpty.max(80),
        required: z.boolean(),
        reading_rank: z.number().int().min(1).max(8),
        information_level: NonEmpty.max(32),
      }),
    )
    .max(8)
    .optional(),
  generation_metadata: z
    .object({
      task_id: NonEmpty.max(80),
      prompt_bundle_chars: z.number().int().min(0),
      built_at: NonEmpty.max(64),
      llm_invoked: z.boolean(),
    })
    .optional(),
});

export type Face02V2 = z.infer<typeof Face02V2Schema>;

/** Legacy Face 02 (pre Page02 V2) — retained for historical report open. */
export const Face02LegacySchema = z.object({
  page: z.literal("02"),
  face: z.literal("02"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  destiny_reason: NonEmpty.max(1200),
  science_mechanism: NonEmpty.max(1200),
  convergence: NonEmpty.max(720),
  verifiable_anchors: z.array(NonEmpty.max(160)).min(1).max(8),
});

export type Face02Legacy = z.infer<typeof Face02LegacySchema>;

/**
 * Face04 content units — Core Bottleneck V2 authority.
 * Distinct kinds from Face02; do not reuse Face02 unit kinds.
 */
export const Face04ContentUnitSchema = z.discriminatedUnion("kind", [
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("bottleneck_label"),
    text: NonEmpty.max(240),
    title: z.string().trim().max(120).optional().default(""),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    related_reality_fact_ids: z.array(NonEmpty.max(120)).max(8).default([]),
  }),
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("manifestation"),
    text: NonEmpty.max(960),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    related_reality_fact_ids: z.array(NonEmpty.max(120)).max(8).default([]),
  }),
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("force_through_cost"),
    text: NonEmpty.max(720),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    related_reality_fact_ids: z.array(NonEmpty.max(120)).max(8).default([]),
  }),
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("leverage_point"),
    text: NonEmpty.max(720),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    related_reality_fact_ids: z.array(NonEmpty.max(120)).max(8).default([]),
  }),
  z.object({
    unit_id: NonEmpty.max(80),
    kind: z.literal("evidence_note"),
    text: NonEmpty.max(1200),
    claim_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    evidence_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    related_reality_fact_ids: z.array(NonEmpty.max(120)).max(8).default([]),
  }),
]);

export type Face04ContentUnit = z.infer<typeof Face04ContentUnitSchema>;

const Page04SectionIdEnum = z.enum([
  "bottleneck_naming",
  "manifestation",
  "force_through_cost",
  "leverage_point",
  "evidence_boundary",
]);

/** Face 04 — 真正卡住你的是什么 (structured content units · Batch 1). */
export const Face04V2Schema = z.object({
  page: z.literal("04"),
  face: z.literal("04"),
  schema_version: z.literal("face04-v2").default("face04-v2"),
  locale: DecisionReportLocaleSchema.optional(),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  content_units: z.array(Face04ContentUnitSchema).min(1).max(24),
  bottleneck_naming_unit_ids: z.array(NonEmpty.max(80)).min(1).max(6),
  manifestation_unit_ids: z.array(NonEmpty.max(80)).min(1).max(8),
  force_through_cost_unit_ids: z.array(NonEmpty.max(80)).min(1).max(8),
  leverage_point_unit_ids: z.array(NonEmpty.max(80)).min(1).max(8),
  page01_judgment_ref: z.string().trim().max(240).optional().default(""),
  evidence_boundary: z.object({
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(12),
    evidence_note_unit_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    confirmed_fact_ids: z.array(NonEmpty.max(120)).max(12).default([]),
    hypothesis_notes: z.array(NonEmpty.max(240)).max(6).default([]),
    uncertainty_notes: z.array(NonEmpty.max(240)).min(1).max(8),
  }),
  reading_order: z
    .array(Page04SectionIdEnum)
    .min(3)
    .max(5)
    .default([
      "bottleneck_naming",
      "manifestation",
      "force_through_cost",
      "leverage_point",
      "evidence_boundary",
    ])
    .superRefine((order, ctx) => {
      const seen = new Set<string>();
      for (const id of order) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate reading_order section_id: ${id}`,
          });
          return;
        }
        seen.add(id);
      }
      for (const required of [
        "bottleneck_naming",
        "manifestation",
        "force_through_cost",
        "leverage_point",
        "evidence_boundary",
      ] as const) {
        if (!seen.has(required)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `reading_order missing required section: ${required}`,
          });
        }
      }
    }),
  generation_status: z
    .enum([
      "blocked_on_required_inputs",
      "ready_for_generation",
      "generated_with_gaps",
      "generated_complete",
      "failed_structure",
      "incomplete",
    ])
    .optional(),
  input_manifest: z
    .array(
      z.object({
        field_id: NonEmpty.max(80),
        section_id: Page04SectionIdEnum,
        source_kind: z.enum([
          "personal_analysis",
          "reality_context",
          "analytical_result",
          "system_metadata",
          "derived_data",
        ]),
        present: z.boolean(),
        collection_status: z.enum([
          "ready",
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        value_summary: z.string().trim().max(240).nullable(),
      }),
    )
    .max(40)
    .optional(),
  missing_inputs: z
    .array(
      z.object({
        gap_id: NonEmpty.max(120),
        page_id: z.literal("04"),
        section_id: Page04SectionIdEnum,
        field_id: NonEmpty.max(120),
        status: z.enum([
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        why_needed: NonEmpty.max(400),
        affects_content: NonEmpty.max(400),
        follow_up_collect_hint: NonEmpty.max(400),
        handling: z.enum([
          "omit_section_content",
          "defer_generation",
          "generate_conditional_only",
          "show_gap_note_only",
        ]),
      }),
    )
    .max(48)
    .optional(),
  sections: z
    .array(
      z.object({
        section_id: Page04SectionIdEnum,
        segment_letter: NonEmpty.max(4),
        title_zh: NonEmpty.max(80),
        title_en: NonEmpty.max(80),
        required: z.boolean(),
        reading_rank: z.number().int().min(1).max(8),
        information_level: NonEmpty.max(32),
      }),
    )
    .max(8)
    .optional(),
  generation_metadata: z
    .object({
      task_id: NonEmpty.max(80),
      prompt_bundle_chars: z.number().int().min(0),
      built_at: NonEmpty.max(64),
      llm_invoked: z.boolean(),
    })
    .optional(),
});

export type Face04V2 = z.infer<typeof Face04V2Schema>;

/** Legacy Face 04 (pre Face04V2) — historical open. */
export const Face04LegacySchema = z.object({
  page: z.literal("04"),
  face: z.literal("04"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  bottleneck_name: NonEmpty.max(160),
  manifestation: NonEmpty.max(960),
  if_force_through: z.string().trim().max(720).optional().default(""),
  evidence_fold: NonEmpty.max(1200),
});

export type Face04Legacy = z.infer<typeof Face04LegacySchema>;

/** Face 05 path unit — Feasible Paths & Strategy Comparison (Batch 1). */
export const Face05PathRoleSchema = z.enum([
  "preferred",
  "alternative",
  "cautious",
]);

export const Face05PathUnitSchema = z.object({
  path_id: NonEmpty.max(80),
  path_role: Face05PathRoleSchema,
  title: NonEmpty.max(160),
  description: NonEmpty.max(960),
  recommendation_reason: NonEmpty.max(720),
  prerequisites: z.array(NonEmpty.max(240)).max(8).default([]),
  required_resources: z.array(NonEmpty.max(240)).max(8).default([]),
  expected_benefits: z.array(NonEmpty.max(240)).max(8).default([]),
  costs: z.array(NonEmpty.max(240)).max(8).default([]),
  risks: z.array(NonEmpty.max(240)).max(8).default([]),
  reversibility: NonEmpty.max(320),
  success_signals: z.array(NonEmpty.max(240)).min(1).max(8),
  reconsideration_conditions: z.array(NonEmpty.max(240)).max(8).default([]),
  claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
  evidence_ids: z.array(NonEmpty.max(80)).max(8).default([]),
  related_reality_fact_ids: z.array(NonEmpty.max(120)).max(8).default([]),
  supporting_page01_refs: z.array(NonEmpty.max(120)).max(8).default([]),
  supporting_page02_refs: z.array(NonEmpty.max(120)).max(8).default([]),
  supporting_page04_refs: z.array(NonEmpty.max(120)).max(8).default([]),
});

export type Face05PathUnit = z.infer<typeof Face05PathUnitSchema>;

export const Face05PathComparisonRowSchema = z.object({
  path_id: NonEmpty.max(80),
  benefit: NonEmpty.max(320),
  cost: NonEmpty.max(320),
  risk: NonEmpty.max(320),
  resource_requirement: NonEmpty.max(320),
  reversibility: NonEmpty.max(320),
  prerequisites: NonEmpty.max(320),
});

export const Face05SwitchActionSchema = z.enum([
  "switch",
  "stop",
  "pause",
  "redefine",
]);

export const Face05SwitchingRuleSchema = z.object({
  rule_id: NonEmpty.max(80),
  source_path_id: NonEmpty.max(80),
  trigger_condition: NonEmpty.max(480),
  action: Face05SwitchActionSchema,
  target_path_id: z.string().trim().max(80).nullable().optional().default(null),
  rationale: NonEmpty.max(480),
  claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
  evidence_ids: z.array(NonEmpty.max(80)).max(8).default([]),
  related_reality_fact_ids: z.array(NonEmpty.max(120)).max(8).default([]),
});

const Page05SectionIdEnum = z.enum([
  "preferred_path",
  "alternative_path",
  "cautious_path",
  "switching_exit",
  "path_comparison",
]);

/** Face 05 — 可行路径与策略比较 (structured paths · Batch 1). */
export const Face05V2Schema = z.object({
  page: z.literal("05"),
  face: z.literal("05"),
  schema_version: z.literal("face05-v2").default("face05-v2"),
  locale: DecisionReportLocaleSchema.optional(),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  path_units: z.array(Face05PathUnitSchema).min(2).max(4),
  preferred_path_ids: z.array(NonEmpty.max(80)).min(1).max(2),
  alternative_path_ids: z.array(NonEmpty.max(80)).max(3).default([]),
  cautious_path_ids: z.array(NonEmpty.max(80)).max(2).default([]),
  path_comparison: z.object({
    rows: z.array(Face05PathComparisonRowSchema).min(2).max(4),
  }),
  switching_rules: z.array(Face05SwitchingRuleSchema).min(1).max(12),
  evidence_boundary: z.object({
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(12),
    confirmed_fact_ids: z.array(NonEmpty.max(120)).max(12).default([]),
    hypothesis_notes: z.array(NonEmpty.max(240)).max(6).default([]),
    uncertainty_notes: z.array(NonEmpty.max(240)).min(1).max(8),
    cautious_absent_note: z.string().trim().max(320).optional().default(""),
  }),
  reading_order: z
    .array(Page05SectionIdEnum)
    .min(3)
    .max(5)
    .default([
      "preferred_path",
      "alternative_path",
      "cautious_path",
      "switching_exit",
      "path_comparison",
    ])
    .superRefine((order, ctx) => {
      const seen = new Set<string>();
      for (const id of order) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate reading_order section_id: ${id}`,
          });
          return;
        }
        seen.add(id);
      }
      for (const required of [
        "preferred_path",
        "alternative_path",
        "cautious_path",
        "switching_exit",
        "path_comparison",
      ] as const) {
        if (!seen.has(required)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `reading_order missing required section: ${required}`,
          });
        }
      }
    }),
  generation_status: z
    .enum([
      "blocked_on_required_inputs",
      "ready_for_generation",
      "generated_with_gaps",
      "generated_complete",
      "failed_structure",
      "incomplete",
    ])
    .optional(),
  input_manifest: z
    .array(
      z.object({
        field_id: NonEmpty.max(80),
        section_id: Page05SectionIdEnum,
        source_kind: z.enum([
          "personal_analysis",
          "reality_context",
          "analytical_result",
          "system_metadata",
          "derived_data",
        ]),
        present: z.boolean(),
        collection_status: z.enum([
          "ready",
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        value_summary: z.string().trim().max(320).nullable(),
      }),
    )
    .max(48)
    .optional(),
  missing_inputs: z
    .array(
      z.object({
        gap_id: NonEmpty.max(80),
        page_id: z.literal("05"),
        section_id: Page05SectionIdEnum,
        field_id: NonEmpty.max(80),
        status: z.enum([
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        why_needed: NonEmpty.max(320),
        affects_content: NonEmpty.max(320),
        follow_up_collect_hint: NonEmpty.max(320),
        handling: z.enum([
          "omit_section_content",
          "defer_generation",
          "generate_conditional_only",
          "show_gap_note_only",
        ]),
      }),
    )
    .max(48)
    .optional(),
  sections: z
    .array(
      z.object({
        section_id: Page05SectionIdEnum,
        segment_letter: z.enum(["A", "B", "C", "D", "E"]),
        title_zh: NonEmpty.max(80),
        title_en: NonEmpty.max(80),
        required: z.boolean(),
        reading_rank: z.number().int().min(1).max(8),
        information_level: NonEmpty.max(40),
      }),
    )
    .max(8)
    .optional(),
  generation_metadata: z
    .object({
      task_id: NonEmpty.max(80),
      prompt_bundle_chars: z.number().int().min(0),
      built_at: NonEmpty.max(64),
      llm_invoked: z.boolean(),
    })
    .optional(),
});

export type Face05V2 = z.infer<typeof Face05V2Schema>;

/** Legacy Face 05 (pre Face05V2) — historical open. */
export const Face05LegacySchema = z.object({
  page: z.literal("05"),
  face: z.literal("05"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  first_choice: NonEmpty.max(720),
  second_choice: NonEmpty.max(720),
  caution_choice: NonEmpty.max(720),
  switch_or_stop: NonEmpty.max(720),
  contrast: z.string().trim().max(320).optional().default(""),
  recommendation_conditions: z.string().trim().max(960).optional().default(""),
  evidence_trace: z.array(NonEmpty.max(120)).max(12).optional().default([]),
});

export type Face05Legacy = z.infer<typeof Face05LegacySchema>;

/** Face 06 verification experiment — legacy flat shape (7 questions). */
export const Face06VerificationExperimentSchema = z.object({
  hypothesis: NonEmpty.max(480),
  action: NonEmpty.max(480),
  observe: NonEmpty.max(480),
  window: NonEmpty.max(240),
  success_criteria: NonEmpty.max(480),
  if_fail: NonEmpty.max(480),
  defer_costs: NonEmpty.max(480),
});

export type Face06VerificationExperiment = z.infer<
  typeof Face06VerificationExperimentSchema
>;

const Page06SectionIdEnum = z.enum([
  "first_step",
  "execution_actions",
  "validation_experiments",
  "personal_execution_adjustments",
  "phase_rhythm",
  "resource_boundaries",
  "evidence_boundary",
]);

const Page06RefIds = z.array(NonEmpty.max(80)).max(8).default([]);
const Page06FactIds = z.array(NonEmpty.max(120)).max(8).default([]);

/** Face 06 — 策略执行与验证 (Strategy Execution & Validation · Batch 1). */
export const Face06V2Schema = z.object({
  page: z.literal("06"),
  face: z.literal("06"),
  schema_version: z.literal("face06-v2").default("face06-v2"),
  locale: DecisionReportLocaleSchema.optional(),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  primary_path_id: NonEmpty.max(80),
  fallback_path_ids: z.array(NonEmpty.max(80)).max(4).default([]),
  first_step: z.object({
    action_id: NonEmpty.max(80),
    path_id: NonEmpty.max(80),
    what: NonEmpty.max(720),
    why_now: NonEmpty.max(480),
    required_resources: z.array(NonEmpty.max(240)).max(8).default([]),
    expected_observable_result: NonEmpty.max(480),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: Page06RefIds,
    reality_fact_ids: Page06FactIds,
  }),
  execution_actions: z
    .array(
      z.object({
        action_id: NonEmpty.max(80),
        path_id: NonEmpty.max(80),
        sequence: z.number().int().min(1).max(24),
        action: NonEmpty.max(720),
        rationale: NonEmpty.max(480),
        resources: z.array(NonEmpty.max(240)).max(8).default([]),
        dependencies: z.array(NonEmpty.max(240)).max(8).default([]),
        observable_result: NonEmpty.max(480),
        guardrails: z.array(NonEmpty.max(240)).max(8).default([]),
        claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
        evidence_ids: Page06RefIds,
        reality_fact_ids: Page06FactIds,
      }),
    )
    .min(1)
    .max(12),
  validation_experiments: z
    .array(
      z.object({
        experiment_id: NonEmpty.max(80),
        path_id: NonEmpty.max(80),
        hypothesis: NonEmpty.max(480),
        action: NonEmpty.max(480),
        observe: NonEmpty.max(480),
        window: NonEmpty.max(240),
        success_criteria: NonEmpty.max(480),
        if_fail: NonEmpty.max(480),
        defer_costs: NonEmpty.max(480),
        claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
        evidence_ids: Page06RefIds,
        reality_fact_ids: Page06FactIds,
      }),
    )
    .max(8)
    .default([]),
  /** Required by validator when validation_experiments is empty. */
  experiments_absent_note: z.string().trim().max(480).optional().default(""),
  personal_execution_adjustments: z
    .array(
      z.object({
        adjustment_id: NonEmpty.max(80),
        path_id: NonEmpty.max(80),
        adjustment: NonEmpty.max(720),
        supporting_personal_unit_refs: z
          .array(NonEmpty.max(120))
          .max(8)
          .default([]),
        supporting_reality_fact_ids: Page06FactIds,
        claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
        evidence_ids: Page06RefIds,
      }),
    )
    .max(8)
    .default([]),
  resource_boundaries: z.object({
    time: NonEmpty.max(320),
    money: NonEmpty.max(320),
    people: NonEmpty.max(320),
    energy: NonEmpty.max(320),
    other: z.array(NonEmpty.max(240)).max(8).default([]),
    unknown_or_missing: z.array(NonEmpty.max(240)).max(8).default([]),
  }),
  phase_rhythm: z.object({
    phases: z
      .array(
        z.object({
          phase_id: NonEmpty.max(80),
          goal: NonEmpty.max(480),
          enter_triggers: z.array(NonEmpty.max(240)).max(8).default([]),
          exit_triggers: z.array(NonEmpty.max(240)).max(8).default([]),
        }),
      )
      .min(1)
      .max(6),
    notes: z.string().trim().max(720).optional().default(""),
  }),
  monitoring_contract: z.object({
    path_id: NonEmpty.max(80),
    action_ids: z.array(NonEmpty.max(80)).max(12).default([]),
    experiment_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    observe_signals: z.array(NonEmpty.max(240)).min(1).max(8),
    red_flags: z.array(NonEmpty.max(240)).max(8).default([]),
    review_questions: z.array(NonEmpty.max(240)).max(8).default([]),
    continue_triggers: z.array(NonEmpty.max(240)).max(8).default([]),
    adjust_triggers: z.array(NonEmpty.max(240)).max(8).default([]),
    stop_triggers: z.array(NonEmpty.max(240)).min(1).max(8),
    rerun_triggers: z.array(NonEmpty.max(240)).max(8).default([]),
    resource_guardrails: z.array(NonEmpty.max(240)).max(8).default([]),
    defer_costs: z.array(NonEmpty.max(240)).max(8).default([]),
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(8),
    evidence_ids: Page06RefIds,
    reality_fact_ids: Page06FactIds,
  }),
  evidence_boundary: z.object({
    claim_ids: z.array(NonEmpty.max(80)).min(1).max(12),
    confirmed_fact_ids: z.array(NonEmpty.max(120)).max(12).default([]),
    hypothesis_notes: z.array(NonEmpty.max(240)).max(6).default([]),
    uncertainty_notes: z.array(NonEmpty.max(240)).min(1).max(8),
    experiments_absent_note: z.string().trim().max(480).optional().default(""),
  }),
  reading_order: z
    .array(Page06SectionIdEnum)
    .min(3)
    .max(7)
    .default([
      "first_step",
      "execution_actions",
      "validation_experiments",
      "personal_execution_adjustments",
      "phase_rhythm",
      "resource_boundaries",
      "evidence_boundary",
    ])
    .superRefine((order, ctx) => {
      const seen = new Set<string>();
      for (const id of order) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate reading_order section_id: ${id}`,
          });
          return;
        }
        seen.add(id);
      }
      for (const required of [
        "first_step",
        "execution_actions",
        "validation_experiments",
        "personal_execution_adjustments",
        "phase_rhythm",
        "resource_boundaries",
        "evidence_boundary",
      ] as const) {
        if (!seen.has(required)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `reading_order missing required section: ${required}`,
          });
        }
      }
    }),
  generation_status: z
    .enum([
      "blocked_on_required_inputs",
      "ready_for_generation",
      "generated_with_gaps",
      "generated_complete",
      "failed_structure",
      "incomplete",
    ])
    .optional(),
  input_manifest: z
    .array(
      z.object({
        field_id: NonEmpty.max(80),
        section_id: Page06SectionIdEnum,
        source_kind: z.enum([
          "personal_analysis",
          "reality_context",
          "analytical_result",
          "system_metadata",
          "derived_data",
        ]),
        present: z.boolean(),
        collection_status: z.enum([
          "ready",
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        value_summary: z.string().trim().max(320).nullable(),
      }),
    )
    .max(48)
    .optional(),
  missing_inputs: z
    .array(
      z.object({
        gap_id: NonEmpty.max(80),
        page_id: z.literal("06"),
        section_id: Page06SectionIdEnum,
        field_id: NonEmpty.max(80),
        status: z.enum([
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        why_needed: NonEmpty.max(320),
        affects_content: NonEmpty.max(320),
        follow_up_collect_hint: NonEmpty.max(320),
        handling: z.enum([
          "omit_section_content",
          "defer_generation",
          "generate_conditional_only",
          "show_gap_note_only",
        ]),
      }),
    )
    .max(48)
    .optional(),
  sections: z
    .array(
      z.object({
        section_id: Page06SectionIdEnum,
        segment_letter: z.enum(["A", "B", "C", "D", "E", "F", "G"]),
        title_zh: NonEmpty.max(80),
        title_en: NonEmpty.max(80),
        required: z.boolean(),
        reading_rank: z.number().int().min(1).max(8),
        information_level: NonEmpty.max(40),
      }),
    )
    .max(8)
    .optional(),
  generation_metadata: z
    .object({
      task_id: NonEmpty.max(80),
      prompt_bundle_chars: z.number().int().min(0),
      built_at: NonEmpty.max(64),
      llm_invoked: z.boolean(),
    })
    .optional(),
});

export type Face06V2 = z.infer<typeof Face06V2Schema>;

/** Legacy Face 06 (pre Face06V2) — historical open. */
export const Face06LegacySchema = z.object({
  page: z.literal("06"),
  face: z.literal("06"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  near_step_principle: NonEmpty.max(960),
  stage_climate: NonEmpty.max(720),
  self_retune: NonEmpty.max(720),
  rhythm_note: NonEmpty.max(480),
  verification_experiment: Face06VerificationExperimentSchema.optional(),
});

export type Face06Legacy = z.infer<typeof Face06LegacySchema>;

const Page07SectionIdEnum = z.enum([
  "field_judgment",
  "relationship_interaction",
  "evidence_boundary",
  "alignment_with_main",
]);

const Page07RefIds = z.array(NonEmpty.max(80)).max(8).default([]);
const Page07FactIds = z.array(NonEmpty.max(120)).max(8).default([]);

const Page07ApplicabilityStatusSchema = z.enum([
  "applicable",
  "not_applicable",
  "insufficient_information",
]);

const Page07VerificationStatusSchema = z.enum([
  "confirmed",
  "unverified",
  "unknown",
  "user_stated",
  "missing",
]);

/** Per-fact citation stance — required for every reality_fact_ids entry. */
const Page07RealityFactStanceSchema = z.object({
  fact_id: NonEmpty.max(120),
  stance: z.enum(["as_confirmed", "as_conditional", "as_uncertain"]),
});
const Page07RealityFactStances = z
  .array(Page07RealityFactStanceSchema)
  .max(8)
  .default([])
  .superRefine((stances, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < stances.length; i++) {
      const fid = stances[i]!.fact_id;
      if (seen.has(fid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate_reality_fact_stance:${fid}`,
          path: [i, "fact_id"],
        });
      }
      seen.add(fid);
    }
  });

/** Enforce reality_fact_ids ↔ reality_fact_stances strict 1:1 at schema layer. */
function refinePage07FactStancePairing<
  T extends {
    reality_fact_ids: string[];
    reality_fact_stances: { fact_id: string; stance: string }[];
  },
>(unit: T, ctx: z.RefinementCtx) {
  const ids = unit.reality_fact_ids ?? [];
  const stances = unit.reality_fact_stances ?? [];
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "duplicate_reality_fact_id",
      path: ["reality_fact_ids"],
    });
  }
  const stanceIds = new Set(stances.map((s) => s.fact_id));
  for (const fid of idSet) {
    if (!stanceIds.has(fid)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `missing_reality_fact_stance:${fid}`,
        path: ["reality_fact_stances"],
      });
    }
  }
  for (const s of stances) {
    if (!idSet.has(s.fact_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `orphan_reality_fact_stance:${s.fact_id}`,
        path: ["reality_fact_stances"],
      });
    }
  }
}

/**
 * Face 07 — 场域与关系 (Field & Relationship · Batch 1).
 * Conditionally enabled. Skip / insufficient shapes keep units empty.
 */
export const Face07V2Schema = z.object({
  page: z.literal("07"),
  face: z.literal("07"),
  schema_version: z.literal("face07-v2").default("face07-v2"),
  locale: DecisionReportLocaleSchema.optional(),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  applicability_status: Page07ApplicabilityStatusSchema,
  applicability_reason: NonEmpty.max(720),
  skip_note: z.string().trim().max(720).optional().default(""),
  participants: z
    .array(
      z.object({
        participant_id: NonEmpty.max(80),
        display_label: NonEmpty.max(80),
        role: NonEmpty.max(80),
        source: NonEmpty.max(80),
        verification_status: Page07VerificationStatusSchema,
        related_fact_ids: Page07FactIds,
        notes: z.string().trim().max(320).optional().default(""),
      }),
    )
    .max(12)
    .default([]),
  field_units: z
    .array(
      z
        .object({
          unit_id: NonEmpty.max(80),
          kind: z.enum([
            "field_resource",
            "field_constraint",
            "field_entry_exit",
          ]),
          text: NonEmpty.max(960),
          claim_ids: z.array(NonEmpty.max(80)).max(8).default([]),
          evidence_ids: Page07RefIds,
          reality_fact_ids: Page07FactIds,
          /**
           * One stance per cited reality_fact_id.
           * Non-confirmed DC facts may only use as_conditional | as_uncertain.
           */
          reality_fact_stances: Page07RealityFactStances,
          participant_ids: z.array(NonEmpty.max(80)).max(8).default([]),
          dir_ids: z.array(NonEmpty.max(80)).max(8).default([]),
          supporting_personal_unit_refs: z
            .array(NonEmpty.max(120))
            .max(8)
            .default([]),
        })
        .superRefine(refinePage07FactStancePairing),
    )
    .max(12)
    .default([]),
  relationship_units: z
    .array(
      z
        .object({
          unit_id: NonEmpty.max(80),
          kind: z.enum([
            "power_interest",
            "communication",
            "commitment_conflict",
            "collaboration",
          ]),
          text: NonEmpty.max(960),
          claim_ids: z.array(NonEmpty.max(80)).max(8).default([]),
          evidence_ids: Page07RefIds,
          reality_fact_ids: Page07FactIds,
          reality_fact_stances: Page07RealityFactStances,
          participant_ids: z.array(NonEmpty.max(80)).max(8).default([]),
          uncertainty_notes: z.array(NonEmpty.max(240)).max(6).default([]),
          supporting_personal_unit_refs: z
            .array(NonEmpty.max(120))
            .max(8)
            .default([]),
        })
        .superRefine(refinePage07FactStancePairing),
    )
    .max(12)
    .default([]),
  evidence_boundary: z.object({
    claim_ids: z.array(NonEmpty.max(80)).max(12).default([]),
    confirmed_fact_ids: z.array(NonEmpty.max(120)).max(12).default([]),
    hypothesis_notes: z.array(NonEmpty.max(240)).max(6).default([]),
    uncertainty_notes: z.array(NonEmpty.max(240)).max(8).default([]),
    third_party_data_limits: z.array(NonEmpty.max(320)).max(8).default([]),
    supporting_personal_unit_refs: z
      .array(NonEmpty.max(120))
      .max(8)
      .default([]),
  }),
  alignment_with_main: z.object({
    changes_page01_recommendation: z.boolean(),
    changes_page05_path_order: z.boolean(),
    effect_on_page06_execution: z.string().trim().max(720).default(""),
    summary: z.string().trim().max(960).default(""),
    claim_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    evidence_ids: Page07RefIds,
    related_page05_path_ids: z.array(NonEmpty.max(80)).max(8).default([]),
    related_page06_action_ids: z.array(NonEmpty.max(80)).max(12).default([]),
  }),
  reading_order: z
    .array(Page07SectionIdEnum)
    .min(4)
    .max(4)
    .default([
      "field_judgment",
      "relationship_interaction",
      "evidence_boundary",
      "alignment_with_main",
    ])
    .superRefine((order, ctx) => {
      const seen = new Set<string>();
      for (const id of order) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate reading_order section_id: ${id}`,
          });
          return;
        }
        seen.add(id);
      }
      for (const required of [
        "field_judgment",
        "relationship_interaction",
        "evidence_boundary",
        "alignment_with_main",
      ] as const) {
        if (!seen.has(required)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `reading_order missing required section: ${required}`,
          });
        }
      }
    }),
  /** Program flag. Model must not set this true without an authorized profile. */
  authorized_partner_profile: z.boolean().optional().default(false),
  generation_status: z
    .enum([
      "blocked_on_required_inputs",
      "ready_for_generation",
      "generated_with_gaps",
      "generated_complete",
      "failed_structure",
      "incomplete",
      "skipped_not_applicable",
      "insufficient_information",
    ])
    .optional(),
  input_manifest: z
    .array(
      z.object({
        field_id: NonEmpty.max(80),
        section_id: Page07SectionIdEnum,
        source_kind: z.enum([
          "personal_analysis",
          "reality_context",
          "analytical_result",
          "system_metadata",
          "derived_data",
        ]),
        present: z.boolean(),
        collection_status: z.enum([
          "ready",
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        value_summary: z.string().trim().max(320).nullable(),
      }),
    )
    .max(48)
    .optional(),
  missing_inputs: z
    .array(
      z.object({
        gap_id: NonEmpty.max(80),
        page_id: z.literal("07"),
        section_id: Page07SectionIdEnum,
        field_id: NonEmpty.max(80),
        status: z.enum([
          "missing",
          "unknown",
          "conflict",
          "unverified",
          "declined",
          "not_applicable",
        ]),
        why_needed: NonEmpty.max(320),
        affects_content: NonEmpty.max(320),
        follow_up_collect_hint: NonEmpty.max(320),
        handling: z.enum([
          "omit_section_content",
          "defer_generation",
          "generate_conditional_only",
          "show_gap_note_only",
        ]),
      }),
    )
    .max(48)
    .optional(),
  sections: z
    .array(
      z.object({
        section_id: Page07SectionIdEnum,
        segment_letter: z.enum(["A", "B", "C", "D"]),
        title_zh: NonEmpty.max(80),
        title_en: NonEmpty.max(80),
        required: z.boolean(),
        reading_rank: z.number().int().min(1).max(8),
        information_level: NonEmpty.max(40),
      }),
    )
    .max(8)
    .optional(),
  generation_metadata: z
    .object({
      task_id: NonEmpty.max(80),
      prompt_bundle_chars: z.number().int().min(0),
      built_at: NonEmpty.max(64),
      llm_invoked: z.boolean(),
    })
    .optional(),
});

export type Face07V2 = z.infer<typeof Face07V2Schema>;

/** Legacy Face 07 flat slots — historical open. */
export const Face07LegacySchema = z.object({
  page: z.literal("07"),
  face: z.literal("07"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  field_judgment: NonEmpty.max(960),
  relation_interaction: NonEmpty.max(960),
  evidence_fold: NonEmpty.max(1200),
  align_with_01_05: z.string().trim().max(480).optional().default(""),
});

export type Face07Legacy = z.infer<typeof Face07LegacySchema>;

/** Legacy Face 01 (pre Batch 0) — retained for historical report open. */
export const Face01LegacySchema = z.object({
  page: z.literal("01"),
  face: z.literal("01"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  main_recommendation: NonEmpty.max(480),
  conditions: NonEmpty.max(720),
  not_choosing: NonEmpty.max(480),
  evidence_pointer: NonEmpty.max(240),
});

export type Face01Legacy = z.infer<typeof Face01LegacySchema>;

/** Glossary appendix (internal id 03) — meta only; no chart dump. */
export const Face03GlossarySchema = z.object({
  page: z.literal("03"),
  face: z.literal("03"),
  kind: z.literal("glossary_appendix"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  reading_note: NonEmpty.max(720),
  /** term_id only — soft labels resolved from SSOT at render. */
  term_ids: z.array(NonEmpty.max(80)).max(80),
});

export type Face03Glossary = z.infer<typeof Face03GlossarySchema>;

/** Legacy chart appendix — historical open only. */
export const Face03ChartLegacySchema = z.object({
  page: z.literal("03"),
  face: z.literal("03"),
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  bazi_slice: NonEmpty.max(1600),
  ziwei_slice: z.string().trim().max(1600).optional().default(""),
  contrast: z.string().trim().max(320).optional().default(""),
});

export type Face03ChartLegacy = z.infer<typeof Face03ChartLegacySchema>;
