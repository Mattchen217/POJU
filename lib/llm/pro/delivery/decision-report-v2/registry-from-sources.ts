/**
 * Seed report-level evidence registry from frozen DC + BookJudgmentPack.
 * Page 01 may cite these IDs; model must not invent new source IDs.
 */

import type { BookJudgmentPack, BookJudgmentUnit } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  emptyEvidenceRegistry,
  registerClaim,
  registerEvidence,
} from "./evidence-registry";
import {
  selectRealityFactsForPage01,
  type FactSelectionResult,
} from "./fact-relevance";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import {
  canonicalPatternHitRefSet,
  detectAvailableCfpKeys,
  resolveUnitTermProvenance,
  type PersonalSourceDomain,
} from "./term-provenance";
import type {
  ApprovedReading,
  DecisionReportRealityFact,
  EvidenceRegistry,
  PersonalAnalysisAnchor,
  ReportClaim,
  ReportEvidence,
} from "./types";
import type { Page01FeedSlice } from "./page01/slice";

export type RegistrySeedResult = {
  registry: EvidenceRegistry;
  facts: DecisionReportRealityFact[];
  readings: ApprovedReading[];
  anchors: PersonalAnalysisAnchor[];
  key_claims: ReportClaim[];
  knownFactIds: Set<string>;
  page02PlannedEvidenceIds: string[];
  fact_selection: FactSelectionResult;
};

function unitToReading(
  unit: BookJudgmentUnit,
  term_ids: string[],
): ApprovedReading {
  return {
    reading_id: `reading_${unit.id}`,
    anchor_ids: unit.anchors.map((_, i) => `anchor_${unit.id}_${i}`),
    term_ids,
    interpretation: unit.claim,
    scope: unit.serves_face.join(","),
    confidence_status: "pack_approved",
  };
}

function unitToAnchors(input: {
  unit: BookJudgmentUnit;
  source_domain: PersonalSourceDomain;
  term_ids: string[];
  source_version: string | null;
}): PersonalAnalysisAnchor[] {
  const { unit, source_domain, term_ids, source_version } = input;
  if (unit.track === "destiny" && source_domain === "unavailable") {
    return [];
  }
  return unit.anchors.map((a, i) => ({
    anchor_id: `anchor_${unit.id}_${i}`,
    source_domain,
    source_reference: a,
    ...(term_ids.length
      ? {
          term_id: term_ids[Math.min(i, Math.max(0, term_ids.length - 1))],
        }
      : {}),
    internal_anchor: {
      pack_unit_id: unit.id,
      anchor: a,
      source_version,
      term_ids,
    },
    approved_interpretation: unit.claim,
    availability_status:
      source_domain === "unavailable" ? "unavailable" : "available",
  }));
}

/**
 * Build registry for Face 01 generation.
 * Facts are selected by structured DC relevance (not confirmed-first dump).
 */
