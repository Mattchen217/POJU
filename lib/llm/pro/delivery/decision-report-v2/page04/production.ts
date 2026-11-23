/**
 * Face 04 production orchestration — used by content-body / Lab.
 * UNIQUE entry: buildFace04ProductionContext.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { Face04V2Schema, type Face04V2, type Face01V2, type Face02V2 } from "../schemas";
import { isFace01V2 } from "../page01/legacy-adapter";
import { isFace02V2 } from "../page02/legacy-adapter";
import { seedEvidenceRegistryForFace02 } from "../registry-from-sources";
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
import { buildFace04PromptPair } from "./prompt";
import { validateFace04Output, type Face04Issue } from "./validate";
import type { EvidenceRegistry } from "../types";

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

  const seeded = seedEvidenceRegistryForFace02({
    dc: input.dc,
    pack: input.pack,
    maxFacts: 16,
    chart_fact_pack: input.chart_fact_pack,
    ziwei_fact_pack: null,
    bazi_available: domains.bazi_available,
    ziwei_available: domains.ziwei_available,
  });

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
  if (isFace02V2(input.page02)) {
    const p02 = input.page02 as Face02V2;
    page02_has =
      Array.isArray(p02.content_units) && p02.content_units.length > 0;
    page02_count = p02.content_units?.length ?? 0;
  }

  const face04UnitCount = (input.pack?.units ?? []).filter((u) =>
    u.serves_face.includes("04"),
  ).length;
  const registryClaimCount = Math.max(
    face04UnitCount,
    seeded.key_claims.length,
    Math.min(8, Object.keys(seeded.registry.claims).length),
  );

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
    approved_readings: seeded.readings.slice(0, 16).map((r) => ({
      reading_id: r.reading_id,
      domain: (r.scope || "convergence").split(",")[0] || "convergence",
      excerpt: r.interpretation,
    })),
    approved_reading_count: seeded.readings.length,
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

  const pair = buildFace04PromptPair({
    locale: input.locale,
    architecture_prompt_bundle: bundleText,
    page01_core_judgment: page01_core,
    decision_question: input.dc.definition?.decision_question ?? "",
  });

  const factStatusById = new Map<string, string>();
  const factContentById = new Map<string, string>();
  for (const f of input.dc.reality_facts ?? []) {
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
      registry: seeded.registry,
      knownFactIds: new Set(
        (input.dc.reality_facts ?? []).map((f) => f.fact_id),
      ),
      factStatusById,
      factContentById,
      available_domains: domains.available_domains,
      domain_versions: domains.domain_versions,
      profile_version: domains.profile_version,
      page01_core_judgment: page01_core,
      architecture,
      architecture_prompt_bundle: bundleText,
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
  };
}

export { Face04V2Schema };
