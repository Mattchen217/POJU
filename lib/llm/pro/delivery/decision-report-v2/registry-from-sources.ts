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
import type {
  ApprovedReading,
  DecisionReportRealityFact,
  EvidenceRegistry,
  PersonalAnalysisAnchor,
  ReportClaim,
  ReportEvidence,
} from "./types";
import { realityFactsFromDecisionContext } from "./page01/slice";

export type RegistrySeedResult = {
  registry: EvidenceRegistry;
  facts: DecisionReportRealityFact[];
  readings: ApprovedReading[];
  anchors: PersonalAnalysisAnchor[];
  key_claims: ReportClaim[];
  knownFactIds: Set<string>;
  page02PlannedEvidenceIds: string[];
};

function unitToReading(unit: BookJudgmentUnit): ApprovedReading {
  return {
    reading_id: `reading_${unit.id}`,
    anchor_ids: unit.anchors.map((a, i) => `anchor_${unit.id}_${i}`),
    term_ids: [],
    interpretation: unit.claim,
    scope: unit.serves_face.join(","),
    confidence_status: "pack_approved",
  };
}

function unitToAnchors(unit: BookJudgmentUnit): PersonalAnalysisAnchor[] {
  return unit.anchors.map((a, i) => ({
    anchor_id: `anchor_${unit.id}_${i}`,
    source_domain: unit.track === "destiny" ? "bazi_ziwei" : "science",
    source_reference: a,
    internal_anchor: { pack_unit_id: unit.id, anchor: a },
    approved_interpretation: unit.claim,
    availability_status: "available",
  }));
}

/**
 * Build registry for Face 01 generation.
 * - DC facts → reality_fact evidence (id = fact_id prefixed ev_fact_)
 * - Pack units serving 01/02 → claims + evidence (evidence_id = pack unit id)
 * Page 02 planned evidence = pack units that serve face 02.
 */
export function seedEvidenceRegistryForFace01(input: {
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  /** Max confirmed + non-confirmed facts retained for page 01. */
  maxFacts?: number;
}): RegistrySeedResult {
  const maxFacts = input.maxFacts ?? 16;
  const registry = emptyEvidenceRegistry();
  const allFacts = input.dc ? realityFactsFromDecisionContext(input.dc) : [];

  // Prefer confirmed first, then keep status diversity without dumping whole DC.
  const confirmed = allFacts.filter((f) => f.status === "confirmed");
  const rest = allFacts.filter((f) => f.status !== "confirmed");
  const facts = [...confirmed, ...rest].slice(0, maxFacts);
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
    };
    registerEvidence(registry, ev, {
      facts: factMap,
      readings: new Map(),
    });
  }

  const units = input.pack?.units ?? [];
  const face01Units = units.filter((u) => u.serves_face.includes("01"));
  const face02Units = units.filter((u) => u.serves_face.includes("02"));
  const relevantUnits = [
    ...face01Units,
    ...face02Units.filter((u) => !face01Units.some((a) => a.id === u.id)),
  ].slice(0, 24);

  const readings: ApprovedReading[] = [];
  const anchors: PersonalAnalysisAnchor[] = [];
  const key_claims: ReportClaim[] = [];
  const page02PlannedEvidenceIds: string[] = [];

  for (const unit of relevantUnits) {
    const reading = unitToReading(unit);
    readings.push(reading);
    anchors.push(...unitToAnchors(unit));
    const readingMap = new Map(readings.map((r) => [r.reading_id, r]));

    const sourceType =
      unit.track === "science"
        ? ("reality_mechanism" as const)
        : unit.track === "convergence"
          ? ("reality_mechanism" as const)
          : ("personal_reading" as const);

    const evidence_id = unit.id;
    const ev: ReportEvidence = {
      evidence_id,
      source_type: sourceType,
      source_id:
        sourceType === "personal_reading" ? reading.reading_id : `mech_${unit.id}`,
      term_ids: [],
      explanation: unit.caveat
        ? `${unit.claim}（边界：${unit.caveat}）`
        : unit.claim,
      supports_claim_ids: [],
      limits_claim_ids: [],
    };
    // For reality_mechanism, skip fact/reading checks by registering with empty maps
    // after personal_reading path handled.
    if (sourceType === "personal_reading") {
      registerEvidence(registry, ev, { facts: factMap, readings: readingMap });
    } else {
      registry.evidence[evidence_id] = ev;
    }

    if (unit.serves_face.includes("02")) {
      page02PlannedEvidenceIds.push(evidence_id);
    }

    if (unit.serves_face.includes("01")) {
      const claim_id = `claim_${unit.id}`;
      const claim: ReportClaim = {
        claim_id,
        page_id: "01",
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

  // Ensure every fact evidence is also a known source_id for conditions.
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
  };
}
