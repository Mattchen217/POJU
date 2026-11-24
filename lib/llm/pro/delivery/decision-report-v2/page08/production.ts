/**
 * Face 08 production orchestration — used by content-body / Lab.
 * UNIQUE entry: buildFace08ProductionContext.
 * Blocks without DC question, locale, Page01–04 V2, Page05 preferred paths,
 * and Page06 monitoring_contract. Page07 never blocks.
 * No OpenRouter call from this module.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  type Face08V2,
  type Face01V2,
  type Face02V2,
  type Face04V2,
  type Face06V2,
  type Face07V2,
} from "../schemas";
import { isFace01V2 } from "../page01/legacy-adapter";
import { isFace02V2 } from "../page02/legacy-adapter";
import { isFace04V2 } from "../page04/legacy-adapter";
import { isFace06V2 } from "../page06/legacy-adapter";
import { knownPage05PathIdsFromFace } from "../page06/production";
import { isFace07V2 } from "../page07/legacy-adapter";
import { knownPage06ActionIdsFromFace } from "../page07/production";
import { seedEvidenceRegistryForFace08 } from "../registry-from-sources";
import { resolveAvailablePersonalDomains } from "../personal-domains";
import {
  buildPage08ArchitectureEnvelope,
  attachPage08ArchitectureToPage,
  type Page08ArchitectureEnvelope,
} from "./architecture/production-path";
import {
  buildPage08ArchitecturePromptBundle,
  PAGE08_ARCHITECTURE_PROMPT_VERSION,
} from "./architecture/prompt-templates";
import type { Page08Page07Presence } from "./architecture/assemble-inputs";
import {
  buildFace08PromptPair,
  type Face08ProductionPayload,
} from "./prompt";
import { validateFace08Output, type Face08Issue } from "./validate";
import type { Face08UpstreamRefs } from "./path-integrity";
import type { EvidenceRegistry, ReportClaim, ReportEvidence } from "../types";

export type Face08ProductionContext = {
  prompt_version: string;
  schema_version: "face08-v2";
  system: string;
  user: string;
  registry: EvidenceRegistry;
  knownFactIds: Set<string>;
  factStatusById: Map<string, string>;
  factVerificationLevelById: Map<string, string>;
  upstream: Face08UpstreamRefs;
  dateCorpus: string;
  architecture: Page08ArchitectureEnvelope;
  architecture_prompt_bundle: string;
  production_payload: Face08ProductionPayload;
  may_invoke_llm: boolean;
};

export type Face08ProductionBuildOk = {
  ok: true;
  ctx: Face08ProductionContext;
};

export type Face08ProductionBuildFail = {
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

function page08ClaimRecords(registry: EvidenceRegistry): ReportClaim[] {
  return Object.values(registry.claims).filter((c) => c.page_id === "08");
}

function page08EvidenceRecords(
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

function hasMonitoringContract(page06: unknown): boolean {
  if (!page06 || typeof page06 !== "object") return false;
  const contract = (page06 as { monitoring_contract?: unknown }).monitoring_contract;
  if (!contract || typeof contract !== "object") return false;
  const row = contract as {
    path_id?: unknown;
    observe_signals?: unknown;
    stop_triggers?: unknown;
  };
  const pathId = String(row.path_id ?? "").trim();
  const signals = Array.isArray(row.observe_signals) ? row.observe_signals : [];
  const stops = Array.isArray(row.stop_triggers) ? row.stop_triggers : [];
  return pathId.length > 0 && signals.length > 0 && stops.length > 0;
}

export type Face08Page07View = Face08ProductionPayload["page07"];

/** Read stored Page07. Never invent an applicable analysis. */
export function readPage07ForFace08(page07: unknown): Face08Page07View {
  const empty = (presence: Page08Page07Presence): Face08Page07View => ({
    presence,
    applicability_status: presence === "missing" ? null : presence,
    applicability_reason: null,
    participants: [],
    field_units: [],
    relationship_units: [],
    alignment_with_main: null,
    evidence_boundary: null,
    related_page05_path_ids: [],
    related_page06_action_ids: [],
    effect_on_page06_execution: null,
  });
  if (!isFace07V2(page07)) return empty("missing");
  const page = page07 as Face07V2;
  const status = page.applicability_status;
  const presence: Page08Page07Presence =
    status === "applicable" ||
    status === "not_applicable" ||
    status === "insufficient_information"
      ? status
      : "missing";
  if (presence !== "applicable") {
    return {
      ...empty(presence),
      applicability_status: status,
      applicability_reason: page.applicability_reason ?? null,
    };
  }
  const alignment = page.alignment_with_main;
  return {
    presence: "applicable",
    applicability_status: "applicable",
    applicability_reason: page.applicability_reason ?? null,
    participants: page.participants ?? [],
    field_units: page.field_units ?? [],
    relationship_units: page.relationship_units ?? [],
    alignment_with_main: alignment ?? null,
    evidence_boundary: page.evidence_boundary ?? null,
    related_page05_path_ids: [...(alignment?.related_page05_path_ids ?? [])],
    related_page06_action_ids: [...(alignment?.related_page06_action_ids ?? [])],
    effect_on_page06_execution: alignment?.effect_on_page06_execution ?? null,
  };
}

