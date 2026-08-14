/**
 * Delivery report page schemas (P1–P7) — SSOT for JSON slot-fill + UI.
 * Keys = DeliverySegmentKey (delivery-schema.ts). Wide-in / sanitize-out.
 */

import { z } from "zod";
import { DELIVERY_SEGMENT_KEYS, type DeliverySegmentKey } from "../delivery-schema";

export const DELIVERY_PAGE_SCHEMA_VERSION = "page_schema_v1" as const;

export const TrackRoleSchema = z.enum(["primary", "backup"]);
export type TrackRole = z.infer<typeof TrackRoleSchema>;

export const DimLevelSchema = z.enum(["high", "mid", "low", "unknown"]);
export type DimLevel = z.infer<typeof DimLevelSchema>;

const NonEmpty = z.string().trim().min(1);

/** Shared evidence slot hung on a UI field after mark call. */
export const EvidenceSlotSchema = z.object({
  field_path: NonEmpty,
  markers: z.array(NonEmpty).max(8).default([]),
  gloss: z.string().trim().max(280).optional(),
});
export type EvidenceSlot = z.infer<typeof EvidenceSlotSchema>;

export const DecisionTrackSchema = z.object({
  role: TrackRoleSchema,
  name: NonEmpty.max(80),
  /** Visible decision body — full plan narrative (P3/P4 only expand levers, not this description). */
  core_logic: NonEmpty.max(720),
  why: NonEmpty.max(240),
  when: NonEmpty.max(240),
  /** One-line strategic goal for P1 decision matrix (fallback: why). */
  strategic_goal: z.string().trim().max(160).optional(),
  /** Key bargaining chip / lever (optional). */
  leverage_chip: z.string().trim().max(160).optional(),
  dims: z
    .object({
      body: DimLevelSchema.default("unknown"),
      mind: DimLevelSchema.default("unknown"),
      field: DimLevelSchema.default("unknown"),
    })
    .default({ body: "unknown", mind: "unknown", field: "unknown" }),
});
export type DecisionTrack = z.infer<typeof DecisionTrackSchema>;

export const P1PageSchema = z.object({
  page: z.literal("direct_answer"),
  core_judgment: NonEmpty.max(220),
  primary: DecisionTrackSchema,
  backup: DecisionTrackSchema,
  evidence: z.array(EvidenceSlotSchema).max(12).default([]),
});
export type P1Page = z.infer<typeof P1PageSchema>;

export const DashboardMetricSchema = z.object({
  key: NonEmpty.max(40),
  label: NonEmpty.max(60),
  /** Must come from metaphysics_pack — never invent. */
  score: z.number().min(0).max(100).nullable().default(null),
  note: z.string().trim().max(160).optional(),
});

export const WhyCardSchema = z.object({
  title: NonEmpty.max(80),
  body: NonEmpty.max(480),
});
export type WhyCard = z.infer<typeof WhyCardSchema>;

/**
 * One complementary strategy angle (P3) or related metaphysics dimension (P4).
 * strategy + means must be a complete pair; evidence hangs per angle in UI.
 */
export const ActionAngleSchema = z.object({
  name: NonEmpty.max(80),
  strategy: NonEmpty.max(400),
  means: z.array(NonEmpty.max(200)).min(1).max(6),
  /** Copy-paste line (≤160 字). Required on P3 science angles. */
  exact_script: z.string().trim().max(160).optional(),
  hard_metrics: z.array(NonEmpty.max(160)).max(4).default([]),
});
export type ActionAngle = z.infer<typeof ActionAngleSchema>;

/** P3 science SOP angle: verbatim script + ≥3 blueprint steps + ≥1 success metric. */
export const ScienceAngleSchema = ActionAngleSchema.extend({
  exact_script: NonEmpty.max(160),
  means: z.array(NonEmpty.max(200)).min(3).max(6),
  hard_metrics: z.array(NonEmpty.max(160)).min(1).max(4),
});
export type ScienceAngle = z.infer<typeof ScienceAngleSchema>;

