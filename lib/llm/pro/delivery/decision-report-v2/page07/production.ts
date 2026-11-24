/**
 * Face 07 production orchestration — used by content-body / Lab.
 * UNIQUE entry: buildFace07ProductionContext.
 * Applicability is decided here, before any LLM call.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  type Face07V2,
  type Face01V2,
  type Face02V2,
  type Face04V2,
  type Face06V2,
} from "../schemas";
import { isFace01V2 } from "../page01/legacy-adapter";
import { isFace02V2 } from "../page02/legacy-adapter";
import { isFace04V2 } from "../page04/legacy-adapter";
import { isFace06V2 } from "../page06/legacy-adapter";
import { knownPage05PathIdsFromFace } from "../page06/production";
import { seedEvidenceRegistryForFace07 } from "../registry-from-sources";
import { resolveAvailablePersonalDomains } from "../personal-domains";
import {
  evaluatePage07Applicability,
  type Page07ApplicabilityResult,
} from "./applicability";
import {
  buildPage07ArchitectureEnvelope,
  attachPage07ArchitectureToPage,
  type Page07ArchitectureEnvelope,
} from "./architecture/production-path";
import {
  buildPage07ArchitecturePromptBundle,
  PAGE07_ARCHITECTURE_PROMPT_VERSION,
} from "./architecture/prompt-templates";
import { PAGE07_SECTION_IDS } from "./architecture/sections";
import {
  buildFace07PromptPair,
  type Face07ProductionPayload,
} from "./prompt";
import { validateFace07Output, type Face07Issue } from "./validate";
import type { Face07UpstreamRefs } from "./path-integrity";
import type { EvidenceRegistry, ReportClaim, ReportEvidence } from "../types";

export type Face07ProductionContext = {
  prompt_version: string;
  schema_version: "face07-v2";
  system: string;
  user: string;
  registry: EvidenceRegistry;
  knownFactIds: Set<string>;
  factStatusById: Map<string, string>;
  factContentById: Map<string, string>;
  knownDirIds: Set<string>;
  upstream: Face07UpstreamRefs;
  knownPersonalInterpretationUnitRefs: Set<string>;
  authorized_partner_profile: boolean;
  applicability: Page07ApplicabilityResult;
  available_domains: readonly string[];
  domain_versions: { bazi?: string; ziwei?: string };
  profile_version: string | null;
  architecture: Page07ArchitectureEnvelope;
  architecture_prompt_bundle: string;
  production_payload: Face07ProductionPayload;
  may_invoke_llm: boolean;
};

export type Face07ProductionBuildOk = {
  ok: true;
  ctx: Face07ProductionContext;
};

export type Face07ProductionBuildFail = {
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

function page07ClaimRecords(registry: EvidenceRegistry): ReportClaim[] {
  return Object.values(registry.claims).filter((c) => c.page_id === "07");
}

function page07EvidenceRecords(
  registry: EvidenceRegistry,
  claimIds: ReadonlySet<string>,
): ReportEvidence[] {
  return Object.values(registry.evidence).filter((e) => {
    if (e.supports_claim_ids.some((id) => claimIds.has(id))) return true;
    if (e.limits_claim_ids.some((id) => claimIds.has(id))) return true;
    if (e.source_type === "reality_fact") return true;
    return false;
  });
}

export function knownPage06ActionIdsFromFace(page06: unknown): {
  present: boolean;
  primary_path_id: string | null;
  action_ids: string[];
  first_step_what: string | null;
} {
  if (!isFace06V2(page06)) {
    return {
      present: false,
      primary_path_id: null,
      action_ids: [],
      first_step_what: null,
    };
  }
  const p = page06 as Face06V2;
  const primary = String(p.primary_path_id ?? "").trim();
  const ids = [
    p.first_step?.action_id,
    ...(p.execution_actions ?? []).map((a) => a.action_id),
  ]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);
  return {
    present: primary.length > 0,
    primary_path_id: primary || null,
    action_ids: [...new Set(ids)],
    first_step_what: p.first_step?.what?.trim() || null,
  };
}

function stampLocale(locale: string): Face07V2["locale"] {
  const bucket = (locale || "en").toLowerCase().slice(0, 2);
  if (
    bucket === "zh" ||
    bucket === "en" ||
    bucket === "es" ||
    bucket === "fr" ||
    bucket === "de"
  ) {
    return bucket;
  }
  return "en";
}

/** Structured skip / insufficient page. No invented field or relationship content. */
export function synthesizeFace07StatusPage(input: {
  locale: string;
  applicability: Page07ApplicabilityResult;
  architecture?: Page07ArchitectureEnvelope;
}): Face07V2 {
  const status = input.applicability.status;
  const reason = input.applicability.reason.trim() || status;
  const skipped = status !== "applicable";
  const generation_status =
    status === "not_applicable"
      ? "skipped_not_applicable"
      : status === "insufficient_information"
        ? "insufficient_information"
        : "ready_for_generation";
  return {
    page: "07",
    face: "07",
    schema_version: "face07-v2",
    locale: stampLocale(input.locale),
    page_title: "",
    page_subtitle: "",
    applicability_status: status === "applicable" ? "not_applicable" : status,
    applicability_reason: reason,
    skip_note: reason,
    participants: [],
    field_units: [],
    relationship_units: [],
    evidence_boundary: {
      claim_ids: [],
      confirmed_fact_ids: [],
      hypothesis_notes: [],
      uncertainty_notes: [],
      third_party_data_limits: [
        "No third-party profile is analyzed on a skipped or insufficient page.",
      ],
      supporting_personal_unit_refs: [],
    },
    alignment_with_main: {
      changes_page01_recommendation: false,
      changes_page05_path_order: false,
      effect_on_page06_execution: skipped
        ? "none"
        : "",
      summary: reason,
      claim_ids: [],
      evidence_ids: [],
      related_page05_path_ids: [],
      related_page06_action_ids: [],
    },
    reading_order: [...PAGE07_SECTION_IDS],
    authorized_partner_profile: false,
    generation_status,
    input_manifest: input.architecture?.input_manifest,
    missing_inputs: input.architecture?.missing_inputs,
    sections: input.architecture?.sections,
    generation_metadata: input.architecture
      ? { ...input.architecture.generation_metadata, llm_invoked: false }
      : undefined,
  };
}

