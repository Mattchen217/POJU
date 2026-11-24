/**
 * Production-context → consumed-input → fingerprint adapters (Batch 1 R2).
 *
 * Chain: buildFaceXXProductionContext() → extract consumed slice →
 * component hashes → page input fingerprint.
 *
 * Does not invent opaque caller strings; does not hash whole-job bags.
 */

import { canonicalJson } from "@/lib/poju/decision-context/normalize";
import { sha256Hex } from "@/lib/sha256";
import type { EvidenceRegistry } from "../types";
import type { Face01ProductionContext } from "../page01/production";
import type { Face02ProductionContext } from "../page02/production";
import type { Face04ProductionContext } from "../page04/production";
import type { Face05ProductionContext } from "../page05/production";
import type { Face06ProductionContext } from "../page06/production";
import type { Face07ProductionContext } from "../page07/production";
import type { Face08ProductionContext } from "../page08/production";
import { pageSharedInputKeys, reportPageDefinition } from "./page-registry";
import type {
  ReportPage07ApplicabilityStatus,
  ReportPageId,
  ReportPageSharedInputSlice,
  ReportSharedInputKey,
} from "./types";

const textEncoder = new TextEncoder();

export type ReportPageConsumedInputExtract = {
  page_id: ReportPageId;
  /** Keys actually populated for this page (must match registry shared_input_keys). */
  consumed_keys: readonly ReportSharedInputKey[];
  /**
   * Structured sub-payloads that were hashed into the shared slice.
   * Present for tests / debugging; fingerprints use the hashes only.
   */
  components: Partial<Record<ReportSharedInputKey, unknown>>;
  shared_slice: ReportPageSharedInputSlice;
};

export type ProductionContextFingerprintOk = {
  ok: true;
  extract: ReportPageConsumedInputExtract;
};

export type ProductionContextFingerprintFail = {
  ok: false;
  page_id: ReportPageId;
  code: string;
  detail: string;
};

export type ProductionContextFingerprintResult =
  | ProductionContextFingerprintOk
  | ProductionContextFingerprintFail;

function sortedObjectValues<T>(
  record: Record<string, T>,
): Array<{ id: string; value: T }> {
  return Object.keys(record)
    .sort()
    .map((id) => ({ id, value: record[id]! }));
}

function serializeRegistry(registry: EvidenceRegistry): unknown {
  return {
    claims: sortedObjectValues(registry.claims).map(({ id, value }) => ({
      claim_id: id,
      page_id: value.page_id,
      segment_id: value.segment_id,
      body_text: value.body_text,
      claim_type: value.claim_type,
      evidence_ids: [...(value.evidence_ids ?? [])].sort(),
      evidence_requirement: value.evidence_requirement,
      limitation: value.limitation ?? null,
    })),
    evidence: sortedObjectValues(registry.evidence).map(({ id, value }) => ({
      evidence_id: id,
      source_type: value.source_type,
      source_id: value.source_id,
      explanation: value.explanation,
      supports_claim_ids: [...(value.supports_claim_ids ?? [])].sort(),
      limits_claim_ids: [...(value.limits_claim_ids ?? [])].sort(),
      term_ids: [...(value.term_ids ?? [])].sort(),
      verification_status: value.verification_status ?? null,
      source_domain: value.source_domain ?? null,
      source_version: value.source_version ?? null,
    })),
  };
}

function domainVersionsForAvailable(
  available: readonly string[],
  versions: { bazi?: string; ziwei?: string },
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of [...available].sort()) {
    if (d === "bazi" && versions.bazi) out.bazi = versions.bazi;
    if (d === "ziwei" && versions.ziwei) out.ziwei = versions.ziwei;
  }
  return out;
}

function hashComponent(value: unknown): string {
  return sha256Hex(textEncoder.encode(canonicalJson(value)));
}

function finishExtract(
  pageId: ReportPageId,
  components: Partial<Record<ReportSharedInputKey, unknown>>,
): ProductionContextFingerprintResult {
  const required = pageSharedInputKeys(pageId);
  const shared_slice: ReportPageSharedInputSlice = { locale: "" };
  const missing: ReportSharedInputKey[] = [];
  for (const key of required) {
    if (!(key in components) || components[key] === undefined) {
      missing.push(key);
      continue;
    }
    if (key === "locale") {
      const loc = components.locale;
      if (typeof loc !== "string" || !loc.trim()) {
        missing.push(key);
        continue;
      }
      shared_slice.locale = loc.trim();
      continue;
    }
    shared_slice[key] = hashComponent(components[key]);
  }
  if (missing.length) {
    return {
      ok: false,
      page_id: pageId,
      code: "incomplete_production_context_slice",
      detail: `page ${pageId} missing consumed components: ${missing.join(", ")}`,
    };
  }
  if (!shared_slice.locale.trim()) {
    return {
      ok: false,
      page_id: pageId,
      code: "missing_locale_in_production_context",
      detail: `page ${pageId} production context has empty locale`,
    };
  }
  return {
    ok: true,
    extract: {
      page_id: pageId,
      consumed_keys: required,
      components,
      shared_slice,
    },
  };
}

