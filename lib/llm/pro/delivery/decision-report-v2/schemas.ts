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
    ]),
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
