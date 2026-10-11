/**
 * Seal-time: brief + liuri pack + empty day records → CompanionJob.
 */

import { randomUUID } from "crypto";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { resolveBaziDayContext } from "@/lib/calculations/liuri";

import { buildLiuriPack } from "./build-liuri-pack";
import { addDaysKey, formatDateKey } from "./date-keys";
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
