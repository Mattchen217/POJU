/**
 * Delivery report page schemas (active P1–P6; legacy thirty_day kept for old sessions)
 * — SSOT for JSON slot-fill + UI.
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

/** Per-unit ClaimPlan anchors (calc-first). Empty allowed for legacy wide-in; sanitize enforces for new fills. */
export const ChartAnchorsFieldSchema = z.array(NonEmpty.max(48)).max(8).default([]);
export type ChartAnchorsField = z.infer<typeof ChartAnchorsFieldSchema>;

/** Fixed-tag chrome: model writes case-specific title/subtitle; tag is frontend-only. */
export const PageChromeFieldsSchema = z.object({
  /** Dynamic main title for this case (not the fixed tag). */
  page_title: NonEmpty.max(56),
  /** Dynamic subtitle; empty string allowed when model omits. */
  page_subtitle: z.string().trim().max(80).default(""),
});
export type PageChromeFields = z.infer<typeof PageChromeFieldsSchema>;

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
  /**
   * Visible decision body — full plan narrative (why this path / success look / boundary).
   * Not a P3 SOP checklist; still must be multi-paragraph and substantive.
   */
  core_logic: NonEmpty.max(720),
  why: NonEmpty.max(240),
  when: NonEmpty.max(240),
  /** ClaimPlan: 承重命理真词(先于 core_logic 锁定). */
  chart_anchors: ChartAnchorsFieldSchema,
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
  ...PageChromeFieldsSchema.shape,
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

/**
 * One diagnostic unit on P2: a distinct user-observed surface + structural essence for it.
 * Multiple cards = multiple surfaces from opening/collecting — not one surface analyzed N ways.
 */
export const WhyCardSchema = z.object({
  title: NonEmpty.max(80),
  /** User-real symptom / stuck moment (from opening/collecting) — required; no invented surface. */
  surface: NonEmpty.max(280),
  /** Why THIS surface happens structurally; last card must bridge to P1 primary/backup. */
  essence: NonEmpty.max(480),
  /** ClaimPlan anchors for this card's essence. */
  chart_anchors: ChartAnchorsFieldSchema,
});
export type WhyCard = z.infer<typeof WhyCardSchema>;

/**
 * One complementary strategy angle (P3) or related metaphysics dimension (P4).
 * strategy + means = one actionable pair; evidence hangs per angle in UI.
 * Action list count is flexible (1–6) — do NOT invent a min-3 rule.
 * JSON field remains `means`; UI label is「行动」/ Actions.
 */
export const ActionAngleSchema = z.object({
  name: NonEmpty.max(80),
  /** Strategy dimension body — thicken in prose, not by forcing means count. */
  strategy: NonEmpty.max(560),
  means: z.array(NonEmpty.max(240)).min(1).max(6),
  /** ClaimPlan: lock before strategy/means. */
  chart_anchors: ChartAnchorsFieldSchema,
  /**
   * @deprecated Do not fill or show as a separate「开口」block.
   * Sanitize folds legacy values into means; new fills put spoken lines inside strategy/means.
   */
  exact_script: z.string().trim().max(160).optional(),
  hard_metrics: z.array(NonEmpty.max(160)).max(4).default([]),
});
export type ActionAngle = z.infer<typeof ActionAngleSchema>;

/**
 * P2 · Credible bridge: multi-surface diagnosis → why primary/backup hold.
 * Each why_card = one collecting surface + its essence (not one page-level pair).
 */
export const P2PageSchema = z.object({
  page: z.literal("foundation"),
  ...PageChromeFieldsSchema.shape,
  dashboard: z.array(DashboardMetricSchema).min(1).max(8),
  /** Fill targets 4–5; schema floor 2 keeps older sessions readable. */
  why_cards: z.array(WhyCardSchema).min(2).max(5),
  evidence: z.array(EvidenceSlotSchema).max(16).default([]),
});
export type P2Page = z.infer<typeof P2PageSchema>;

/** P3 track: 1 primary + 1 backup; each has ≥3 complementary strategy dims (angles). */
export const ToolkitTrackSchema = z.object({
  role: TrackRoleSchema,
  title: NonEmpty.max(100),
  angles: z.array(ActionAngleSchema).min(3).max(5),
});
export type ToolkitTrack = z.infer<typeof ToolkitTrackSchema>;

