/**
 * Face 02 production orchestration — used by content-body / Lab.
 * Prompt pair + validation + one targeted repair prompt.
 *
 * Invariant: ctx.registry / knownFactIds are exactly the IDs in the model slice.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import { Face02V2Schema, type Face02V2 } from "../schemas";
import { buildTermAllowlist } from "../term-allowlist";
import {
  restrictRegistryToPage02Slice,
  seedEvidenceRegistryForFace02,
} from "../registry-from-sources";
import { resolveAvailablePersonalDomains } from "../personal-domains";
import type { FactSelectionResult } from "../fact-relevance";
import { buildFace02PromptPair } from "./prompt";
import {
  buildDecisionReportInputForPage02,
  page02SliceLooksOversized,
  sliceForPage02,
  type Page02FeedSlice,
} from "./slice";
import { validateFace02Output, type Face02Issue } from "./validate";
import type { EvidenceRegistry } from "../types";
import { faceFillShapeSkeleton } from "@/lib/llm/pro/delivery/page-schema/face-types";
import { collectFace02RealizedEvidenceIds } from "./body-blob";
import { isFace01V2 } from "../page01/legacy-adapter";
import type { Face01V2 } from "../schemas";
import {
  buildCrediblePage02FactClaimPairs,
  type CredibleFactClaimPair,
} from "./credible-fact-claim";

export const FACE02_PROMPT_VERSION = "face02-v2-prod-2026-11-22" as const;
export const FACE02_SCHEMA_VERSION = "face02-v2" as const;

export type Face02ProductionContext = {
  slice: Page02FeedSlice;
  registry: EvidenceRegistry;
  knownFactIds: Set<string>;
  factStatusById: Map<string, string>;
  factContentById: Map<string, string>;
  termAllowlistSize: number;
  prompt_version: typeof FACE02_PROMPT_VERSION;
  schema_version: typeof FACE02_SCHEMA_VERSION;
  system: string;
  user: string;
  fact_selection: FactSelectionResult;
  available_domains: string[];
  profile_version: string;
  domain_versions: { bazi?: string; ziwei?: string };
  page01_core_judgment: string | null;
  /**
   * Read-only DC-credible (claim, fact) pairs. Never written into
   * claim.evidence_ids / evidence.supports_claim_ids.
   */
  credible_fact_claim_pairs: CredibleFactClaimPair[];
  credible_fact_claim_keys: Set<string>;
};

export type Face02ProductionBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
};

export type Face02ProductionBuildOk = {
  ok: true;
  ctx: Face02ProductionContext;
};

