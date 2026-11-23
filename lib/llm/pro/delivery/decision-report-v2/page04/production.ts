/**
 * Face 04 production orchestration — used by content-body / Lab.
 * UNIQUE entry: buildFace04ProductionContext.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  Face04V2Schema,
  type Face04V2,
  type Face01V2,
  type Face02V2,
} from "../schemas";
import { isFace01V2 } from "../page01/legacy-adapter";
import { isFace02V2 } from "../page02/legacy-adapter";
import { seedEvidenceRegistryForFace04 } from "../registry-from-sources";
import { resolveAvailablePersonalDomains } from "../personal-domains";
import {
  buildPage04ArchitectureEnvelope,
  attachPage04ArchitectureToPage,
  type Page04ArchitectureEnvelope,
} from "./architecture/production-path";
import {
  buildPage04ArchitecturePromptBundle,
  PAGE04_ARCHITECTURE_PROMPT_VERSION,
} from "./architecture/prompt-templates";
import {
  buildFace04PromptPair,
  type Face04ProductionPayload,
} from "./prompt";
import { validateFace04Output, type Face04Issue } from "./validate";
import type { EvidenceRegistry, ReportClaim, ReportEvidence } from "../types";

export type Face04ProductionContext = {
  prompt_version: string;
  schema_version: "face04-v2";
  system: string;
  user: string;
  registry: EvidenceRegistry;
  knownFactIds: Set<string>;
  factStatusById: Map<string, string>;
  factContentById: Map<string, string>;
  available_domains: readonly string[];
  domain_versions: { bazi?: string; ziwei?: string };
  profile_version: string | null;
  page01_core_judgment: string | null;
  architecture: Page04ArchitectureEnvelope;
  architecture_prompt_bundle: string;
  production_payload: Face04ProductionPayload;
  may_invoke_llm: boolean;
};

export type Face04ProductionBuildOk = {
  ok: true;
  ctx: Face04ProductionContext;
};

export type Face04ProductionBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
};

function serializeFact(f: {
  fact_id: string;
  statement: string;
  status: string;
  verification_level: string;
  source_stage: string;
  source_turn_id: string | null;
  user_confirmed: boolean;
  fact_roles?: string[];
  related_dir_ids?: string[];
}): Record<string, unknown> {
  return {
    fact_id: f.fact_id,
    statement: f.statement,
    status: f.status,
    verification_level: f.verification_level,
    source_stage: f.source_stage,
    source_turn_id: f.source_turn_id,
    user_confirmed: f.user_confirmed,
    fact_roles: f.fact_roles ?? [],
    related_dir_ids: f.related_dir_ids ?? [],
  };
}

function page04ClaimRecords(
  registry: EvidenceRegistry,
): ReportClaim[] {
  return Object.values(registry.claims).filter((c) => c.page_id === "04");
}

function page04EvidenceRecords(
  registry: EvidenceRegistry,
  claimIds: ReadonlySet<string>,
): ReportEvidence[] {
  return Object.values(registry.evidence).filter((e) => {
    if (e.supports_claim_ids.some((id) => claimIds.has(id))) return true;
    if (e.limits_claim_ids.some((id) => claimIds.has(id))) return true;
    // Reality facts remain citeable for manifestation / evidence_boundary.
    if (e.source_type === "reality_fact") return true;
    return false;
  });
}

/** UNIQUE production entry for Page04 architecture + prompt. */
export function buildFace04ProductionContext(input: {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  chart_fact_pack?: string | null;
  page01?: unknown;
  page02?: unknown;
}): Face04ProductionBuildOk | Face04ProductionBuildFail {
  if (!input.dc) {
    return { ok: false, reason: "face04_missing_decision_context" };
  }

  const domains = resolveAvailablePersonalDomains({
    pack: input.pack,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
  });

  const seeded = seedEvidenceRegistryForFace04({
    dc: input.dc,
    pack: input.pack,
    maxFacts: 16,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
    bazi_available: domains.bazi_available,
    ziwei_available: domains.ziwei_available,
  });

  // Ready claim count = actual Page04 registry claim records only (not BJ unit count).
  const page04Claims = page04ClaimRecords(seeded.registry);
  const page04ClaimIdSet = new Set(page04Claims.map((c) => c.claim_id));
  const page04Evidence = page04EvidenceRecords(
    seeded.registry,
    page04ClaimIdSet,
  );
  const registryClaimCount = page04Claims.length;

  // Restrict registry exposed to model/validator to Page04-usable records.
  const restrictedRegistry: EvidenceRegistry = {
    claims: Object.fromEntries(page04Claims.map((c) => [c.claim_id, c])),
    evidence: Object.fromEntries(
      page04Evidence.map((e) => [e.evidence_id, e]),
    ),
  };

  let page01_core: string | null = null;
  let page01_conditions: Array<{
    condition: string;
    status: string;
    source_ids?: string[];
  }> = [];
  if (isFace01V2(input.page01)) {
    const p01 = input.page01 as Face01V2;
    page01_core = p01.core_judgment.text;
    page01_conditions = p01.recommendation_conditions.map((c) => ({
      condition: c.condition,
      status: c.status,
      source_ids: c.source_ids,
    }));
  }

  let page02_has = false;
  let page02_count = 0;
  let page02_units: unknown[] | null = null;
  let page02_boundary: unknown | null = null;
  if (isFace02V2(input.page02)) {
    const p02 = input.page02 as Face02V2;
    page02_has =
      Array.isArray(p02.content_units) && p02.content_units.length > 0;
    page02_count = p02.content_units?.length ?? 0;
    page02_units = page02_has ? [...p02.content_units] : null;
    page02_boundary = p02.explanation_boundary ?? null;
  }

  const face04Units = (input.pack?.units ?? []).filter((u) =>
    u.serves_face.includes("04"),
  );

  const facts = input.dc.reality_facts ?? [];
  const confirmed_facts = facts
    .filter((f) => f.status === "confirmed")
    .map(serializeFact);
  const unverified_facts = facts
    .filter((f) => f.status === "unverified")
    .map(serializeFact);
  const declined_or_unknown_facts = facts
    .filter(
      (f) =>
        f.status === "declined" ||
        f.status === "unknown" ||
        f.status === "not_applicable",
    )
    .map(serializeFact);
  const open_conflicts = (input.dc.conflicts ?? [])
    .filter((c) => c.state === "open" || c.state === "unresolved_in_final")
    .map((c) => ({
      conflict_id: c.conflict_id,
      fact_ids: c.fact_ids,
      conflict_field: c.conflict_field,
      statements_snapshot: c.statements_snapshot,
      state: c.state,
      resolution: c.resolution,
      affects_preferred_path: c.affects_preferred_path ?? null,
    }));
  const constraints = (input.dc.constraints ?? []).map((c) => ({
    constraint_id: c.constraint_id,
    statement: c.statement,
    category: c.category,
    status: c.status,
    verification_level: c.verification_level,
    source_stage: c.source_stage,
    source_turn_id: c.source_turn_id,
    rigidity: c.rigidity,
    user_confirmed: c.user_confirmed,
    related_dir_ids: c.related_dir_ids ?? [],
  }));

  const personal_readings = seeded.readings.slice(0, 16).map((r) => ({
    reading_id: r.reading_id,
    domain: (r.scope || "convergence").split(",")[0] || "convergence",
    excerpt: r.interpretation,
  }));

  const snap = {
    report_id: input.report_id,
    locale: input.locale,
    dc: input.dc,
    pack: input.pack,
    page01_core_judgment: page01_core,
    page01_conditions,
    page02_has_content_units: page02_has,
    page02_unit_count: page02_count,
    page03_available: false,
    approved_readings: personal_readings,
    approved_reading_count: personal_readings.length,
    registry_claim_count: registryClaimCount,
  };

  let architecture = buildPage04ArchitectureEnvelope(snap);
  const blocked = architecture.missing_inputs.some(
    (g) => g.handling === "defer_generation",
  );
  if (blocked) {
    architecture = {
      ...architecture,
      generation_status: "blocked_on_required_inputs",
    };
  } else if (architecture.generation_status === "blocked_on_required_inputs") {
    architecture = {
      ...architecture,
      generation_status: "ready_for_generation",
    };
  }

  const bundleText = buildPage04ArchitecturePromptBundle({
    input_manifest: architecture.input_manifest,
    missing_inputs: architecture.missing_inputs,
    generation_status: architecture.generation_status,
  });
  architecture = {
    ...architecture,
    generation_metadata: {
      ...architecture.generation_metadata,
      prompt_bundle_chars: bundleText.length,
    },
  };

  const production_payload: Face04ProductionPayload = {
    decision_question: input.dc.definition?.decision_question ?? "",
    locale: input.locale,
    page01: {
      core_judgment: page01_core,
      recommendation_conditions: page01_conditions,
    },
    page02: {
      present: page02_has,
      content_units: page02_units,
      explanation_boundary: page02_boundary,
    },
    page03: { available: false },
    reality: {
      confirmed_facts,
      unverified_facts,
      declined_or_unknown_facts,
      open_conflicts,
      constraints,
    },
    book_judgment_face04_units: face04Units.map((u) => ({
      id: u.id,
      claim: u.claim,
      track: u.track,
      serves_face: u.serves_face,
      serves_segment: u.serves_segment ?? null,
      caveat: u.caveat ?? null,
      related_dir_ids: u.related_dir_ids ?? [],
    })),
    personal_readings,
    registry: {
      claims: page04Claims.map((c) => ({
        claim_id: c.claim_id,
        page_id: c.page_id,
        segment_id: c.segment_id,
        body_text: c.body_text,
        claim_type: c.claim_type,
        evidence_ids: c.evidence_ids,
        evidence_requirement: c.evidence_requirement,
        limitation: c.limitation ?? null,
      })),
      evidence: page04Evidence.map((e) => ({
        evidence_id: e.evidence_id,
        source_type: e.source_type,
        source_id: e.source_id,
        explanation: e.explanation,
        supports_claim_ids: e.supports_claim_ids,
        limits_claim_ids: e.limits_claim_ids,
        term_ids: e.term_ids,
        verification_status: e.verification_status ?? null,
        source_domain: e.source_domain ?? null,
        source_version: e.source_version ?? null,
      })),
    },
    input_manifest: architecture.input_manifest,
    missing_inputs: architecture.missing_inputs,
  };

  const pair = buildFace04PromptPair({
    locale: input.locale,
    architecture_prompt_bundle: bundleText,
    production_payload,
  });

  const factStatusById = new Map<string, string>();
  const factContentById = new Map<string, string>();
  for (const f of facts) {
    factStatusById.set(f.fact_id, f.status);
    factContentById.set(f.fact_id, f.statement ?? "");
  }

  return {
    ok: true,
    ctx: {
      prompt_version: PAGE04_ARCHITECTURE_PROMPT_VERSION,
      schema_version: "face04-v2",
      system: pair.system,
      user: pair.user,
      registry: restrictedRegistry,
      knownFactIds: new Set(facts.map((f) => f.fact_id)),
      factStatusById,
      factContentById,
      available_domains: domains.available_domains,
      domain_versions: domains.domain_versions,
      profile_version: domains.profile_version,
      page01_core_judgment: page01_core,
      architecture,
      architecture_prompt_bundle: bundleText,
      production_payload,
      may_invoke_llm: !blocked,
    },
  };
}

