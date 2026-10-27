/**
 * Companion drip — primary/backup daily reminders (server-authoritative job).
 */

import { z } from "zod";

import { AtmosEngineSnapshotSchema } from "@/lib/atmos/build-atmos-engine-snapshot";

export const COMPANION_WINDOW_DAYS = 30 as const;

export const CompanionTrackBriefSchema = z.object({
  role: z.enum(["primary", "backup"]),
  name: z.string().min(1),
  claim: z.string().min(1),
  strategy_excerpt: z.string(),
  means_excerpts: z.array(z.string().min(1)).min(1),
});

export type CompanionTrackBrief = z.infer<typeof CompanionTrackBriefSchema>;

export const CompanionBriefSchema = z.object({
  schemaVersion: z.literal(1),
  primary: CompanionTrackBriefSchema,
  backup: CompanionTrackBriefSchema,
  locale: z.string().min(2).max(16),
  original_question: z.string().optional(),
  /**
   * Optional Stage-1 dyad rail (single-person daily unchanged).
   * One short boundary line when Pivot collected/skipped partner chart.
   */
  relation_boundary: z.string().min(1).optional(),
});

export type CompanionBrief = z.infer<typeof CompanionBriefSchema>;

/**
 * v1 决策锚五槽（SSOT §5.4）· 字段名兼容既有存储：
 * today_is=今日主题句 · suitable=适合关注 · suggestion=今天可以做 ·
 * unsuitable=今天需要避免 · evidence=今日锚点（决策原则；可选含传统视角标注）。
 * 流日能量降为可选背景，不作主叙事。
 */
export const CompanionDayCardsSchema = z.object({
  /** 今日主题句 — 贴合策略视角，非空口号 */
  today_is: z.string().min(1),
  /** 适合关注 — 行动/信息类型 */
  suitable: z.string().min(1),
  /** 今天需要避免 — 与本题风险边界相关 */
  unsuitable: z.string().min(1),
  /** 今天可以做 — 类型化建议（非强制任务勾选） */
  suggestion: z.string().min(1),
  /**
   * 今日锚点 — 一条可记住的决策原则；可含可选传统视角标注（⟦t:…⟧），非流日能量主文。
   */
  evidence: z.string().min(1),
});

export type CompanionDayCards = z.infer<typeof CompanionDayCardsSchema>;

export const CompanionDayStatusSchema = z.enum([
  "pending",
  "generated",
  "delivered",
  "sent",
  /** Content wiped after deliver/send — retention: push then delete day. */
  "purged",
  "failed",
]);

/** Whole-window fill + gate before drip. */
export const CompanionBatchStatusSchema = z.enum([
  "pending",
  "filling",
  "ready",
  "failed",
]);

export type CompanionBatchStatus = z.infer<typeof CompanionBatchStatusSchema>;

export const CompanionBatchGateSchema = z.object({
  passed: z.boolean(),
  failed_rule: z.string().optional(),
  detail: z.string().optional(),
  checked_at: z.string(),
  generated_count: z.number().int().optional(),
});

export type CompanionBatchGate = z.infer<typeof CompanionBatchGateSchema>;

export type CompanionDayStatus = z.infer<typeof CompanionDayStatusSchema>;

export const CompanionDayRecordSchema = z.object({
  day_index: z.number().int().min(0).max(COMPANION_WINDOW_DAYS - 1),
  date_key: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: CompanionDayStatusSchema,
  cards: CompanionDayCardsSchema.nullable(),
  error: z.string().nullable().optional(),
  generated_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
});

export type CompanionDayRecord = z.infer<typeof CompanionDayRecordSchema>;

export const CompanionJobSchema = z.object({
  id: z.string().min(1),
  session_id: z.string().min(1),
  profile_id: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  timezone: z.string().min(1),
  mail_opt_in: z.boolean(),
  delivery_day_key: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_day_key: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  brief: CompanionBriefSchema,
  /**
   * Lean snapshots per day_index — full AtmosEngineSnapshot JSON.
   * Empty allowed only after full purge (purged_at set).
   */
  liuri_pack: z.array(AtmosEngineSnapshotSchema).max(COMPANION_WINDOW_DAYS),
  days: z.array(CompanionDayRecordSchema).length(COMPANION_WINDOW_DAYS),
  /** pending → filling (1–2 day invokes) → ready (batch gate pass) | failed */
  batch_status: CompanionBatchStatusSchema.default("pending"),
  batch_gate: CompanionBatchGateSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  purged_at: z.string().nullable().optional(),
  /** Filled reminders-30d HTML (template slots); refreshed on locale mismatch. */
  filled_html: z.string().optional(),
  filled_html_locale: z.string().optional(),
  /**
   * Seal-time closed-set hints from report pages 06/07/08/09 for Daily Anchor.
   * Used by buildDailyAnchorSeeds so pair fills do not fall back to brief-only slices.
   */
  anchor_closed_hints: z
    .object({
      execute: z.array(z.string()).max(16).default([]),
      regulate: z.array(z.string()).max(16).default([]),
      validate: z.array(z.string()).max(16).default([]),
    })
    .optional(),
});

export type CompanionJob = z.infer<typeof CompanionJobSchema>;