/** Face01: slice + restricted registry only (face-filtered). */
export function extractConsumedInputFromFace01(
  ctx: Face01ProductionContext,
): ProductionContextFingerprintResult {
  const locale = ctx.slice.locale;
  const dc = {
    facts: [...ctx.slice.reality_context.facts].sort((a, b) =>
      a.fact_id.localeCompare(b.fact_id),
    ),
    conflicts: ctx.slice.reality_context.conflicts,
    hypotheses: ctx.slice.reality_context.hypotheses,
  };
  const personal = {
    profile_version: ctx.profile_version,
    available_domains: [...ctx.available_domains].sort(),
    domain_versions: domainVersionsForAvailable(
      ctx.available_domains,
      ctx.domain_versions,
    ),
    relevant_anchors: ctx.slice.personal_analysis.relevant_anchors,
  };
  const readings = [...ctx.slice.personal_analysis.approved_readings].sort(
    (a, b) => a.reading_id.localeCompare(b.reading_id),
  );
  const decision = {
    decision: ctx.slice.decision,
    report_analysis: {
      key_claims: ctx.slice.report_analysis.key_claims,
      unresolved_issues: ctx.slice.report_analysis.unresolved_issues,
      decision_synthesis: ctx.slice.report_analysis.decision_synthesis,
    },
    fact_selection: {
      sparse_structured_links: ctx.fact_selection.sparse_structured_links,
      selected: ctx.fact_selection.selected.map((r) => ({
        fact_id: r.fact.fact_id,
        kind: r.kind,
        reasons: r.reasons,
      })),
      excluded_fact_ids: [...ctx.fact_selection.excluded_fact_ids].sort(),
    },
    page02PlannedEvidenceIds: [...ctx.page02PlannedEvidenceIds].sort(),
  };
  return finishExtract("01", {
    locale,
    dc_consumed: dc,
    personal_consumed: personal,
    readings_consumed: readings,
    registry_consumed: serializeRegistry(ctx.registry),
    decision_consumed: decision,
  });
}

/** Face02: face-filtered slice/registry + optional Page01 alignment content. */
export function extractConsumedInputFromFace02(
  ctx: Face02ProductionContext,
): ProductionContextFingerprintResult {
  const locale = ctx.slice.locale;
  const dc = {
    facts: [...ctx.slice.reality_context.facts].sort((a, b) =>
      a.fact_id.localeCompare(b.fact_id),
    ),
    conflicts: ctx.slice.reality_context.conflicts,
    hypotheses: ctx.slice.reality_context.hypotheses,
  };
  const personal = {
    profile_version: ctx.profile_version,
    available_domains: [...ctx.available_domains].sort(),
    domain_versions: domainVersionsForAvailable(
      ctx.available_domains,
      ctx.domain_versions,
    ),
    relevant_anchors: ctx.slice.personal_analysis.relevant_anchors,
  };
  const readings = [...ctx.slice.personal_analysis.approved_readings].sort(
    (a, b) => a.reading_id.localeCompare(b.reading_id),
  );
  const decision = {
    decision: ctx.slice.decision,
    report_analysis: {
      key_claims: ctx.slice.report_analysis.key_claims,
      unresolved_issues: ctx.slice.report_analysis.unresolved_issues,
      decision_synthesis: ctx.slice.report_analysis.decision_synthesis,
    },
    fact_selection: {
      sparse_structured_links: ctx.fact_selection.sparse_structured_links,
      selected: ctx.fact_selection.selected.map((r) => ({
        fact_id: r.fact.fact_id,
        kind: r.kind,
        reasons: r.reasons,
      })),
      excluded_fact_ids: [...ctx.fact_selection.excluded_fact_ids].sort(),
    },
    credible_fact_claim_pairs: [...ctx.credible_fact_claim_pairs].sort((a, b) =>
      `${a.claim_id}:${a.fact_id}`.localeCompare(`${b.claim_id}:${b.fact_id}`),
    ),
    trusted_claim_dir_bindings: [...ctx.trusted_claim_dir_bindings.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([claim_id, binding]) => ({
        claim_id,
        unit_id: binding.unit_id,
        related_dir_ids: [...(binding.related_dir_ids ?? [])].sort(),
        reasons: [...(binding.reasons ?? [])].sort(),
        source_ref: binding.source_ref ?? null,
        association_basis: binding.association_basis ?? null,
      })),
  };
  const page01_alignment = {
    core_judgment_text:
      ctx.page01_core_judgment ??
      ctx.slice.page01_judgment_context?.core_judgment_text ??
      null,
    why_paths: ctx.slice.page01_judgment_context?.why_paths ?? [],
    present: Boolean(
      (ctx.page01_core_judgment && ctx.page01_core_judgment.trim()) ||
        (ctx.slice.page01_judgment_context?.core_judgment_text &&
          ctx.slice.page01_judgment_context.core_judgment_text.trim()),
    ),
  };
  return finishExtract("02", {
    locale,
    dc_consumed: dc,
    personal_consumed: personal,
    readings_consumed: readings,
    registry_consumed: serializeRegistry(ctx.registry),
    decision_consumed: decision,
    page01_alignment_consumed: page01_alignment,
  });
}