function stampLocale(locale: string): Face08V2["locale"] {
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

/** UNIQUE production entry for Page08 architecture + prompt. */
export function buildFace08ProductionContext(input: {
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
  page07?: unknown;
}): Face08ProductionBuildOk | Face08ProductionBuildFail {
  if (!input.dc) {
    return { ok: false, reason: "face08_missing_decision_context" };
  }

  const domains = resolveAvailablePersonalDomains({
    pack: input.pack,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
  });

  const seeded = seedEvidenceRegistryForFace08({
    dc: input.dc,
    pack: input.pack,
    maxFacts: 16,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
    bazi_available: domains.bazi_available,
    ziwei_available: domains.ziwei_available,
  });

  const page08Claims = page08ClaimRecords(seeded.registry);
  const page08ClaimIdSet = new Set(page08Claims.map((c) => c.claim_id));
  const page08Evidence = page08EvidenceRecords(seeded.registry, page08ClaimIdSet);
  const restrictedRegistry: EvidenceRegistry = {
    claims: Object.fromEntries(page08Claims.map((c) => [c.claim_id, c])),
    evidence: Object.fromEntries(page08Evidence.map((e) => [e.evidence_id, e])),
  };

  let page01Obj: Face01V2 | null = null;
  if (isFace01V2(input.page01)) page01Obj = input.page01 as Face01V2;

  let page02_has = false;
  let page02_count = 0;
  let page02_units: unknown[] | null = null;
  let page02_boundary: unknown | null = null;
  if (isFace02V2(input.page02)) {
    const p02 = input.page02 as Face02V2;
    page02_has = Array.isArray(p02.content_units) && p02.content_units.length > 0;
    page02_count = p02.content_units?.length ?? 0;
    page02_units = page02_has ? [...p02.content_units] : null;
    page02_boundary = p02.explanation_boundary ?? null;
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
  const monitoring = hasMonitoringContract(input.page06) && page06Exec.present;
  const page07View = readPage07ForFace08(input.page07);

  let page06Structured: Face08ProductionPayload["page06"] = {
    present: false,
    has_monitoring_contract: false,
    primary_path_id: null,
    action_ids: [],
    first_step: null,
    execution_actions: null,
    validation_experiments: null,
    monitoring_contract: null,
    evidence_boundary: null,
    resource_boundaries: null,
    phase_rhythm: null,
  };
  if (isFace06V2(input.page06)) {
    const p06 = input.page06 as Face06V2;
    page06Structured = {
      present: page06Exec.present,
      has_monitoring_contract: monitoring,
      primary_path_id: page06Exec.primary_path_id,
      action_ids: page06Exec.action_ids,
      first_step: p06.first_step ?? null,
      execution_actions: p06.execution_actions ?? null,
      validation_experiments: p06.validation_experiments ?? null,
      monitoring_contract: p06.monitoring_contract ?? null,
      evidence_boundary: p06.evidence_boundary ?? null,
      resource_boundaries: p06.resource_boundaries ?? null,
      phase_rhythm: p06.phase_rhythm ?? null,
    };
  }

  const facts = input.dc.reality_facts ?? [];
  const all_facts = facts.map(serializeFact);
  const confirmed_facts = all_facts.filter((f) => f.status === "confirmed");
  const unverified_facts = all_facts.filter((f) => f.status === "unverified");
  const declined_or_unknown_facts = all_facts.filter(
    (f) =>
      f.status === "declined" ||
      f.status === "unknown" ||
      f.status === "not_applicable",
  );
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

  const face08Units = (input.pack?.units ?? []).filter((u) =>
    u.serves_face.includes("08"),
  );

  const page07Summary =
    page07View.presence === "applicable"
      ? `applicable units=${page07View.field_units.length}+${page07View.relationship_units.length}`
      : page07View.presence === "not_applicable"
        ? page07View.applicability_reason || "not_applicable"
        : page07View.presence === "insufficient_information"
          ? `insufficient_information: ${page07View.applicability_reason ?? ""}`.trim()
          : null;

  const snap = {
    report_id: input.report_id,
    locale: input.locale,
    dc: input.dc,
    pack: input.pack,
    page01_present: Boolean(page01Obj),
    page02_has_content_units: page02_has,
    page02_unit_count: page02_count,
    page04_has_content_units: page04_has,
    page04_unit_count: page04_count,
    page05_has_preferred_paths: page05Paths.present,
    page05_preferred_count: page05Paths.preferred_path_ids.length,
    page06_has_monitoring: monitoring,
    page06_action_count: page06Exec.action_ids.length,
    page07_presence: page07View.presence,
    page07_summary: page07Summary,
    registry_claim_count: page08Claims.length,
  };

  let architecture = buildPage08ArchitectureEnvelope(snap);
  const blocked = architecture.missing_inputs.some(
    (g) => g.handling === "defer_generation",
  );
  if (blocked && architecture.generation_status !== "blocked_on_required_inputs") {
    architecture = {
      ...architecture,
      generation_status: "blocked_on_required_inputs",
    };
  }
  const may_invoke_llm = !blocked;

  const bundleText = buildPage08ArchitecturePromptBundle({
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

  const production_payload: Face08ProductionPayload = {
    decision_question: input.dc.definition?.decision_question ?? "",
    locale: input.locale,
    page01: page01Obj
      ? {
          core_judgment: page01Obj.core_judgment,
          why_this_path: page01Obj.why_this_path,
          recommendation_conditions: page01Obj.recommendation_conditions,
          not_recommended: page01Obj.not_recommended,
          applicability_boundary: page01Obj.applicability_boundary,
        }
      : null,
    page02: {
      present: page02_has,
      content_units: page02_units,
      explanation_boundary: page02_boundary,
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
      switching_rules: page05Paths.switching_rules,
    },
    page06: page06Structured,
    page07: page07View,
    reality: {
      all_facts,
      confirmed_facts,
      unverified_facts,
      declined_or_unknown_facts,
      constraints,
      dirs,
    },
    book_judgment_face08_units: face08Units.map((u) => ({
      id: u.id,
      claim: u.claim,
      track: u.track,
      serves_face: u.serves_face,
      caveat: u.caveat ?? null,
    })),
    registry: {
      claims: page08Claims.map((c) => ({
        claim_id: c.claim_id,
        page_id: c.page_id,
        segment_id: c.segment_id,
        body_text: c.body_text,
        claim_type: c.claim_type,
        evidence_ids: c.evidence_ids,
        limitation: c.limitation ?? null,
      })),
      evidence: page08Evidence.map((e) => ({
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

  const pair = buildFace08PromptPair({
    locale: input.locale,
    architecture_prompt_bundle: bundleText,
    production_payload,
  });

  const factStatusById = new Map<string, string>();
  const factVerificationLevelById = new Map<string, string>();
  for (const f of facts) {
    factStatusById.set(f.fact_id, f.status);
    factVerificationLevelById.set(f.fact_id, f.verification_level);
  }

  const upstream: Face08UpstreamRefs = {
    page05_all_path_ids: page05Paths.all_path_ids,
    page06_action_ids: page06Exec.action_ids,
  };

  const dateCorpus = JSON.stringify({
    facts: all_facts,
    constraints,
    page05: production_payload.page05,
    page06: production_payload.page06,
    page07: production_payload.page07,
    page01: production_payload.page01,
  });

  return {
    ok: true,
    ctx: {
      prompt_version: PAGE08_ARCHITECTURE_PROMPT_VERSION,
      schema_version: "face08-v2",
      system: pair.system,
      user: pair.user,
      registry: restrictedRegistry,
      knownFactIds: new Set(facts.map((f) => f.fact_id)),
      factStatusById,
      factVerificationLevelById,
      upstream,
      dateCorpus,
      architecture,
      architecture_prompt_bundle: bundleText,
      production_payload,
      may_invoke_llm,
    },
  };
}

export function validateFace08ProductionOutput(input: {
  raw: unknown;
  locale: string;
  ctx: Face08ProductionContext;
}):
  | { ok: true; page: Face08V2 }
  | { ok: false; issues: Face08Issue[]; reason: string } {
  if (!input.ctx.may_invoke_llm) {
    return {
      ok: false,
      issues: [
        {
          code: "architecture_blocked_invoke",
          detail:
            "Face08 output rejected: may_invoke_llm=false (required inputs missing).",
        },
      ],
      reason: "face08_blocked_on_required_inputs",
    };
  }
  const result = validateFace08Output({
    raw: input.raw,
    locale: input.locale,
    registry: input.ctx.registry,
    knownFactIds: input.ctx.knownFactIds,
    factStatusById: input.ctx.factStatusById,
    factVerificationLevelById: input.ctx.factVerificationLevelById,
    upstream: input.ctx.upstream,
    dateCorpus: input.ctx.dateCorpus,
    reject_legacy_ids: true,
  });
  if (!result.ok) {
    return {
      ok: false,
      issues: result.issues,
      reason: "face08_validation_failed",
    };
  }
  const envelope: Page08ArchitectureEnvelope = {
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
  const attached = attachPage08ArchitectureToPage(result.page, envelope);
  return {
    ok: true,
    page: {
      ...attached,
      locale: attached.locale ?? stampLocale(input.locale),
    },
  };
}

export function buildFace08RepairUserMessage(input: {
  previousUser: string;
  previousRaw: string;
  issues: Face08Issue[];
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
    "上一稿未通过程序校验。请只修正下列问题后重新输出完整 JSON（仍须符合 Face08V2 schema）。",
    "不得新增输入中不存在的 fact_id / evidence_id / claim_id / path_id / action_id。",
    "不得把未核实事实写成已确认。不得编造评分、概率或日期。",
    "每个 reality_fact_ids / related_fact_ids 必须有配对的 reality_fact_stances，且 stance 必须与 DC status / verification_level 一致。",
    "risks / observation_signals / triggers 可以为空；依据不足时用 evidence_boundary.monitoring_limitations 说明，不得编造填充项。",
    "信号必须指向已输出的风险。触发必须指向已输出的风险和信号。",
    "决策回应只能是 continue、adjust、pause、stop、reassess。",
    "不得改写 Page01 / Page05 / Page06。",
    "不得用 Markdown 包裹。",
    "不得使用 legacy_ 前缀伪造引用。",
    "错误列表：",
    issueLines,
    "",
    "## 上一稿（仅供对照）",
    input.previousRaw.slice(0, 6000),
  ].join("\n");
}

export function parseFace08JsonStrict(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  if (/^```/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function face08SliceSummary(
  ctx: Face08ProductionContext,
): Record<string, unknown> {
  return {
    prompt_version: ctx.prompt_version,
    schema_version: ctx.schema_version,
    may_invoke_llm: ctx.may_invoke_llm,
    generation_status: ctx.architecture.generation_status,
    missing_inputs: ctx.architecture.missing_inputs.length,
    input_manifest: ctx.architecture.input_manifest.length,
    sections: ctx.architecture.sections.map((s) => s.section_id),
    registry_claim_count: Object.keys(ctx.registry.claims).length,
    payload_page01: Boolean(ctx.production_payload.page01),
    payload_page02_present: ctx.production_payload.page02.present,
    payload_page04_present: ctx.production_payload.page04.present,
    payload_page05_present: ctx.production_payload.page05.present,
    payload_page06_present: ctx.production_payload.page06.present,
    payload_page06_monitoring: ctx.production_payload.page06.has_monitoring_contract,
    payload_page07_presence: ctx.production_payload.page07.presence,
    page06_primary_path_id: ctx.production_payload.page06.primary_path_id,
  };
}
