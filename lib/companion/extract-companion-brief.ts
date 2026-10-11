/**
 * Deterministic CompanionBrief from delivery page_schema (P1 + P3).
 */

import { extractPageSchemaFromMarkdown } from "@/lib/llm/pro/delivery/page-schema/render";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { splitSections } from "@/lib/poju/delivery-report-v2-split";

import { normalizeCompanionLocale } from "./locale-voice";
import {
  CompanionBriefSchema,
  type CompanionBrief,
  type CompanionTrackBrief,
} from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function collectMeans(toolkit: Record<string, unknown> | null): string[] {
  if (!toolkit) return [];
  const angles = Array.isArray(toolkit.angles) ? toolkit.angles : [];
  const out: string[] = [];
  for (const a of angles) {
    const ar = asRecord(a);
    if (!ar) continue;
    const means = Array.isArray(ar.means) ? ar.means : [];
    for (const m of means) {
      const t = str(m);
      if (t) out.push(t);
    }
    const strategy = str(ar.strategy);
    if (strategy && out.length === 0) out.push(strategy.slice(0, 280));
  }
  return out;
}

function trackFromP1(
  role: "primary" | "backup",
  page: Record<string, unknown>,
): CompanionTrackBrief | null {
  const t = asRecord(page[role]);
  if (!t) return null;
  const name = str(t.name);
  const claim = str(t.core_logic) || str(t.why) || name;
  if (!name || !claim) return null;
  return {
    role,
    name,
    claim: claim.slice(0, 1200),
    strategy_excerpt: str(t.strategic_goal) || str(t.why),
    means_excerpts: [claim.slice(0, 200)],
  };
}

function mergeP3Means(
  track: CompanionTrackBrief,
  toolkit: Record<string, unknown> | null,
): CompanionTrackBrief {
  const means = collectMeans(toolkit);
  const title = str(toolkit?.title);
  return {
    ...track,
    name: title || track.name,
    strategy_excerpt:
      means[0]?.slice(0, 400) ||
      track.strategy_excerpt ||
      track.claim.slice(0, 400),
    means_excerpts: means.length ? means.slice(0, 12) : track.means_excerpts,
  };
}

function findPage(
  schemas: Partial<Record<string, DeliveryPageData>> | undefined,
  key: string,
  fullText: string,
): DeliveryPageData | null {
  const fromMeta = schemas?.[key];
  if (fromMeta && fromMeta.page === key) return fromMeta;
  const sections = splitSections(fullText);
  for (const sec of sections) {
    const page = extractPageSchemaFromMarkdown(sec.body);
    if (page && page.page === key) return page;
  }
  const re = /```poju-page-schema\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fullText)) != null) {
    try {
      const parsed = JSON.parse(m[1]!.trim()) as unknown;
      const rec = asRecord(parsed);
      if (!rec) continue;
      const nested = asRecord(rec.page);
      const pageObj = (nested ?? rec) as DeliveryPageData;
      if (pageObj && pageObj.page === key) return pageObj;
    } catch {
      /* skip */
    }
  }
  return null;
}

/**
 * Build brief from page_schemas map and/or full_text fences.
 * Throws if primary/backup cannot be extracted.
 */
export function extractCompanionBrief(input: {
  fullText: string;
  locale: string;
  originalQuestion?: string;
  pageSchemas?: Partial<Record<string, DeliveryPageData>>;
}): CompanionBrief {
  const p1 = findPage(input.pageSchemas, "direct_answer", input.fullText);
  const p3 = findPage(input.pageSchemas, "science_action", input.fullText);
  if (!p1 || p1.page !== "direct_answer") {
    throw new Error("companion_brief_missing_p1");
  }
  const p1r = p1 as unknown as Record<string, unknown>;
  let primary = trackFromP1("primary", p1r);
  let backup = trackFromP1("backup", p1r);
  if (!primary || !backup) {
    throw new Error("companion_brief_missing_tracks");
  }
  if (p3 && p3.page === "science_action") {
    const p3r = p3 as unknown as Record<string, unknown>;
    primary = mergeP3Means(primary, asRecord(p3r.primary_toolkit));
    backup = mergeP3Means(backup, asRecord(p3r.backup_toolkit));
  }
  return CompanionBriefSchema.parse({
    schemaVersion: 1,
    primary,
    backup,
    locale: normalizeCompanionLocale(input.locale),
    original_question: input.originalQuestion?.trim() || undefined,
  });
}

/** Pick means focus for dayIndex (deterministic rotation within track). */
export function meansFocusForDay(
  track: CompanionTrackBrief,
  dayIndex: number,
): string {
  const list = track.means_excerpts;
  if (!list.length) return track.strategy_excerpt || track.claim;
  return list[dayIndex % list.length]!;
}
