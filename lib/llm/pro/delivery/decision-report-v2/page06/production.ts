/**
 * Face 06 production orchestration — used by content-body / Lab.
 * UNIQUE entry: buildFace06ProductionContext.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  type Face06V2,
  type Face01V2,
  type Face02V2,
  type Face04V2,
  type Face05V2,
} from "../schemas";
import { isFace01V2 } from "../page01/legacy-adapter";
import { isFace02V2 } from "../page02/legacy-adapter";
import { isFace04V2 } from "../page04/legacy-adapter";
import { isFace05V2 } from "../page05/legacy-adapter";
import { seedEvidenceRegistryForFace06 } from "../registry-from-sources";
import { resolveAvailablePersonalDomains } from "../personal-domains";
import {
  buildPage06ArchitectureEnvelope,
  attachPage06ArchitectureToPage,
  type Page06ArchitectureEnvelope,
} from "./architecture/production-path";
import {
  buildPage06ArchitecturePromptBundle,
  PAGE06_ARCHITECTURE_PROMPT_VERSION,
} from "./architecture/prompt-templates";
import {
  buildFace06PromptPair,
  type Face06ProductionPayload,
} from "./prompt";
import { validateFace06Output, type Face06Issue } from "./validate";
import type { Face06Page05PathSets } from "./path-integrity";
import type { EvidenceRegistry, ReportClaim, ReportEvidence } from "../types";

export type Face06ProductionContext = {
  prompt_version: string;
  schema_version: "face06-v2";
  system: string;
  user: string;
  registry: EvidenceRegistry;
  knownFactIds: Set<string>;
  factStatusById: Map<string, string>;
  factContentById: Map<string, string>;
  knownPage05PathIds: Face06Page05PathSets;
  knownPersonalUnitRefs: Set<string>;
  available_domains: readonly string[];
  domain_versions: { bazi?: string; ziwei?: string };
  profile_version: string | null;
  architecture: Page06ArchitectureEnvelope;
  architecture_prompt_bundle: string;
  production_payload: Face06ProductionPayload;
  may_invoke_llm: boolean;
};

export type Face06ProductionBuildOk = {
  ok: true;
  ctx: Face06ProductionContext;
};

export type Face06ProductionBuildFail = {
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

function page06ClaimRecords(registry: EvidenceRegistry): ReportClaim[] {
  return Object.values(registry.claims).filter((c) => c.page_id === "06");
}

function page06EvidenceRecords(
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

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export function knownPage05PathIdsFromFace(
  page05: unknown,
): Face06Page05PathSets & {
  present: boolean;
  cautious_path_ids: string[];
  path_units: unknown[] | null;
  switching_rules: unknown[] | null;
} {
  if (!isFace05V2(page05)) {
    return {
      present: false,
      preferred_path_ids: [],
      alternative_path_ids: [],
      cautious_path_ids: [],
      all_path_ids: [],
      path_units: null,
      switching_rules: null,
    };
  }
  const p = page05 as Face05V2;
  const preferred_path_ids = stringList(p.preferred_path_ids);
  const alternative_path_ids = stringList(p.alternative_path_ids);
  const cautious_path_ids = stringList(p.cautious_path_ids);
  const unitIds = Array.isArray(p.path_units)
    ? p.path_units
        .map((u) => String(u?.path_id ?? "").trim())
        .filter(Boolean)
    : [];
  const all_path_ids = [
    ...new Set([
      ...unitIds,
      ...preferred_path_ids,
      ...alternative_path_ids,
      ...cautious_path_ids,
    ]),
  ];
  const path_units = Array.isArray(p.path_units)
    ? p.path_units.map((u) => ({
        path_id: u.path_id,
        path_role: u.path_role,
        title: u.title,
        description: u.description,
        prerequisites: u.prerequisites ?? [],
        required_resources: u.required_resources ?? [],
        risks: u.risks ?? [],
        success_signals: u.success_signals ?? [],
        reconsideration_conditions: u.reconsideration_conditions ?? [],
      }))
    : null;
  const switching_rules = Array.isArray(p.switching_rules)
    ? p.switching_rules.map((r) => ({
        rule_id: r.rule_id,
        source_path_id: r.source_path_id,
        trigger_condition: r.trigger_condition,
        action: r.action,
        target_path_id: r.target_path_id ?? null,
        rationale: r.rationale,
      }))
    : null;
  return {
    present: preferred_path_ids.length > 0,
    preferred_path_ids,
    alternative_path_ids,
    cautious_path_ids,
    all_path_ids,
    path_units,
    switching_rules,
  };
}

/** UNIQUE production entry for Page06 architecture + prompt. */
export function buildFace06ProductionContext(input: {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  chart_fact_pack?: string | null;
  page01?: unknown;
  page02?: unknown;
  page04?: unknown;
  page05?: unknown;
}): Face06ProductionBuildOk | Face06ProductionBuildFail {
  if (!input.dc) {
    return { ok: false, reason: "face06_missing_decision_context" };
  }

  const domains = resolveAvailablePersonalDomains({
    pack: input.pack,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
  });

  const seeded = seedEvidenceRegistryForFace06({
    dc: input.dc,
    pack: input.pack,
    maxFacts: 16,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
    bazi_available: domains.bazi_available,
    ziwei_available: domains.ziwei_available,
  });

  const page06Claims = page06ClaimRecords(seeded.registry);
  const page06ClaimIdSet = new Set(page06Claims.map((c) => c.claim_id));
  const page06Evidence = page06EvidenceRecords(
    seeded.registry,
    page06ClaimIdSet,
  );
  const restrictedRegistry: EvidenceRegistry = {
    claims: Object.fromEntries(page06Claims.map((c) => [c.claim_id, c])),
    evidence: Object.fromEntries(
      page06Evidence.map((e) => [e.evidence_id, e]),
    ),
  };

  let page01Obj: Face01V2 | null = null;
  if (isFace01V2(input.page01)) {
    page01Obj = input.page01 as Face01V2;
  }

  let page02_has = false;
  let page02_count = 0;
  let page02_units: unknown[] | null = null;
  let page02_boundary: unknown | null = null;
  const personalRefs = new Set<string>();
  if (isFace02V2(input.page02)) {
    const p02 = input.page02 as Face02V2;
    page02_has =
      Array.isArray(p02.content_units) && p02.content_units.length > 0;
    page02_count = p02.content_units?.length ?? 0;
    page02_units = page02_has ? [...p02.content_units] : null;
    page02_boundary = p02.explanation_boundary ?? null;
    for (const u of p02.content_units ?? []) {
      if (u.unit_id) personalRefs.add(u.unit_id);
    }
  }

  let page04_has = false;
  let page04_count = 0;
  let page04_units: unknown[] | null = null;
  let page04_boundary: unknown | null = null;
  if (isFace04V2(input.page04)) {
    const p04 = input.page04 as Face04V2;
    page04_has =
      Array.isArray(p04.content_units) && p04.content_units.length > 0;
    page04_count = p04.content_units?.length ?? 0;
    page04_units = page04_has ? [...p04.content_units] : null;
    page04_boundary = p04.evidence_boundary ?? null;
  }

  const page05Paths = knownPage05PathIdsFromFace(input.page05);

  const face06Units = (input.pack?.units ?? []).filter((u) =>
    u.serves_face.includes("06"),
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
  const dirs = (input.dc.dirs ?? []).map((d) => ({
    dir_id: d.dir_id,
    need: d.need,
    why: d.why,
    current_state: d.current_state,
    required_fact_roles: d.required_fact_roles,
  }));

  const personal_readings = seeded.readings.slice(0, 16).map((r) => ({
    reading_id: r.reading_id,
    domain: (r.scope || "convergence").split(",")[0] || "convergence",
    excerpt: r.interpretation,
  }));
  for (const r of personal_readings) personalRefs.add(r.reading_id);

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
    page07_available: false,
    approved_readings: personal_readings,
    approved_reading_count: personal_readings.length,
    registry_claim_count: page06Claims.length,
  };

  let architecture = buildPage06ArchitectureEnvelope(snap);
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

  const bundleText = buildPage06ArchitecturePromptBundle({
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

  const production_payload: Face06ProductionPayload = {
    decision_question: input.dc.definition?.decision_question ?? "",
    locale: input.locale,
    page01: page01Obj
      ? {
          core_judgment: page01Obj.core_judgment,
          recommendation_conditions: page01Obj.recommendation_conditions,
          not_recommended: page01Obj.not_recommended,
          applicability_boundary: page01Obj.applicability_boundary,
          why_this_path: page01Obj.why_this_path ?? [],
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
      alternative_path_ids: [...page05Paths.alternative_path_ids],
      cautious_path_ids: page05Paths.cautious_path_ids,
      all_path_ids: [...page05Paths.all_path_ids],
      path_units: page05Paths.path_units,
      switching_rules: page05Paths.switching_rules,
    },
    reality: {
      confirmed_facts,
      unverified_facts,
      declined_or_unknown_facts,
      open_conflicts,
      constraints,
      dirs,
    },
    book_judgment_face06_units: face06Units.map((u) => ({
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
      claims: page06Claims.map((c) => ({
        claim_id: c.claim_id,
        page_id: c.page_id,
        segment_id: c.segment_id,
        body_text: c.body_text,
        claim_type: c.claim_type,
        evidence_ids: c.evidence_ids,
        evidence_requirement: c.evidence_requirement,
        limitation: c.limitation ?? null,
      })),
      evidence: page06Evidence.map((e) => ({
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

  const pair = buildFace06PromptPair({
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

  const knownPage05PathIds: Face06Page05PathSets = {
    preferred_path_ids: page05Paths.preferred_path_ids,
    alternative_path_ids: page05Paths.alternative_path_ids,
    all_path_ids: page05Paths.all_path_ids,
  };

  return {
    ok: true,
    ctx: {
      prompt_version: PAGE06_ARCHITECTURE_PROMPT_VERSION,
      schema_version: "face06-v2",
      system: pair.system,
      user: pair.user,
      registry: restrictedRegistry,
      knownFactIds: new Set(facts.map((f) => f.fact_id)),
      factStatusById,
      factContentById,
      knownPage05PathIds,
      knownPersonalUnitRefs: personalRefs,
      available_domains: domains.available_domains,
      domain_versions: domains.domain_versions,
      profile_version: domains.profile_version,
      architecture,
      architecture_prompt_bundle: bundleText,
      production_payload,
      may_invoke_llm: !blocked,
    },
  };
}

export function validateFace06ProductionOutput(input: {
  raw: unknown;
  locale: string;
  ctx: Face06ProductionContext;
}):
  | { ok: true; page: Face06V2 }
  | { ok: false; issues: Face06Issue[]; reason: string } {
  const result = validateFace06Output({
    raw: input.raw,
    locale: input.locale,
    registry: input.ctx.registry,
    knownFactIds: input.ctx.knownFactIds,
    factStatusById: input.ctx.factStatusById,
    page05Paths: input.ctx.knownPage05PathIds,
    knownPersonalUnitRefs: input.ctx.knownPersonalUnitRefs,
    reject_legacy_ids: true,
  });
  if (!result.ok) {
    return {
      ok: false,
      issues: result.issues,
      reason: "face06_validation_failed",
    };
  }
  if (!input.ctx.may_invoke_llm) {
    return {
      ok: false,
      issues: [
        {
          code: "architecture_blocked_invoke",
          detail:
            "Face06 LLM output rejected: may_invoke_llm=false (required inputs missing).",
        },
      ],
      reason: "face06_blocked_on_required_inputs",
    };
  }
  const envelope: Page06ArchitectureEnvelope = {
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
  const attached = attachPage06ArchitectureToPage(result.page, envelope);
  const localeBucket = (input.locale || "en").toLowerCase().slice(0, 2);
  const stampedLocale =
    localeBucket === "zh" ||
    localeBucket === "en" ||
    localeBucket === "es" ||
    localeBucket === "fr" ||
    localeBucket === "de"
      ? (localeBucket as Face06V2["locale"])
      : ("en" as Face06V2["locale"]);
  return {
    ok: true,
    page: { ...attached, locale: attached.locale ?? stampedLocale },
  };
}

export function buildFace06RepairUserMessage(input: {
  previousUser: string;
  previousRaw: string;
  issues: Face06Issue[];
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
    "上一稿未通过程序校验。请只修正下列问题后重新输出完整 JSON（仍须符合 Face06V2 schema）。",
    "不得新增输入中不存在的 fact_id / evidence_id / claim_id / path_id / personal unit ref。",
    "不得越过本页 evidence_registry 边界。",
    "不得用 Markdown 包裹。",
    "不得使用 legacy_ 前缀伪造引用。",
    "不得编造评分/成功概率。",
    "不得发明 Page05 之外的路径。",
    "错误列表：",
    issueLines,
    "",
    "## 上一稿（仅供对照）",
    input.previousRaw.slice(0, 6000),
  ].join("\n");
}

export function parseFace06JsonStrict(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  if (/^```/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function face06SliceSummary(
  ctx: Face06ProductionContext,
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
    preferred_path_ids: ctx.knownPage05PathIds.preferred_path_ids,
  };
}