function seedEvidenceRegistryForFace(input: {
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  maxFacts?: number;
  chart_fact_pack?: string | null;
  ziwei_fact_pack?: ZiweiFactPack | null;
  bazi_available?: boolean;
  ziwei_available?: boolean;
  /** Which face units/claims to materialize. */
  face_id: "01" | "02";
}): RegistrySeedResult {
  const maxFacts = input.maxFacts ?? 16;
  const registry = emptyEvidenceRegistry();

  const fact_selection = input.dc
    ? selectRealityFactsForPage01({ dc: input.dc, maxFacts })
    : {
        selected: [],
        excluded_fact_ids: [],
        sparse_structured_links: true,
      };

  const facts = fact_selection.selected.map((r) => r.fact);
  const factMap = new Map(facts.map((f) => [f.fact_id, f]));
  const knownFactIds = new Set(facts.map((f) => f.fact_id));

  for (const f of facts) {
    const ev: ReportEvidence = {
      evidence_id: `ev_fact_${f.fact_id}`,
      source_type: "reality_fact",
      source_id: f.fact_id,
      term_ids: [],
      explanation: f.content,
      supports_claim_ids: [],
      limits_claim_ids: [],
      verification_status: `${f.status}/${f.verification}`,
      source_domain: "reality",
      source_version: null,
      mechanism_kind: null,
    };
    registerEvidence(registry, ev, {
      facts: factMap,
      readings: new Map(),
    });
  }

  const pack = input.pack ?? null;
  const bazi_available = input.bazi_available === true;
  const ziwei_available = input.ziwei_available === true;
  const cfpKeys = detectAvailableCfpKeys(input.chart_fact_pack);
  const cfp_hash = pack?.cfp_hash ?? null;
  const zfp_hash = pack?.zfp_hash ?? null;
  // Re-derive from real ZFP every seed — ignore pack.pattern_hits_used as authority.
  const actual_pattern_hit_refs = canonicalPatternHitRefSet(
    input.ziwei_fact_pack,
  );

  const units = pack?.units ?? [];
  const faceId = input.face_id;
  const primaryUnits = units.filter((u) => u.serves_face.includes(faceId));
  // Page01 may also keep a thin set of face-02 planned units for cite targets.
  const face02Units = units.filter((u) => u.serves_face.includes("02"));
  const relevantUnits =
    faceId === "01"
      ? [
          ...primaryUnits,
          ...face02Units.filter((u) => !primaryUnits.some((a) => a.id === u.id)),
        ].slice(0, 24)
      : primaryUnits.slice(0, 24);

  const readings: ApprovedReading[] = [];
  const anchors: PersonalAnalysisAnchor[] = [];
  const key_claims: ReportClaim[] = [];
  const page02PlannedEvidenceIds: string[] = [];

  for (const unit of relevantUnits) {
    // Prefer declared_* as the model-declaration probe; never treat stored
    // certified term_ids as authority without re-deriving from structured cites.
    const probe: BookJudgmentUnit = {
      ...unit,
      term_ids: unit.declared_term_ids?.length
        ? unit.declared_term_ids
        : [],
      source_domain: unit.declared_source_domain ?? unit.source_domain,
      source_version: unit.declared_source_version ?? unit.source_version,
    };
    const prov = resolveUnitTermProvenance({
      unit: probe,
      actual_pattern_hit_refs,
      availableCfpKeys: cfpKeys,
      bazi_available,
      ziwei_available,
      cfp_hash,
      zfp_hash,
    });

    // Destiny with no usable domain → skip personal reading/anchors (do not invent).
    if (unit.track === "destiny" && prov.source_domain === "unavailable") {
      if (unit.serves_face.includes("02")) {
        // Still register a mechanism-less planned id? No — unavailable means no fake evidence.
      }
      continue;
    }

    const reading = unitToReading(unit, prov.term_ids);
    const unitAnchors = unitToAnchors({
      unit,
      source_domain: prov.source_domain,
      term_ids: prov.term_ids,
      source_version: prov.source_version,
    });
    readings.push(reading);
    anchors.push(...unitAnchors);
    const readingMap = new Map(readings.map((r) => [r.reading_id, r]));

    const sourceType =
      unit.track === "science"
        ? ("reality_mechanism" as const)
        : unit.track === "convergence"
          ? ("reality_mechanism" as const)
          : ("personal_reading" as const);

    const evidence_id = unit.id;
    const trustedDomain =
      sourceType === "personal_reading"
        ? prov.source_domain === "unavailable"
          ? null
          : prov.source_domain
        : unit.track === "convergence"
          ? "convergence"
          : "science";
    const trustedVersion =
      sourceType === "personal_reading"
        ? prov.source_version
        : null;
    const ev: ReportEvidence = {
      evidence_id,
      source_type: sourceType,
      source_id:
        sourceType === "personal_reading" ? reading.reading_id : `mech_${unit.id}`,
      term_ids: prov.term_ids,
      explanation: unit.caveat
        ? `${unit.claim}（边界：${unit.caveat}）`
        : unit.claim,
      supports_claim_ids: [],
      limits_claim_ids: [],
      // Program-derived only — never model declared_* fields.
      source_domain: trustedDomain,
      source_version: trustedVersion,
      mechanism_kind:
        sourceType === "reality_mechanism"
          ? unit.track === "convergence"
            ? "convergence"
            : "science"
          : null,
    };
    if (sourceType === "personal_reading") {
      registerEvidence(registry, ev, { facts: factMap, readings: readingMap });
    } else {
      registry.evidence[evidence_id] = ev;
    }

    if (unit.serves_face.includes("02")) {
      page02PlannedEvidenceIds.push(evidence_id);
    }

    if (unit.serves_face.includes(faceId)) {
      const claim_id = `claim_${unit.id}`;
      const claim: ReportClaim = {
        claim_id,
        page_id: faceId,
        segment_id: unit.serves_segment ?? "A",
        body_text: unit.claim,
        claim_type:
          unit.track === "destiny"
            ? "personal_interpretation"
            : unit.track === "science"
              ? "reality_analysis"
              : "recommendation",
        evidence_ids: [evidence_id],
        evidence_requirement: "required",
        limitation: unit.caveat,
      };
      registerClaim(registry, claim);
      key_claims.push(claim);
      const stored = registry.evidence[evidence_id];
      if (stored && !stored.supports_claim_ids.includes(claim_id)) {
        stored.supports_claim_ids.push(claim_id);
      }
    }
  }

  for (const f of facts) {
    knownFactIds.add(f.fact_id);
    knownFactIds.add(`ev_fact_${f.fact_id}`);
  }

  return {
    registry,
    facts,
    readings,
    anchors,
    key_claims,
    knownFactIds,
    page02PlannedEvidenceIds: [...new Set(page02PlannedEvidenceIds)],
    fact_selection,
  };
}