/** UNIQUE production entry for Page07 architecture + prompt. */
export function buildFace07ProductionContext(input: {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  chart_fact_pack?: string | null;
  page01?: unknown;
  page02?: unknown;
  page04?: unknown;
  page05?: unknown;
  page06?: unknown;
  authorized_partner_profile?: boolean;
}): Face07ProductionBuildOk | Face07ProductionBuildFail {
  if (!input.dc) {
    return { ok: false, reason: "face07_missing_decision_context" };
  }

  const applicability = evaluatePage07Applicability(
    input.dc,
    input.dc.dirs ?? [],
    input.dc.reality_facts ?? [],
    input.dc.definition?.decision_question ?? "",
  );

  const domains = resolveAvailablePersonalDomains({
    pack: input.pack,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
  });

  const seeded = seedEvidenceRegistryForFace07({
    dc: input.dc,
    pack: input.pack,
    maxFacts: 16,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
    bazi_available: domains.bazi_available,
    ziwei_available: domains.ziwei_available,
  });

  const page07Claims = page07ClaimRecords(seeded.registry);
  const page07ClaimIdSet = new Set(page07Claims.map((c) => c.claim_id));
  const page07Evidence = page07EvidenceRecords(seeded.registry, page07ClaimIdSet);
  const restrictedRegistry: EvidenceRegistry = {
    claims: Object.fromEntries(page07Claims.map((c) => [c.claim_id, c])),
    evidence: Object.fromEntries(
      page07Evidence.map((e) => [e.evidence_id, e]),
    ),
  };

  let page01Obj: Face01V2 | null = null;
  if (isFace01V2(input.page01)) page01Obj = input.page01 as Face01V2;

  let page02_has = false;
  let page02_count = 0;
  let page02_units: unknown[] | null = null;
  let page02_boundary: unknown | null = null;
  const knownPersonalInterpretationUnitRefs = new Set<string>();
  if (isFace02V2(input.page02)) {
    const p02 = input.page02 as Face02V2;
    page02_has = Array.isArray(p02.content_units) && p02.content_units.length > 0;
    page02_count = p02.content_units?.length ?? 0;
    page02_units = page02_has ? [...p02.content_units] : null;
    page02_boundary = p02.explanation_boundary ?? null;
    for (const u of p02.content_units ?? []) {
      if (u.unit_id && (u as { kind?: string }).kind === "personal_interpretation") {
        knownPersonalInterpretationUnitRefs.add(u.unit_id);
      }
    }
  }

  let page04_has = false;
  let page04_count = 0;
  let page04_units: unknown[] | null = null;
  let page04_boundary: unknown | null = null;
  if (isFace04V2(input.page04)) {
    const p04 = input.page04 as Face04V2;
    page04_has = Array.isArray(p04.content_units) && p04.content_units.length > 0;
    page04_count = p04.content_units?.length ?? 0;
    page04_units = page04_has ? [...p04.content_units] : null;
    page04_boundary = p04.evidence_boundary ?? null;
  }

  const page05Paths = knownPage05PathIdsFromFace(input.page05);
  const page06Exec = knownPage06ActionIdsFromFace(input.page06);

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
  const constraints = (input.dc.constraints ?? []).map((c) => ({
    constraint_id: c.constraint_id,
    statement: c.statement,
    category: c.category,
    status: c.status,
    verification_level: c.verification_level,
    rigidity: c.rigidity,
    related_dir_ids: c.related_dir_ids ?? [],
  }));
  const dirs = (input.dc.dirs ?? []).map((d) => ({
    dir_id: d.dir_id,
    need: d.need,
    why: d.why,
    current_state: d.current_state,
    required_fact_roles: d.required_fact_roles,
  }));

  const face07Units = (input.pack?.units ?? []).filter((u) =>
    u.serves_face.includes("07"),
  );

  const snap = {
    report_id: input.report_id,
    locale: input.locale,
    dc: input.dc,
    pack: input.pack,
    applicability_status: applicability.status,
    page01_present: Boolean(page01Obj),
    page02_has_content_units: page02_has,
    page02_unit_count: page02_count,
    page04_has_content_units: page04_has,
    page04_unit_count: page04_count,
    page05_has_preferred_paths: page05Paths.present,
    page05_preferred_count: page05Paths.preferred_path_ids.length,
    page06_has_primary_path: page06Exec.present,
    page06_action_count: page06Exec.action_ids.length,
    registry_claim_count: page07Claims.length,
  };

  let architecture = buildPage07ArchitectureEnvelope(snap, {
    applicability_reason: applicability.reason,
  });
  const blocked =
    applicability.status === "applicable" &&
    architecture.missing_inputs.some((g) => g.handling === "defer_generation");
  if (blocked && architecture.generation_status !== "blocked_on_required_inputs") {
    architecture = {
      ...architecture,
      generation_status: "blocked_on_required_inputs",
    };
  }

  const may_invoke_llm =
    applicability.status === "applicable" && !blocked;

  const bundleText = buildPage07ArchitecturePromptBundle({
    input_manifest: architecture.input_manifest,
    missing_inputs: architecture.missing_inputs,
    generation_status: architecture.generation_status,
  });
  architecture = {
    ...architecture,
    generation_metadata: {
      ...architecture.generation_metadata,
      prompt_bundle_chars: bundleText.length,
      llm_invoked: false,
    },
  };

  const production_payload: Face07ProductionPayload = {
    decision_question: input.dc.definition?.decision_question ?? "",
    locale: input.locale,
    applicability_status: applicability.status,
    applicability_reason: applicability.reason,
    authorized_partner_profile: input.authorized_partner_profile === true,
    page01: page01Obj
      ? {
          core_judgment: page01Obj.core_judgment,
          recommendation_conditions: page01Obj.recommendation_conditions,
          not_recommended: page01Obj.not_recommended,
          applicability_boundary: page01Obj.applicability_boundary,
        }
      : null,
    page02: {
      present: page02_has,
      content_units: page02_units,
      explanation_boundary: page02_boundary,
      personal_interpretation_unit_ids: [...knownPersonalInterpretationUnitRefs],
    },
    page04: {
      present: page04_has,
      content_units: page04_units,
      evidence_boundary: page04_boundary,
    },
    page05: {
      present: page05Paths.present,
      preferred_path_ids: [...page05Paths.preferred_path_ids],
      all_path_ids: [...page05Paths.all_path_ids],
      path_units: page05Paths.path_units,
    },
    page06: {
      present: page06Exec.present,
      primary_path_id: page06Exec.primary_path_id,
      action_ids: page06Exec.action_ids,
      first_step_what: page06Exec.first_step_what,
    },
    reality: {
      confirmed_facts,
      unverified_facts,
      declined_or_unknown_facts,
      constraints,
      dirs,
    },
    book_judgment_face07_units: face07Units.map((u) => ({
      id: u.id,
      claim: u.claim,
      track: u.track,
      serves_face: u.serves_face,
      caveat: u.caveat ?? null,
    })),
    registry: {
      claims: page07Claims.map((c) => ({
        claim_id: c.claim_id,
        page_id: c.page_id,
        segment_id: c.segment_id,
        body_text: c.body_text,
        claim_type: c.claim_type,
        evidence_ids: c.evidence_ids,
        limitation: c.limitation ?? null,
      })),
      evidence: page07Evidence.map((e) => ({
        evidence_id: e.evidence_id,
        source_type: e.source_type,
        source_id: e.source_id,
        explanation: e.explanation,
        supports_claim_ids: e.supports_claim_ids,
        verification_status: e.verification_status ?? null,
      })),
    },
    input_manifest: architecture.input_manifest,
    missing_inputs: architecture.missing_inputs,
  };

  const pair = buildFace07PromptPair({
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
      prompt_version: PAGE07_ARCHITECTURE_PROMPT_VERSION,
      schema_version: "face07-v2",
      system: pair.system,
      user: pair.user,
      registry: restrictedRegistry,
      knownFactIds: new Set(facts.map((f) => f.fact_id)),
      factStatusById,
      factContentById,
      knownDirIds: new Set((input.dc.dirs ?? []).map((d) => d.dir_id)),
      upstream: {
        page05_all_path_ids: page05Paths.all_path_ids,
        page06_action_ids: page06Exec.action_ids,
      },
      knownPersonalInterpretationUnitRefs,
      authorized_partner_profile: input.authorized_partner_profile === true,
      applicability,
      available_domains: domains.available_domains,
      domain_versions: domains.domain_versions,
      profile_version: domains.profile_version,
      architecture,
      architecture_prompt_bundle: bundleText,
      production_payload,
      may_invoke_llm,
    },
  };
}