export const P3PageSchema = z.object({
  page: z.literal("science_action"),
  ...PageChromeFieldsSchema.shape,
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

/**
 * P4 · Field-retune / implicit leverage for THIS matter (question + desired outcome).
 * Not dual-track: P3 owns science 1主1辅. P4 = visual/space/rhythm/resource levers from pack.
 * User-visible names use gateway-safe coaching labels; evidence layer keeps closed-set truth.
 * Dimensions = relevant local-calc dims — never restate P3 workplace SOPs.
 */
export const P4PageSchema = z.object({
  page: z.literal("metaphysics_action"),
  ...PageChromeFieldsSchema.shape,
  /** User's question / matter this page serves (echo, not a new answer). */
  question_anchor: NonEmpty.max(280),
  /** What they want to achieve / leave with. */
  desired_outcome: NonEmpty.max(280),
  /** Related true-calc dims only — 有关尽给、无关不硬凑. */
  dimensions: z.array(ActionAngleSchema).min(2).max(6),
  /**
   * @deprecated Opaque UI retired — keep empty. Avoid/pitfalls belong on P5 risk_guard.
   * Wide-in still accepts legacy arrays; UI/render no longer show them.
   */
  leverage: z.array(NonEmpty.max(200)).max(5).default([]),
  /** @deprecated See leverage — P5 owns 避坑/熔断. */
  avoid: z.array(NonEmpty.max(200)).max(5).default([]),
  /** @deprecated Opaque「场域矩阵」retired from UI. */
  field_matrix: z.array(FieldMatrixCellSchema).max(4).default([]),
  evidence: z.array(EvidenceSlotSchema).max(16).default([]),
});
export type P4Page = z.infer<typeof P4PageSchema>;

/** @deprecated Dual-track P4 retired — kept only for sanitize wide-in of old sessions. */
export const EasternTrackSchema = z.object({
  role: TrackRoleSchema,
  title: NonEmpty.max(100),
  dimensions: z.array(ActionAngleSchema).min(1).max(6),
});
export type EasternTrack = z.infer<typeof EasternTrackSchema>;

export const WeekRowSchema = z.object({
  week: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  focus: NonEmpty.max(120),
  actions: z.array(NonEmpty.max(200)).min(1).max(5),
  source_refs: z.array(NonEmpty.max(40)).max(6).default([]),
});

export const P5PageSchema = z.object({
  page: z.literal("thirty_day"),
  ...PageChromeFieldsSchema.shape,
  weeks: z.array(WeekRowSchema).length(4),
  day7_checklist: z.array(NonEmpty.max(160)).min(3).max(10),
  evidence: z.array(EvidenceSlotSchema).max(12).default([]),
});
export type P5Page = z.infer<typeof P5PageSchema>;

/**
 * One circuit-breaker: four planning beats + model-written warm narrative for UI.
 * Display uses `narrative` only — never stitch the four fields in code.
 */
export const RiskItemSchema = z.object({
  /** Planning beat: what showed up (signal / trap / trigger). */
  situation: NonEmpty.max(200),
  /** Planning beat: what to do now. */
  then_do: NonEmpty.max(200),
  /** Planning beat: what to watch next. */
  watch: NonEmpty.max(160),
  /** Planning beat: what must not continue. */
  forbid: NonEmpty.max(160),
  /**
   * User-facing warm paragraph weaving the four beats.
   * Required for new fills; optional only so legacy sessions still sanitize.
   */
  narrative: z.string().trim().max(720).optional(),
  /** ClaimPlan: structure-specific fuse anchors. */
  chart_anchors: ChartAnchorsFieldSchema,
});
export type RiskItem = z.infer<typeof RiskItemSchema>;

/** Active shelf P5 · risk / circuit breakers (key still `risk_guard`). */
export const P6PageSchema = z.object({
  page: z.literal("risk_guard"),
  ...PageChromeFieldsSchema.shape,
  red_lights: z.array(RiskItemSchema).min(2).max(4),
  traps: z.array(RiskItemSchema).min(1).max(3),
  /** Single switch episode (trigger → flip → watch → forbid staying on primary). */
  switch_to_backup: RiskItemSchema,
  protection_rules: z.array(RiskItemSchema).min(2).max(4),
  /**
   * @deprecated No standalone「边界短句」UI — lines belong in traps/protection then_do if needed.
   * Wide-in still accepts; UI no longer shows.
   */
  boundary_script: z.string().trim().max(120).optional(),
  evidence: z.array(EvidenceSlotSchema).max(12).default([]),
});
export type P6Page = z.infer<typeof P6PageSchema>;

/** One near-term checklist row for P6 signals_close. */
export const Day7ItemSchema = z.object({
  /** What to do this week (checkbox label). */
  action: NonEmpty.max(100),
  /** Why this week — near-term slice, not a P3 means restate. */
  why: NonEmpty.max(120),
  /** How you know it's done (tick criteria). */
  done_when: NonEmpty.max(80),
  /** Light chart/Brief anchors for why. */
  chart_anchors: ChartAnchorsFieldSchema,
});
export type Day7Item = z.infer<typeof Day7ItemSchema>;

/** Active shelf P6 · close + near-term actions (key still `signals_close`). */
export const P7PageSchema = z.object({
  page: z.literal("signals_close"),
  ...PageChromeFieldsSchema.shape,
  identity_before: NonEmpty.max(120),
  identity_after: NonEmpty.max(120),
  /** Why this identity shift holds for this case (not a core_logic restate). */
  identity_shift: NonEmpty.max(220),
  identity_shift_anchors: ChartAnchorsFieldSchema,
  quote: NonEmpty.max(120),
  /** How to use the quote when wobbling. */
  quote_use: NonEmpty.max(160),
  immediate_action: NonEmpty.max(160),
  tonight_done_looks_like: NonEmpty.max(160),
  tonight_why: NonEmpty.max(160),
  tonight_anchors: ChartAnchorsFieldSchema,
  /** Absorbs retired 30-day value: 7-day micro checklist (not a 4-week roadmap). */
  day7_micro_actions: z.array(Day7ItemSchema).min(4).max(5),
  /** Closing seal: decision / week lever / fuse — three one-liners. */
  takeaways: z.tuple([NonEmpty.max(80), NonEmpty.max(80), NonEmpty.max(80)]),
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
  unlocked_through_wave: z.enum(["A", "B", "C", "done"]).default("A"),
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
  /** Flattened P4 means from question-anchored dimensions (compact). */
  p4_primary_means: z.array(NonEmpty.max(200)).max(12).default([]),
  /** @deprecated P4 no longer dual-track — always empty on new fills. */
  p4_backup_means: z.array(NonEmpty.max(200)).max(12).default([]),
  /**
   * Chart anchors inherited from P3/P4 ClaimPlans (means lineage).
   * P5/P6 must prefer these when hanging risk/near-term why.
   */
  source_anchors: z.array(NonEmpty.max(48)).max(24).default([]),
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