export function seedEvidenceRegistryForFace01(input: {
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  maxFacts?: number;
  chart_fact_pack?: string | null;
  ziwei_fact_pack?: ZiweiFactPack | null;
  bazi_available?: boolean;
  ziwei_available?: boolean;
}): RegistrySeedResult {
  return seedEvidenceRegistryForFace({ ...input, face_id: "01" });
}

/** Page02 registry — only serves_face includes 02; re-certifies CFP/ZFP. */
export function seedEvidenceRegistryForFace02(input: {
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  maxFacts?: number;
  chart_fact_pack?: string | null;
  ziwei_fact_pack?: ZiweiFactPack | null;
  bazi_available?: boolean;
  ziwei_available?: boolean;
}): RegistrySeedResult {
  return seedEvidenceRegistryForFace({ ...input, face_id: "02" });
}

/**
 * Build a registry that exactly mirrors the final Page01 model slice.
 * Validator must use this — never the pre-filter seeded registry.
 */
export function restrictRegistryToPage01Slice(input: {
  seeded: RegistrySeedResult;
  slice: Page01FeedSlice;
}): {
  registry: EvidenceRegistry;
  knownFactIds: Set<string>;
  page02PlannedEvidenceIds: string[];
  slice: Page01FeedSlice;
} {
  const keepEvIds = new Set(
    input.slice.evidence_registry.evidence.map((e) => e.evidence_id),
  );
  const keepFactIds = new Set(
    input.slice.reality_context.facts.map((f) => f.fact_id),
  );
  const keepReadingIds = new Set(
    input.slice.personal_analysis.approved_readings.map((r) => r.reading_id),
  );

  const keepClaimIds = new Set<string>();
  for (const claimId of input.slice.evidence_registry.claim_ids) {
    const claim = input.seeded.registry.claims[claimId];
    if (!claim) continue;
    const evidence_ids = claim.evidence_ids.filter((id) => keepEvIds.has(id));
    if (claim.evidence_requirement === "required" && evidence_ids.length === 0) {
      continue;
    }
    keepClaimIds.add(claimId);
  }
  for (const c of input.slice.report_analysis.key_claims) {
    const claim = input.seeded.registry.claims[c.claim_id];
    if (!claim) continue;
    const evidence_ids = (c.evidence_ids?.length ? c.evidence_ids : claim.evidence_ids).filter(
      (id) => keepEvIds.has(id),
    );
    if (evidence_ids.length === 0 && claim.evidence_requirement === "required") {
      continue;
    }
    keepClaimIds.add(c.claim_id);
  }

  const registry = emptyEvidenceRegistry();

  for (const evRow of input.slice.evidence_registry.evidence) {
    const full = input.seeded.registry.evidence[evRow.evidence_id];
    if (!full) continue;

    if (full.source_type === "reality_fact" && !keepFactIds.has(full.source_id)) {
      continue;
    }
    if (
      full.source_type === "personal_reading" &&
      !keepReadingIds.has(full.source_id)
    ) {
      continue;
    }

    const supports = full.supports_claim_ids.filter((id) => keepClaimIds.has(id));
    const limits = full.limits_claim_ids.filter((id) => keepClaimIds.has(id));
    // Prefer slice term_ids (already filtered) when present.
    const term_ids =
      Array.isArray(evRow.term_ids) && evRow.term_ids.length
        ? evRow.term_ids
        : full.term_ids;
    registry.evidence[full.evidence_id] = {
      ...full,
      term_ids,
      supports_claim_ids: supports,
      limits_claim_ids: limits,
    };
  }

  const finalEvIds = new Set(Object.keys(registry.evidence));

  for (const claimId of keepClaimIds) {
    const claim = input.seeded.registry.claims[claimId];
    if (!claim) continue;
    const evidence_ids = claim.evidence_ids.filter((id) => finalEvIds.has(id));
    if (claim.evidence_requirement === "required" && evidence_ids.length === 0) {
      continue;
    }
    registry.claims[claimId] = { ...claim, evidence_ids };
  }

  const finalClaimIds = Object.keys(registry.claims);
  for (const id of Object.keys(registry.evidence)) {
    const ev = registry.evidence[id]!;
    ev.supports_claim_ids = ev.supports_claim_ids.filter((c) =>
      finalClaimIds.includes(c),
    );
    ev.limits_claim_ids = ev.limits_claim_ids.filter((c) =>
      finalClaimIds.includes(c),
    );
  }

  const knownFactIds = new Set<string>();
  for (const f of input.slice.reality_context.facts) {
    knownFactIds.add(f.fact_id);
    knownFactIds.add(`ev_fact_${f.fact_id}`);
  }

  const page02PlannedEvidenceIds = input.seeded.page02PlannedEvidenceIds.filter(
    (id) => finalEvIds.has(id),
  );

  const slice: Page01FeedSlice = {
    ...input.slice,
    evidence_registry: {
      claim_ids: finalClaimIds.slice(0, 12),
      evidence: input.slice.evidence_registry.evidence
        .filter((e) => finalEvIds.has(e.evidence_id))
        .map((e) => ({
          ...e,
          term_ids: registry.evidence[e.evidence_id]?.term_ids ?? e.term_ids,
        })),
    },
    report_analysis: {
      ...input.slice.report_analysis,
      key_claims: input.slice.report_analysis.key_claims.filter((c) =>
        finalClaimIds.includes(c.claim_id),
      ),
    },
  };

  return { registry, knownFactIds, page02PlannedEvidenceIds, slice };
}

/**
 * Build a registry that exactly mirrors the final Page02 model slice.
 * Same restriction mechanics as Page01 — separate entry for callers.
 */
export function restrictRegistryToPage02Slice(input: {
  seeded: RegistrySeedResult;
  slice: Page01FeedSlice;
}): {
  registry: EvidenceRegistry;
  knownFactIds: Set<string>;
  page02PlannedEvidenceIds: string[];
  slice: Page01FeedSlice;
} {
  return restrictRegistryToPage01Slice(input);
}