export function buildFace02ProductionContext(input: {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  chart_fact_pack?: string | null;
  ziwei_fact_pack?: ZiweiFactPack | null;
  bazi_available?: boolean;
  ziwei_available?: boolean;
  /** Optional Page01 schema for alignment context only. */
  page01?: unknown;
}): Face02ProductionBuildOk | Face02ProductionBuildFail {
  if (!input.dc) {
    return { ok: false, reason: "face02_missing_decision_context" };
  }

  const domains = resolveAvailablePersonalDomains({
    pack: input.pack,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: input.ziwei_fact_pack,
    bazi_available: input.bazi_available,
    ziwei_available: input.ziwei_available,
  });

  const seeded = seedEvidenceRegistryForFace02({
    dc: input.dc,
    pack: input.pack,
    maxFacts: 16,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: input.ziwei_fact_pack,
    bazi_available: domains.bazi_available,
    ziwei_available: domains.ziwei_available,
  });

  let page01_core: string | null = null;
  let why_paths: string[] = [];
  if (isFace01V2(input.page01)) {
    const p01 = input.page01 as Face01V2;
    page01_core = p01.core_judgment.text;
    why_paths = p01.why_this_path.map((w) => w.text).slice(0, 3);
  }

  const report = buildDecisionReportInputForPage02({
    report_id: input.report_id,
    locale: input.locale,
    dc: input.dc,
    personal_analysis: {
      profile_version: domains.profile_version,
      available_domains: domains.available_domains,
      relevant_anchors: seeded.anchors.slice(0, 20),
      approved_readings: seeded.readings.slice(0, 16),
    },
    report_analysis: {
      decision_synthesis: {
        preferred_from_pack: seeded.key_claims.slice(0, 3).map((c) => c.claim_id),
        fact_selection: {
          sparse_structured_links: seeded.fact_selection.sparse_structured_links,
          linked_ids: seeded.fact_selection.selected
            .filter((r) => r.kind === "linked")
            .map((r) => r.fact.fact_id),
          candidate_ids: seeded.fact_selection.selected
            .filter((r) => r.kind === "candidate")
            .map((r) => r.fact.fact_id),
          excluded_ids: seeded.fact_selection.excluded_fact_ids,
        },
        domain_versions: domains.domain_versions,
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

  const relevantFactIds = new Set(seeded.facts.map((f) => f.fact_id));
  const relevantReadingIds = new Set(
    seeded.readings.map((r) => r.reading_id),
  );
  const factSelectionById = new Map(
    seeded.fact_selection.selected.map((r) => [
      r.fact.fact_id,
      { kind: r.kind, reasons: r.reasons },
    ]),
  );

  let slice = sliceForPage02({
    report,
    registry: seeded.registry,
    relevantFactIds,
    relevantReadingIds,
    factSelectionById,
    domain_versions: domains.domain_versions,
    page01_judgment_context: {
      core_judgment_text: page01_core,
      why_paths,
    },
  });

  // Keep only Face02-relevant evidence (personal + selected facts + key claims).
  const keepEv = new Set([
    ...Object.values(seeded.registry.evidence)
      .filter((e) => e.source_type === "reality_fact")
      .filter((e) => relevantFactIds.has(e.source_id))
      .map((e) => e.evidence_id),
    ...Object.values(seeded.registry.evidence)
      .filter((e) => e.source_type === "personal_reading")
      .filter((e) => relevantReadingIds.has(e.source_id))
      .map((e) => e.evidence_id),
    ...seeded.key_claims.flatMap((c) => c.evidence_ids),
  ]);
  slice.evidence_registry.evidence = slice.evidence_registry.evidence.filter(
    (e) => keepEv.has(e.evidence_id),
  );
  slice.evidence_registry.claim_ids = seeded.key_claims
    .map((c) => c.claim_id)
    .filter((id) => seeded.registry.claims[id] != null)
    .slice(0, 12);

  const restricted = restrictRegistryToPage02Slice({ seeded, slice });
  // Do NOT mutate registry fact↔claim links. Credible pairs are read-only.
  const credible = buildCrediblePage02FactClaimPairs({
    registry: restricted.registry,
    fact_selection: seeded.fact_selection,
  });
  slice = {
    ...restricted.slice,
    page01_judgment_context: slice.page01_judgment_context,
  };

  const oversized = page02SliceLooksOversized(slice);
  if (oversized.length) {
    return {
      ok: false,
      reason: "face02_slice_oversized",
      detail: oversized.join(","),
    };
  }

  const allowlist = buildTermAllowlist({
    locale: input.locale,
    readings: slice.personal_analysis.approved_readings,
  });

  const shape = faceFillShapeSkeleton("02");
  const { system, user } = buildFace02PromptPair({
    slice,
    termAllowlist: allowlist,
    jsonSchemaHint: JSON.stringify(shape, null, 2),
  });

  const factStatusById = new Map<string, string>();
  const factContentById = new Map<string, string>();
  for (const f of slice.reality_context.facts) {
    factStatusById.set(f.fact_id, f.status);
    factContentById.set(f.fact_id, f.content);
  }

  return {
    ok: true,
    ctx: {
      slice,
      registry: restricted.registry,
      knownFactIds: restricted.knownFactIds,
      factStatusById,
      factContentById,
      termAllowlistSize: allowlist.length,
      prompt_version: FACE02_PROMPT_VERSION,
      schema_version: FACE02_SCHEMA_VERSION,
      system,
      user,
      fact_selection: seeded.fact_selection,
      available_domains: domains.available_domains,
      profile_version: domains.profile_version,
      domain_versions: domains.domain_versions,
      page01_core_judgment: page01_core,
      credible_fact_claim_pairs: credible.pairs,
      credible_fact_claim_keys: credible.pairKeys,
    },
  };
}

export function collectCitedTermIdsFromFace02(
  page: Face02V2,
  registry: EvidenceRegistry,
): string[] {
  const evidenceIds = new Set(collectFace02RealizedEvidenceIds(page));
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

export function validateFace02ProductionOutput(input: {
  raw: unknown;
  locale: string;
  ctx: Face02ProductionContext;
}):
  | { ok: true; page: Face02V2; cited_term_ids: string[]; realized_evidence_ids: string[] }
  | { ok: false; issues: Face02Issue[]; reason: string } {
  const result = validateFace02Output({
    raw: input.raw,
    locale: input.locale,
    registry: input.ctx.registry,
    knownFactIds: input.ctx.knownFactIds,
    factStatusById: input.ctx.factStatusById,
    factContentById: input.ctx.factContentById,
    available_domains: input.ctx.available_domains,
    domain_versions: input.ctx.domain_versions,
    page01_core_judgment: input.ctx.page01_core_judgment,
    credibleFactClaimKeys: input.ctx.credible_fact_claim_keys,
  });
  if (!result.ok) {
    return {
      ok: false,
      issues: result.issues,
      reason: "face02_validation_failed",
    };
  }
  return {
    ok: true,
    page: result.page,
    cited_term_ids: collectCitedTermIdsFromFace02(
      result.page,
      input.ctx.registry,
    ),
    realized_evidence_ids: collectFace02RealizedEvidenceIds(result.page),
  };
}

export function buildFace02RepairUserMessage(input: {
  previousUser: string;
  previousRaw: string;
  issues: Face02Issue[];
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
    "上一稿未通过程序校验。请只修正下列问题后重新输出完整 JSON（仍须符合 Face02V2 schema）。",
    "不得新增输入中不存在的 fact_id / reading_id / evidence_id / claim_id。",
    "不得越过本页 evidence_registry 边界。",
    "不得用 Markdown 包裹。",
    "错误列表：",
    issueLines,
    "",
    "## 上一稿（仅供对照，勿原样复读违规正文）",
    input.previousRaw.slice(0, 6000),
  ].join("\n");
}

export function parseFace02JsonStrict(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  if (/^```/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function face02SliceSummary(
  ctx: Face02ProductionContext,
): Record<string, unknown> {
  return {
    prompt_version: ctx.prompt_version,
    schema_version: ctx.schema_version,
    report_id: ctx.slice.report_id,
    locale: ctx.slice.locale,
    fact_count: ctx.slice.reality_context.facts.length,
    reading_count: ctx.slice.personal_analysis.approved_readings.length,
    claim_count: ctx.slice.evidence_registry.claim_ids.length,
    evidence_count: ctx.slice.evidence_registry.evidence.length,
    term_allowlist: ctx.termAllowlistSize,
    available_domains: ctx.available_domains,
    profile_version: ctx.profile_version,
    domain_versions: ctx.domain_versions,
    has_page01_context: Boolean(ctx.page01_core_judgment),
    fact_selection: {
      sparse: ctx.fact_selection.sparse_structured_links,
      linked: ctx.fact_selection.selected.filter((r) => r.kind === "linked")
        .length,
      candidate: ctx.fact_selection.selected.filter((r) => r.kind === "candidate")
        .length,
      excluded: ctx.fact_selection.excluded_fact_ids.length,
    },
    question: ctx.slice.decision.question.slice(0, 160),
  };
}

export { Face02V2Schema };