type ArchitecturePageCtx = {
  production_payload: {
    locale: string;
    reality: unknown;
    personal_readings?: unknown;
    book_judgment_face04_units?: unknown;
    book_judgment_face05_units?: unknown;
    book_judgment_face06_units?: unknown;
    book_judgment_face07_units?: unknown;
    book_judgment_face08_units?: unknown;
    registry: unknown;
    page01?: unknown;
    page02?: unknown;
    page04?: unknown;
    page05?: unknown;
    page06?: unknown;
    page07?: unknown;
    decision_question?: string;
    applicability_status?: string;
    applicability_reason?: string;
    authorized_partner_profile?: boolean;
    dirs?: unknown;
  };
  available_domains?: readonly string[];
  domain_versions?: { bazi?: string; ziwei?: string };
  profile_version?: string | null;
};

function extractFromArchitecturePayload(
  pageId: ReportPageId,
  ctx: ArchitecturePageCtx,
  extra: Partial<Record<ReportSharedInputKey, unknown>> = {},
): ProductionContextFingerprintResult {
  const p = ctx.production_payload;
  const locale = p.locale;
  const faceUnitsKey =
    pageId === "04"
      ? "book_judgment_face04_units"
      : pageId === "05"
        ? "book_judgment_face05_units"
        : pageId === "06"
          ? "book_judgment_face06_units"
          : pageId === "07"
            ? "book_judgment_face07_units"
            : "book_judgment_face08_units";
  const faceUnits = (p as Record<string, unknown>)[faceUnitsKey] ?? [];
  const personal = {
    profile_version: ctx.profile_version ?? null,
    available_domains: [...(ctx.available_domains ?? [])].sort(),
    domain_versions: domainVersionsForAvailable(
      ctx.available_domains ?? [],
      ctx.domain_versions ?? {},
    ),
    book_judgment_face_units: faceUnits,
  };
  const upstream_alignment = {
    page01: p.page01 ?? null,
    page02: p.page02 ?? null,
    page04: p.page04 ?? null,
    page05: p.page05 ?? null,
    page06: p.page06 ?? null,
    page07: p.page07 ?? null,
  };
  const components: Partial<Record<ReportSharedInputKey, unknown>> = {
    locale,
    dc_consumed: {
      reality: p.reality,
      decision_question: p.decision_question ?? null,
    },
    personal_consumed: personal,
    registry_consumed: p.registry,
    upstream_payload_alignment_consumed: upstream_alignment,
    ...extra,
  };
  // Only pages that actually feed personal_readings into the payload declare this key.
  if (pageSharedInputKeys(pageId).includes("readings_consumed")) {
    components.readings_consumed = p.personal_readings ?? [];
  }
  return finishExtract(pageId, components);
}

export function extractConsumedInputFromFace04(
  ctx: Face04ProductionContext,
): ProductionContextFingerprintResult {
  return extractFromArchitecturePayload("04", {
    production_payload: ctx.production_payload,
    available_domains: ctx.available_domains,
    domain_versions: ctx.domain_versions,
    profile_version: ctx.profile_version,
  });
}