export function validateFace04ProductionOutput(input: {
  raw: unknown;
  locale: string;
  ctx: Face04ProductionContext;
}):
  | { ok: true; page: Face04V2 }
  | { ok: false; issues: Face04Issue[]; reason: string } {
  const result = validateFace04Output({
    raw: input.raw,
    locale: input.locale,
    registry: input.ctx.registry,
    knownFactIds: input.ctx.knownFactIds,
    factStatusById: input.ctx.factStatusById,
    reject_legacy_ids: true,
  });
  if (!result.ok) {
    return {
      ok: false,
      issues: result.issues,
      reason: "face04_validation_failed",
    };
  }
  if (!input.ctx.may_invoke_llm) {
    return {
      ok: false,
      issues: [
        {
          code: "architecture_blocked_invoke",
          detail:
            "Face04 LLM output rejected: may_invoke_llm=false (required inputs missing).",
        },
      ],
      reason: "face04_blocked_on_required_inputs",
    };
  }
  const envelope: Page04ArchitectureEnvelope = {
    ...input.ctx.architecture,
    generation_status:
      input.ctx.architecture.missing_inputs.length > 0
        ? "generated_with_gaps"
        : "generated_complete",
    generation_metadata: {
      ...input.ctx.architecture.generation_metadata,
      llm_invoked: true,
      built_at: new Date().toISOString(),
    },
  };
  const attached = attachPage04ArchitectureToPage(result.page, envelope);
  const localeBucket = (input.locale || "en").toLowerCase().slice(0, 2);
  const stampedLocale =
    localeBucket === "zh" ||
    localeBucket === "en" ||
    localeBucket === "es" ||
    localeBucket === "fr" ||
    localeBucket === "de"
      ? (localeBucket as Face04V2["locale"])
      : ("en" as Face04V2["locale"]);
  return {
    ok: true,
    page: { ...attached, locale: attached.locale ?? stampedLocale },
  };
}

