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
});

export type CompanionBrief = z.infer<typeof CompanionBriefSchema>;

/**
 * v2 日提醒：宏观四段 + 依据折层（锚定用户问题与 P1 主辅战略，不轮转 P3 具体 means）。
 */
export const CompanionDayCardsSchema = z.object({
  /** 今天是什么 — 今日场域/气口（白话） */
  today_is: z.string().min(1),
  /** 今天适合做什么 — 对着本题主辅边界的宜（宏观） */
  suitable: z.string().min(1),
  /** 今天不适合做什么 — 宜按住的冲动（宏观） */
  unsuitable: z.string().min(1),
  /** 建议 — 一条总拿捏（态度/时机/边界，非具体作业步骤） */
  suggestion: z.string().min(1),
  /**
   * 依据批断：可含 ⟦t:闭集真词⟧ 金字 + 大白话连接；证明今日提醒有流日根。
   */
  evidence: z.string().min(1),
});

export type CompanionDayCards = z.infer<typeof CompanionDayCardsSchema>;

export const CompanionDayStatusSchema = z.enum([
  "pending",
  "generated",
  "delivered",
  "sent",
  "failed",
]);

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
  /** Lean snapshots per day_index — full AtmosEngineSnapshot JSON. */
  liuri_pack: z.array(AtmosEngineSnapshotSchema).min(1).max(COMPANION_WINDOW_DAYS),
  days: z.array(CompanionDayRecordSchema).length(COMPANION_WINDOW_DAYS),
  created_at: z.string(),
  updated_at: z.string(),
  purged_at: z.string().nullable().optional(),
});

export type CompanionJob = z.infer<typeof CompanionJobSchema>;