export function extractConsumedInputFromFace05(
  ctx: Face05ProductionContext,
): ProductionContextFingerprintResult {
  return extractFromArchitecturePayload("05", {
    production_payload: ctx.production_payload as ArchitecturePageCtx["production_payload"],
    available_domains: ctx.available_domains,
    domain_versions: ctx.domain_versions,
    profile_version: ctx.profile_version,
  });
}

export function extractConsumedInputFromFace06(
  ctx: Face06ProductionContext,
): ProductionContextFingerprintResult {
  return extractFromArchitecturePayload("06", {
    production_payload: ctx.production_payload as ArchitecturePageCtx["production_payload"],
    available_domains: ctx.available_domains,
    domain_versions: ctx.domain_versions,
    profile_version: ctx.profile_version,
  });
}

export function extractConsumedInputFromFace07(
  ctx: Face07ProductionContext,
): ProductionContextFingerprintResult {
  return extractFromArchitecturePayload(
    "07",
    {
      production_payload: ctx.production_payload,
      available_domains: ctx.available_domains,
      domain_versions: ctx.domain_versions,
      profile_version: ctx.profile_version,
    },
    {
      applicability_consumed: {
        status: ctx.applicability.status,
        reason: ctx.applicability.reason,
        authorized_partner_profile: ctx.authorized_partner_profile,
      },
    },
  );
}

export function extractConsumedInputFromFace08(
  ctx: Face08ProductionContext,
): ProductionContextFingerprintResult {
  return extractFromArchitecturePayload(
    "08",
    {
      production_payload: ctx.production_payload as ArchitecturePageCtx["production_payload"],
      available_domains: [],
      domain_versions: {},
      profile_version: null,
    },
    {
      date_corpus_consumed: ctx.dateCorpus,
    },
  );
}

/**
 * Unified entry: pageId + production context → shared input slice fingerprints.
 */
export function buildPageSharedInputFingerprintFromProductionContext(
  pageId: ReportPageId,
  productionContext: unknown,
): ProductionContextFingerprintResult {
  if (!productionContext || typeof productionContext !== "object") {
    return {
      ok: false,
      page_id: pageId,
      code: "missing_production_context",
      detail: `page ${pageId} requires a real production context object`,
    };
  }
  switch (pageId) {
    case "01":
      return extractConsumedInputFromFace01(
        productionContext as Face01ProductionContext,
      );
    case "02":
      return extractConsumedInputFromFace02(
        productionContext as Face02ProductionContext,
      );
    case "04":
      return extractConsumedInputFromFace04(
        productionContext as Face04ProductionContext,
      );
    case "05":
      return extractConsumedInputFromFace05(
        productionContext as Face05ProductionContext,
      );
    case "06":
      return extractConsumedInputFromFace06(
        productionContext as Face06ProductionContext,
      );
    case "07":
      return extractConsumedInputFromFace07(
        productionContext as Face07ProductionContext,
      );
    case "08":
      return extractConsumedInputFromFace08(
        productionContext as Face08ProductionContext,
      );
    default: {
      const _exhaustive: never = pageId;
      return {
        ok: false,
        page_id: _exhaustive,
        code: "unknown_page_id",
        detail: `unknown page ${_exhaustive}`,
      };
    }
  }
}

/**
 * Resolve page07 applicability for fingerprinting from a Face07/08 context when present.
 */
export function applicabilityFromProductionContext(
  pageId: ReportPageId,
  productionContext: unknown,
): ReportPage07ApplicabilityStatus | null {
  if (pageId === "07" && productionContext && typeof productionContext === "object") {
    const app = (productionContext as Face07ProductionContext).applicability;
    if (app?.status === "applicable") return "applicable";
    if (app?.status === "not_applicable") return "not_applicable";
    if (app?.status === "insufficient_information") return "insufficient_information";
  }
  if (pageId === "08" && productionContext && typeof productionContext === "object") {
    const payload = (productionContext as Face08ProductionContext).production_payload;
    const st = payload?.page07?.applicability_status;
    if (st === "applicable" || st === "not_applicable" || st === "insufficient_information") {
      return st;
    }
    const presence = payload?.page07?.presence;
    if (presence === "not_applicable") return "not_applicable";
    if (presence === "insufficient_information") return "insufficient_information";
    if (presence === "applicable") return "applicable";
  }
  return null;
}

/** Assert registry shared_input_keys match what adapters populate. */
export function assertPageSharedInputKeysAligned(pageId: ReportPageId): void {
  const def = reportPageDefinition(pageId);
  if (!def.shared_input_keys.includes("locale")) {
    throw new Error(`page ${pageId} must declare locale in shared_input_keys`);
  }
}