export const P2PageSchema = z.object({
  page: z.literal("foundation"),
  surface_vs_essence: z.object({
    surface: NonEmpty.max(280),
    essence: NonEmpty.max(320),
  }),
  dashboard: z.array(DashboardMetricSchema).min(1).max(8),
  why_cards: z.array(WhyCardSchema).min(2).max(5),
  evidence: z.array(EvidenceSlotSchema).max(16).default([]),
});
export type P2Page = z.infer<typeof P2PageSchema>;

/** P3 track: align title to P1; ≥3 complementary science SOP angles. */
export const ToolkitTrackSchema = z.object({
  role: TrackRoleSchema,
  title: NonEmpty.max(100),
  angles: z.array(ScienceAngleSchema).min(3).max(5),
});
export type ToolkitTrack = z.infer<typeof ToolkitTrackSchema>;

export const P3PageSchema = z.object({
  page: z.literal("science_action"),
  opening: z.string().trim().max(200).optional(),
  primary_toolkit: ToolkitTrackSchema,
  backup_toolkit: ToolkitTrackSchema,
  alert: z.string().trim().max(240).optional(),
  evidence: z.array(EvidenceSlotSchema).max(16).default([]),
});
export type P3Page = z.infer<typeof P3PageSchema>;

export const FieldMatrixCellSchema = z.object({
  label: NonEmpty.max(40),
  value: NonEmpty.max(120),
});

/** P4 track: related true-calc dimensions only (min 2; fill asks for all relevant). */
export const EasternTrackSchema = z.object({
  role: TrackRoleSchema,
  title: NonEmpty.max(100),
  dimensions: z.array(ActionAngleSchema).min(2).max(6),
});
export type EasternTrack = z.infer<typeof EasternTrackSchema>;

export const P4PageSchema = z.object({
  page: z.literal("metaphysics_action"),
  primary_track: EasternTrackSchema,
  backup_track: EasternTrackSchema,
  leverage: z.array(NonEmpty.max(200)).min(1).max(5),
  avoid: z.array(NonEmpty.max(200)).min(1).max(5),
  field_matrix: z.array(FieldMatrixCellSchema).max(4).default([]),
  evidence: z.array(EvidenceSlotSchema).max(16).default([]),
});
export type P4Page = z.infer<typeof P4PageSchema>;

export const WeekRowSchema = z.object({
  week: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  focus: NonEmpty.max(120),
  actions: z.array(NonEmpty.max(200)).min(1).max(5),
  source_refs: z.array(NonEmpty.max(40)).max(6).default([]),
});

export const P5PageSchema = z.object({
  page: z.literal("thirty_day"),
  weeks: z.array(WeekRowSchema).length(4),
  day7_checklist: z.array(NonEmpty.max(160)).min(3).max(10),
  evidence: z.array(EvidenceSlotSchema).max(12).default([]),
});
export type P5Page = z.infer<typeof P5PageSchema>;

/** Active shelf P5 · risk / circuit breakers (key still `risk_guard`). */
export const P6PageSchema = z.object({
  page: z.literal("risk_guard"),
  red_lights: z.array(NonEmpty.max(200)).min(2).max(6),
  traps: z.array(NonEmpty.max(200)).min(1).max(5),
  switch_to_backup: NonEmpty.max(320),
  protection_rules: z.array(NonEmpty.max(200)).min(2).max(6),
  /** Optional short boundary reply (≤120); not a full legal script. */
  boundary_script: z.string().trim().max(120).optional(),
  evidence: z.array(EvidenceSlotSchema).max(12).default([]),
});
export type P6Page = z.infer<typeof P6PageSchema>;

