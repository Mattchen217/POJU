/**
 * Deterministic CompanionBrief from delivery page_schema (P1 + P3).
 */

import { extractPageSchemaFromMarkdown } from "@/lib/llm/pro/delivery/page-schema/render";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { splitSections } from "@/lib/poju/delivery-report-v2-split";

import { formatCompanionRelationBoundary } from "@/lib/poju/dyad-compat";
import type {
  DyadCompatSummary,
  PartnerBaziPresence,
} from "@/lib/poju/dyad-compat";

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
  /** Keep P1 name/claim as strategic rails — never overwrite with P3 toolkit title. */
  return {
    ...track,
    strategy_excerpt:
      track.strategy_excerpt ||
      means[0]?.slice(0, 400) ||
      track.claim.slice(0, 400),
    /** Means are archive-only for companion macro; keep a short sample, prefer P1 claim lead. */
    means_excerpts: means.length
      ? [track.claim.slice(0, 200), ...means.slice(0, 6)]
      : track.means_excerpts,
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

function listField(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => str(x)).filter(Boolean);
  }
  const one = str(v);
  return one ? [one] : [];
}

/**
 * Face-native Brief source: Face 01 main_recommendation + Face 05 paths.
 * Keeps CompanionBrief primary/backup slots for 30-day product compatibility
 * (no product rewrite) — names/claims come from face fields, not P1 主辅纸.
 */
function tracksFromFace01And05(
  face01: Record<string, unknown>,
  face05: Record<string, unknown>,
): { primary: CompanionTrackBrief; backup: CompanionTrackBrief } | null {
  const main = str(face01.main_recommendation);
  const conditions = str(face01.conditions);
  const notChoosing = str(face01.not_choosing);
  if (!main) return null;

  const paths = Array.isArray(face05.paths)
    ? face05.paths
    : Array.isArray(face05.path_options)
      ? face05.path_options
      : [];
  const pathTexts = paths
    .map((p) => {
      if (typeof p === "string") return p.trim();
      const r = asRecord(p);
      if (!r) return "";
      return (
        str(r.name) ||
        str(r.label) ||
        str(r.path) ||
        str(r.summary) ||
        str(r.body)
      );
    })
    .filter(Boolean);
  const switchOrStop =
    str(face05.switch_or_stop) ||
    str(face05.switchStop) ||
    listField(face05.switch_conditions).join("；");

  const primary: CompanionTrackBrief = {
    role: "primary",
    name: main.slice(0, 80) || "main",
    claim: [main, conditions].filter(Boolean).join(" · ").slice(0, 1200),
    strategy_excerpt: conditions || main.slice(0, 400),
    means_excerpts: [
      main.slice(0, 200),
      ...(pathTexts.slice(0, 3).map((t) => t.slice(0, 200))),
    ].filter(Boolean),
  };
  const backupName =
    pathTexts[1] ||
    pathTexts[0] ||
    switchOrStop ||
    notChoosing ||
    "switch_or_stop";
  const backup: CompanionTrackBrief = {
    role: "backup",
    name: backupName.slice(0, 80),
    claim: (
      switchOrStop ||
      pathTexts.slice(1).join("；") ||
      notChoosing ||
      backupName
    ).slice(0, 1200),
    strategy_excerpt: (switchOrStop || notChoosing || backupName).slice(0, 400),
    means_excerpts: [
      (switchOrStop || notChoosing || backupName).slice(0, 200),
      ...pathTexts.slice(0, 4).map((t) => t.slice(0, 200)),
    ].filter(Boolean),
  };
  if (!primary.means_excerpts.length) primary.means_excerpts = [primary.claim.slice(0, 200)];
  if (!backup.means_excerpts.length) backup.means_excerpts = [backup.claim.slice(0, 200)];
  return { primary, backup };
}

/**
 * Build brief from page_schemas map and/or full_text fences.
 * Prefers Face 01+05; falls back to legacy P1+P3 primary/backup.
 */
export function extractCompanionBrief(input: {
  fullText: string;
  locale: string;
  originalQuestion?: string;
  pageSchemas?: Partial<Record<string, DeliveryPageData>>;
  partner_bazi?: PartnerBaziPresence | null;
  dyad_compat_summary?: DyadCompatSummary | null;
  pivot_chart_path?: import("@/lib/poju/pivot-chart-path").PivotChartPath | null;
  dyad_matrix_pack?: import("@/lib/poju/dyad-matrix-pack").DyadMatrixPack | null;
}): CompanionBrief {
  const face01 =
    findPage(input.pageSchemas, "01", input.fullText) ??
    (input.pageSchemas?.["01"] as DeliveryPageData | undefined) ??
    null;
  const face05 =
    findPage(input.pageSchemas, "05", input.fullText) ??
    (input.pageSchemas?.["05"] as DeliveryPageData | undefined) ??
    null;

  let primary: CompanionTrackBrief | null = null;
  let backup: CompanionTrackBrief | null = null;

  if (face01 && face05) {
    const fromFace = tracksFromFace01And05(
      face01 as unknown as Record<string, unknown>,
      face05 as unknown as Record<string, unknown>,
    );
    if (fromFace) {
      primary = fromFace.primary;
      backup = fromFace.backup;
    }
  }

  if (!primary || !backup) {
    /** Prefer canonical keys; also accept legacy alias slots in pageSchemas map. */
    const schemas = input.pageSchemas;
    const p1 =
      findPage(schemas, "decision_brief", input.fullText) ??
      findPage(schemas, "recommended_strategy", input.fullText) ??
      schemas?.["direct_answer"] ??
      schemas?.decision_brief ??
      null;
    const p3 =
      findPage(schemas, "execution_guidance", input.fullText) ??
      schemas?.["science_action"] ??
      schemas?.execution_guidance ??
      null;
    if (
      !p1 ||
      (p1.page !== "decision_brief" && p1.page !== "recommended_strategy")
    ) {
      throw new Error("companion_brief_missing_01_or_p1");
    }
    const p1r = p1 as unknown as Record<string, unknown>;
    primary = trackFromP1("primary", p1r);
    backup = trackFromP1("backup", p1r);
    if (!primary || !backup) {
      throw new Error("companion_brief_missing_tracks");
    }
    if (p3 && p3.page === "execution_guidance") {
      const p3r = p3 as unknown as Record<string, unknown>;
      primary = mergeP3Means(primary, asRecord(p3r.primary_toolkit));
      backup = mergeP3Means(backup, asRecord(p3r.backup_toolkit));
    } else if (p3) {
      /** Legacy science_action blob may still carry toolkits under wrong page tag. */
      const p3r = p3 as unknown as Record<string, unknown>;
      if (asRecord(p3r.primary_toolkit) || asRecord(p3r.backup_toolkit)) {
        primary = mergeP3Means(primary, asRecord(p3r.primary_toolkit));
        backup = mergeP3Means(backup, asRecord(p3r.backup_toolkit));
      }
    }
  }

  const locale = normalizeCompanionLocale(input.locale);
  const relation_boundary =
    formatCompanionRelationBoundary({
      partner_bazi: input.partner_bazi,
      dyad_compat_summary: input.dyad_compat_summary,
      pivot_chart_path: input.pivot_chart_path,
      dyad_matrix_pack: input.dyad_matrix_pack,
      locale,
    }).trim() || undefined;
  return CompanionBriefSchema.parse({
    schemaVersion: 1,
    primary,
    backup,
    locale,
    original_question: input.originalQuestion?.trim() || undefined,
    ...(relation_boundary ? { relation_boundary } : {}),
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