export function buildFace04RepairUserMessage(input: {
  previousUser: string;
  previousRaw: string;
  issues: Face04Issue[];
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
    "上一稿未通过程序校验。请只修正下列问题后重新输出完整 JSON（仍须符合 Face04V2 schema）。",
    "不得新增输入中不存在的 fact_id / evidence_id / claim_id。",
    "不得越过本页 evidence_registry 边界。",
    "不得用 Markdown 包裹。",
    "不得使用 legacy_ 前缀伪造引用。",
    "错误列表：",
    issueLines,
    "",
    "## 上一稿（仅供对照）",
    input.previousRaw.slice(0, 6000),
  ].join("\n");
}

export function parseFace04JsonStrict(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  if (/^```/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function face04SliceSummary(
  ctx: Face04ProductionContext,
): Record<string, unknown> {
  return {
    prompt_version: ctx.prompt_version,
    schema_version: ctx.schema_version,
    may_invoke_llm: ctx.may_invoke_llm,
    generation_status: ctx.architecture.generation_status,
    missing_inputs: ctx.architecture.missing_inputs.length,
    input_manifest: ctx.architecture.input_manifest.length,
    sections: ctx.architecture.sections.map((s) => s.section_id),
    has_page01: Boolean(ctx.page01_core_judgment),
    registry_claim_count: Object.keys(ctx.registry.claims).length,
    registry_evidence_count: Object.keys(ctx.registry.evidence).length,
    payload_confirmed_facts:
      ctx.production_payload.reality.confirmed_facts.length,
    payload_page02_present: ctx.production_payload.page02.present,
  };
}

export { Face04V2Schema };