/** Active shelf P6 · close + near-term actions (key still `signals_close`). */
export const P7PageSchema = z.object({
  page: z.literal("signals_close"),
  identity_before: NonEmpty.max(160),
  identity_after: NonEmpty.max(160),
  quote: NonEmpty.max(200),
  immediate_action: NonEmpty.max(200),
  /** Absorbs retired 30-day value: 7-day micro checklist (not a 4-week roadmap). */
  day7_micro_actions: z.array(NonEmpty.max(160)).min(3).max(5),
  evidence: z.array(EvidenceSlotSchema).max(8).default([]),
});
export type P7Page = z.infer<typeof P7PageSchema>;

export const DeliveryPageSchemaByKey = {
  direct_answer: P1PageSchema,
  foundation: P2PageSchema,
  science_action: P3PageSchema,
  metaphysics_action: P4PageSchema,
  thirty_day: P5PageSchema,
  risk_guard: P6PageSchema,
  signals_close: P7PageSchema,
} as const satisfies Record<DeliverySegmentKey, z.ZodTypeAny>;

export type DeliveryPageSchemaKey = keyof typeof DeliveryPageSchemaByKey;

export const DeliveryPageUnionSchema = z.discriminatedUnion("page", [
  P1PageSchema,
  P2PageSchema,
  P3PageSchema,
  P4PageSchema,
  P5PageSchema,
  P6PageSchema,
  P7PageSchema,
]);
export type DeliveryPageData = z.infer<typeof DeliveryPageUnionSchema>;

export const DeliveryReportPagesV1Schema = z.object({
  version: z.literal(DELIVERY_PAGE_SCHEMA_VERSION),
  pages: z.object({
    direct_answer: P1PageSchema.optional(),
    foundation: P2PageSchema.optional(),
    science_action: P3PageSchema.optional(),
    metaphysics_action: P4PageSchema.optional(),
    thirty_day: P5PageSchema.optional(),
    risk_guard: P6PageSchema.optional(),
    signals_close: P7PageSchema.optional(),
  }),
  unlocked_through_wave: z.enum(["A", "B", "C", "D", "done"]).default("A"),
});
export type DeliveryReportPagesV1 = z.infer<typeof DeliveryReportPagesV1Schema>;

/** Compact brief for Wave C (risk + close) — never full page JSON. */
export const P5ActionBriefSchema = z.object({
  primary_name: NonEmpty.max(80),
  backup_name: NonEmpty.max(80),
  primary_when: z.string().trim().max(240).default(""),
  backup_when: z.string().trim().max(240).default(""),
  p3_primary_script: z.string().trim().max(160).optional(),
  p3_primary_steps: z.array(NonEmpty.max(200)).max(12).default([]),
  p3_backup_steps: z.array(NonEmpty.max(200)).max(12).default([]),
  p3_hard_metrics: z.array(NonEmpty.max(160)).max(8).default([]),
  p4_leverage: z.array(NonEmpty.max(200)).max(5).default([]),
  p4_avoid: z.array(NonEmpty.max(200)).max(5).default([]),
  p4_field_matrix: z.array(FieldMatrixCellSchema).max(4).default([]),
  /** Flattened P4 means from related dimensions (compact). */
  p4_primary_means: z.array(NonEmpty.max(200)).max(12).default([]),
  p4_backup_means: z.array(NonEmpty.max(200)).max(12).default([]),
});
export type P5ActionBrief = z.infer<typeof P5ActionBriefSchema>;

export const P5WeekSummarySchema = z.object({
  weeks: z
    .array(
      z.object({
        week: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        focus: NonEmpty.max(120),
        action_count: z.number().int().min(0).max(5),
      }),
    )
    .max(4)
    .default([]),
  day7_head: z.array(NonEmpty.max(160)).max(5).default([]),
});
export type P5WeekSummary = z.infer<typeof P5WeekSummarySchema>;

export function isDeliverySegmentKey(k: string): k is DeliverySegmentKey {
  return (DELIVERY_SEGMENT_KEYS as readonly string[]).includes(k);
}

export function pageSchemaForSegment(key: DeliverySegmentKey) {
  return DeliveryPageSchemaByKey[key];
}