export function validateFace07ProductionOutput(input: {
  raw: unknown;
  locale: string;
  ctx: Face07ProductionContext;
}):
  | { ok: true; page: Face07V2 }
  | { ok: false; issues: Face07Issue[]; reason: string } {
  const result = validateFace07Output({
    raw: input.raw,
    locale: input.locale,
    registry: input.ctx.registry,
    knownFactIds: input.ctx.knownFactIds,
    factStatusById: input.ctx.factStatusById,
    factContentById: input.ctx.factContentById,
    upstream: input.ctx.upstream,
    knownDirIds: input.ctx.knownDirIds,
    knownPersonalInterpretationUnitRefs:
      input.ctx.knownPersonalInterpretationUnitRefs,
    authorizedPartnerProfile: input.ctx.authorized_partner_profile,
    reject_legacy_ids: true,
  });
  if (!result.ok) {
    return {
      ok: false,
      issues: result.issues,
      reason: "face07_validation_failed",
    };
  }
  if (input.ctx.applicability.status === "insufficient_information") {
    return {
      ok: false,
      issues: [
        {
          code: "insufficient_information",
          detail: input.ctx.applicability.reason,
        },
      ],
      reason: "face07_insufficient_information",
    };
  }
  if (
    input.ctx.applicability.status === "applicable" &&
    !input.ctx.may_invoke_llm
  ) {
    return {
      ok: false,
      issues: [
        {
          code: "architecture_blocked_invoke",
          detail:
            "Face07 LLM output rejected: may_invoke_llm=false (required inputs missing).",
        },
      ],
      reason: "face07_blocked_on_required_inputs",
    };
  }
  const invoked = input.ctx.applicability.status === "applicable";
  const envelope: Page07ArchitectureEnvelope = {
    ...input.ctx.architecture,
    generation_status: invoked
      ? input.ctx.architecture.missing_inputs.length > 0
        ? "generated_with_gaps"
        : "generated_complete"
      : input.ctx.architecture.generation_status,
    generation_metadata: {
      ...input.ctx.architecture.generation_metadata,
      llm_invoked: invoked,
      built_at: new Date().toISOString(),
    },
  };
  const attached = attachPage07ArchitectureToPage(result.page, envelope);
  return {
    ok: true,
    page: {
      ...attached,
      locale: attached.locale ?? stampLocale(input.locale),
      authorized_partner_profile: input.ctx.authorized_partner_profile,
    },
  };
}

