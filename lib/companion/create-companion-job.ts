/**
 * Seal-time: brief + liuri pack + empty day records → CompanionJob.
 */

import { randomUUID } from "crypto";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { resolveBaziDayContext } from "@/lib/calculations/liuri";

import { buildLiuriPack } from "./build-liuri-pack";
import { addDaysKey, formatDateKey } from "./date-keys";
import type {
  DyadCompatSummary,
  PartnerBaziPresence,
} from "@/lib/poju/dyad-compat";

import { extractCompanionBrief } from "./extract-companion-brief";
import {
  COMPANION_WINDOW_DAYS,
  CompanionJobSchema,
  type CompanionDayRecord,
  type CompanionJob,
} from "./types";

export type CreateCompanionJobInput = {
  sessionId: string;
  profileId?: string | null;
  fullText: string;
  locale: string;
  originalQuestion?: string;
  pageSchemas?: Partial<Record<string, DeliveryPageData>>;
  structured: ProfileStructured;
  timezone?: string;
  email?: string | null;
  mailOptIn?: boolean;
  /** Override delivery day (tests). Default = today's bazi day in timezone. */
  deliveryDayKey?: string;
  /** Stage-1 dyad — optional relation boundary on Brief (single-person dailies). */
  partner_bazi?: PartnerBaziPresence | null;
  dyad_compat_summary?: DyadCompatSummary | null;
  pivot_chart_path?: import("@/lib/poju/pivot-chart-path").PivotChartPath | null;
  dyad_matrix_pack?: import("@/lib/poju/dyad-matrix-pack").DyadMatrixPack | null;
};

export function createCompanionJob(input: CreateCompanionJobInput): CompanionJob {
  const timezone =
    input.timezone?.trim() ||
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC");

  const deliveryDayKey =
    input.deliveryDayKey?.trim() ||
    formatDateKey(resolveBaziDayContext(new Date(), timezone).baziDay);

  const brief = extractCompanionBrief({
    fullText: input.fullText,
    locale: input.locale,
    originalQuestion: input.originalQuestion,
    pageSchemas: input.pageSchemas,
    partner_bazi: input.partner_bazi,
    dyad_compat_summary: input.dyad_compat_summary,
    pivot_chart_path: input.pivot_chart_path,
    dyad_matrix_pack: input.dyad_matrix_pack,
  });

  const liuri_pack = buildLiuriPack({
    structured: input.structured,
    deliveryDayKey,
    timezone,
  });

  const now = new Date().toISOString();
  const days: CompanionDayRecord[] = [];
  for (let i = 0; i < COMPANION_WINDOW_DAYS; i++) {
    days.push({
      day_index: i,
      date_key: addDaysKey(deliveryDayKey, i),
      status: "pending",
      cards: null,
      error: null,
      generated_at: null,
      delivered_at: null,
      sent_at: null,
    });
  }

  return CompanionJobSchema.parse({
    id: randomUUID(),
    session_id: input.sessionId,
    profile_id: input.profileId ?? null,
    email: input.email ?? null,
    timezone,
    mail_opt_in: input.mailOptIn ?? true,
    delivery_day_key: deliveryDayKey,
    ends_day_key: addDaysKey(deliveryDayKey, COMPANION_WINDOW_DAYS - 1),
    brief,
    liuri_pack,
    days,
    batch_status: "pending",
    batch_gate: null,
    created_at: now,
    updated_at: now,
    purged_at: null,
  });
}
