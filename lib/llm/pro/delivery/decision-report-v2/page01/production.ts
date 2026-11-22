/**
 * Face 01 production orchestration — used by content-body / Lab.
 * Prompt pair + validation + one targeted repair prompt.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { Face01V2Schema, type Face01V2 } from "../schemas";
import { buildTermAllowlist } from "../term-allowlist";
import { seedEvidenceRegistryForFace01 } from "../registry-from-sources";
import { buildFace01PromptPair } from "./prompt";
import {
  buildDecisionReportInput,
  page01SliceLooksOversized,
  sliceForPage01,
  type Page01FeedSlice,
} from "./slice";
import { validateFace01Output, type Face01Issue } from "./validate";
import type { EvidenceRegistry } from "../types";
import { faceFillShapeSkeleton } from "@/lib/llm/pro/delivery/page-schema/face-types";

export const FACE01_PROMPT_VERSION = "face01-v2-prod-2026-11-22" as const;
export const FACE01_SCHEMA_VERSION = "face01-v2" as const;

export type Face01ProductionContext = {
  slice: Page01FeedSlice;
  registry: EvidenceRegistry;
  knownFactIds: Set<string>;
  page02PlannedEvidenceIds: string[];
  termAllowlistSize: number;
  prompt_version: typeof FACE01_PROMPT_VERSION;
  schema_version: typeof FACE01_SCHEMA_VERSION;
  system: string;
  user: string;
};

export type Face01ProductionBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
};

export type Face01ProductionBuildOk = {
  ok: true;
  ctx: Face01ProductionContext;
};

export function buildFace01ProductionContext(input: {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
}): Face01ProductionBuildOk | Face01ProductionBuildFail {
  if (!input.dc) {
    return { ok: false, reason: "face01_missing_decision_context" };
  }
  const seeded = seedEvidenceRegistryForFace01({
    dc: input.dc,
    pack: input.pack,
    maxFacts: 16,
  });
  if (!seeded.key_claims.length && !seeded.page02PlannedEvidenceIds.length) {
    // Still allow generate with DC-only if pack thin — model must stay provisional.
  }

  const report = buildDecisionReportInput({
    report_id: input.report_id,
    locale: input.locale,
    dc: input.dc,
    personal_analysis: {
      profile_version: input.pack?.cfp_hash ?? "dc",
      available_domains: ["bazi", "ziwei"].filter(Boolean),
      relevant_anchors: seeded.anchors.slice(0, 20),
      approved_readings: seeded.readings.slice(0, 16),
    },
    report_analysis: {
      decision_synthesis: {
        preferred_from_pack: seeded.key_claims.slice(0, 3).map((c) => c.claim_id),
      },
      candidate_paths: [],
      key_claims: seeded.key_claims.slice(0, 8),
      unresolved_issues: (input.dc.conflicts ?? [])
        .filter((c) => c.state !== "clarified")
        .slice(0, 6)
        .map((c) => ({
          conflict_id: c.conflict_id,
          field: c.conflict_field,
          state: c.state,
        })),
    },
  });

  // Only facts/readings that survived seed (already capped).
  const relevantFactIds = new Set(seeded.facts.map((f) => f.fact_id));
  const relevantReadingIds = new Set(
    seeded.readings.map((r) => r.reading_id),
  );

  const slice = sliceForPage01({
    report,
    registry: seeded.registry,
    relevantFactIds,
    relevantReadingIds,
  });

  // Drop evidence not needed for page 01 / planned 02 cites.
  const keepEv = new Set([
    ...Object.values(seeded.registry.evidence)
      .filter((e) => e.source_type === "reality_fact")
      .map((e) => e.evidence_id),
    ...seeded.page02PlannedEvidenceIds,
    ...seeded.key_claims.flatMap((c) => c.evidence_ids),
  ]);
  slice.evidence_registry.evidence = slice.evidence_registry.evidence.filter(
    (e) => keepEv.has(e.evidence_id),
  );
  slice.evidence_registry.claim_ids = Object.keys(seeded.registry.claims).slice(
    0,
    12,
  );

  const oversized = page01SliceLooksOversized(slice);
  if (oversized.length) {
    return {
      ok: false,
      reason: "face01_slice_oversized",
      detail: oversized.join(","),
    };
  }

  const allowlist = buildTermAllowlist({
    locale: input.locale,
    readings: slice.personal_analysis.approved_readings,
  });

  const shape = faceFillShapeSkeleton("01");
  const { system, user } = buildFace01PromptPair({
    slice,
    termAllowlist: allowlist,
    jsonSchemaHint: JSON.stringify(shape, null, 2),
  });

  return {
    ok: true,
    ctx: {
      slice,
      registry: seeded.registry,
      knownFactIds: seeded.knownFactIds,
      page02PlannedEvidenceIds: seeded.page02PlannedEvidenceIds,
      termAllowlistSize: allowlist.length,
      prompt_version: FACE01_PROMPT_VERSION,
      schema_version: FACE01_SCHEMA_VERSION,
      system,
      user,
    },
  };
}

export function collectCitedTermIdsFromFace01(
  page: Face01V2,
  registry: EvidenceRegistry,
): string[] {
  const evidenceIds = new Set<string>([
    ...page.why_this_path.flatMap((w) => w.evidence_ids),
    ...page.not_recommended.flatMap((n) => n.evidence_ids),
  ]);
  const terms: string[] = [];
  const seen = new Set<string>();
  for (const id of evidenceIds) {
    const ev = registry.evidence[id];
    if (!ev?.term_ids?.length) continue;
    for (const t of ev.term_ids) {
      const key = t.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      terms.push(key);
    }
  }
  return terms;
}

export function validateFace01ProductionOutput(input: {
  raw: unknown;
  locale: string;
  ctx: Face01ProductionContext;
}):
  | { ok: true; page: Face01V2; cited_term_ids: string[] }
  | { ok: false; issues: Face01Issue[]; reason: string } {
  // During body generate, page 02 content is not yet assembled — allow planned ids
  // that exist in registry (seeded from pack). requirePage02Targets checks registry.
  const result = validateFace01Output({
    raw: input.raw,
    locale: input.locale,
    registry: input.ctx.registry,
    knownFactIds: input.ctx.knownFactIds,
    requirePage02Targets: true,
  });
  if (!result.ok) {
    return {
      ok: false,
      issues: result.issues,
      reason: "face01_validation_failed",
    };
  }
  return {
    ok: true,
    page: result.page,
    cited_term_ids: collectCitedTermIdsFromFace01(
      result.page,
      input.ctx.registry,
    ),
  };
}

/** Targeted repair prompt — includes concrete validation errors. */
export function buildFace01RepairUserMessage(input: {
  previousUser: string;
  previousRaw: string;
  issues: Face01Issue[];
}): string {
  const issueLines = input.issues
    .slice(0, 12)
    .map((i) => {
      const path = "path" in i && i.path ? ` @${i.path}` : "";
      return `- [${i.code}]${path} ${i.detail}`;
    })
    .join("\n");
  return [
    input.previousUser,
    "",
    "## 校验失败 · 定向修复（唯一一次）",
    "上一稿未通过程序校验。请只修正下列问题后重新输出完整 JSON（仍须符合 Face01V2 schema）。",
    "不得新增输入中不存在的 fact_id / reading_id / evidence_id / claim_id。",
    "不得用 Markdown 包裹。",
    "错误列表：",
    issueLines,
    "",
    "## 上一稿（仅供对照，勿原样复读违规正文）",
    input.previousRaw.slice(0, 6000),
  ].join("\n");
}

export function parseFace01JsonStrict(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  // Reject markdown fences — fail closed (caller may strip once for repair only).
  if (/^```/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function face01SliceSummary(ctx: Face01ProductionContext): Record<string, unknown> {
  return {
    prompt_version: ctx.prompt_version,
    schema_version: ctx.schema_version,
    report_id: ctx.slice.report_id,
    locale: ctx.slice.locale,
    fact_count: ctx.slice.reality_context.facts.length,
    reading_count: ctx.slice.personal_analysis.approved_readings.length,
    claim_count: ctx.slice.evidence_registry.claim_ids.length,
    evidence_count: ctx.slice.evidence_registry.evidence.length,
    page02_planned: ctx.page02PlannedEvidenceIds.length,
    term_allowlist: ctx.termAllowlistSize,
    question: ctx.slice.decision.question.slice(0, 160),
  };
}

/** Re-export schema for callers that need zod without circular imports. */
export { Face01V2Schema };