export function buildFace07RepairUserMessage(input: {
  previousUser: string;
  previousRaw: string;
  issues: Face07Issue[];
}): string {
  const issueLines = input.issues
    .slice(0, 12)
    .map((i) => {
      const path = i.path ? ` @${i.path}` : "";
      return `- [${i.code}]${path} ${i.detail}`;
    })
    .join("\n");
  return [
    input.previousUser,
    "",
    "## 校验失败 · 定向修复（唯一一次）",
    "上一稿未通过程序校验。请只修正下列问题后重新输出完整 JSON（仍须符合 Face07V2 schema）。",
    "不得新增输入中不存在的 fact_id / evidence_id / claim_id / path_id / action_id / 第三方。",
    "不得把用户的 personal_interpretation 用到非 self 的参与者身上。",
    "不得编造评分、合婚分数或成功概率。",
    "不得用 Markdown 包裹。",
    "不得使用 legacy_ 前缀伪造引用。",
    "错误列表：",
    issueLines,
    "",
    "## 上一稿（仅供对照）",
    input.previousRaw.slice(0, 6000),
  ].join("\n");
}

export function parseFace07JsonStrict(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  if (/^```/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function face07SliceSummary(
  ctx: Face07ProductionContext,
): Record<string, unknown> {
  return {
    prompt_version: ctx.prompt_version,
    schema_version: ctx.schema_version,
    may_invoke_llm: ctx.may_invoke_llm,
    applicability_status: ctx.applicability.status,
    applicability_reason: ctx.applicability.reason,
    generation_status: ctx.architecture.generation_status,
    missing_inputs: ctx.architecture.missing_inputs.length,
    input_manifest: ctx.architecture.input_manifest.length,
    sections: ctx.architecture.sections.map((s) => s.section_id),
    registry_claim_count: Object.keys(ctx.registry.claims).length,
    authorized_partner_profile: ctx.authorized_partner_profile,
    payload_page01: Boolean(ctx.production_payload.page01),
    payload_page02_present: ctx.production_payload.page02.present,
    payload_page04_present: ctx.production_payload.page04.present,
    payload_page05_present: ctx.production_payload.page05.present,
    payload_page06_present: ctx.production_payload.page06.present,
    page06_primary_path_id: ctx.production_payload.page06.primary_path_id,
  };
}
