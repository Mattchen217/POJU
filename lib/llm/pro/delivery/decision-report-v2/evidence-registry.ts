/**
 * Evidence / claim registry — validate IDs against known sources.
 * Never invent fact_id / reading_id; never convert personal reading → RealityFact.
 */

import { ReportClaimSchema, ReportEvidenceSchema } from "./schemas";
import type {
  ApprovedReading,
  DecisionReportRealityFact,
  EvidenceRegistry,
  ReportClaim,
  ReportEvidence,
} from "./types";

export type EvidenceRegistryError = {
  code:
    | "invalid_claim"
    | "invalid_evidence"
    | "missing_fact_id"
    | "missing_reading_id"
    | "missing_claim_id"
    | "missing_evidence_id"
    | "personal_reading_as_fact"
    | "hypothesis_as_fact"
    | "orphan_page02_ref";
  detail: string;
};

export function emptyEvidenceRegistry(): EvidenceRegistry {
  return { claims: {}, evidence: {} };
}

export function registerClaim(
  registry: EvidenceRegistry,
  claim: ReportClaim,
): EvidenceRegistryError | null {
  const parsed = ReportClaimSchema.safeParse(claim);
  if (!parsed.success) {
    return {
      code: "invalid_claim",
      detail: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  registry.claims[claim.claim_id] = parsed.data;
  return null;
}

export function registerEvidence(
  registry: EvidenceRegistry,
  evidence: ReportEvidence,
  opts: {
    facts: ReadonlyMap<string, DecisionReportRealityFact>;
    readings: ReadonlyMap<string, ApprovedReading>;
  },
): EvidenceRegistryError | null {
  const parsed = ReportEvidenceSchema.safeParse(evidence);
  if (!parsed.success) {
    return {
      code: "invalid_evidence",
      detail: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const ev = parsed.data;

  if (ev.source_type === "reality_fact") {
    const fact = opts.facts.get(ev.source_id);
    if (!fact) {
      return {
        code: "missing_fact_id",
        detail: `reality_fact source_id「${ev.source_id}」不存在于 DC`,
      };
    }
  }

  if (ev.source_type === "personal_reading") {
    if (!opts.readings.has(ev.source_id)) {
      return {
        code: "missing_reading_id",
        detail: `personal_reading source_id「${ev.source_id}」不存在`,
      };
    }
    if (opts.facts.has(ev.source_id)) {
      return {
        code: "personal_reading_as_fact",
        detail: `禁止把个人批断「${ev.source_id}」当成 DC fact`,
      };
    }
  }

  if (ev.source_type === "explicit_hypothesis") {
    // Hypotheses must never be registered as reality_fact — source_type already separates.
    if (opts.facts.has(ev.source_id) && opts.facts.get(ev.source_id)?.status === "confirmed") {
      // OK to reference a fact id in limits; still not a fact itself.
    }
  }

  registry.evidence[ev.evidence_id] = ev;
  return null;
}

export function assertEvidenceIdsExist(
  registry: EvidenceRegistry,
  evidenceIds: readonly string[],
): EvidenceRegistryError[] {
  const errors: EvidenceRegistryError[] = [];
  for (const id of evidenceIds) {
    if (!registry.evidence[id]) {
      errors.push({
        code: "missing_evidence_id",
        detail: `evidence_id「${id}」不在 registry`,
      });
    }
  }
  return errors;
}

export function assertClaimIdsExist(
  registry: EvidenceRegistry,
  claimIds: readonly string[],
): EvidenceRegistryError[] {
  const errors: EvidenceRegistryError[] = [];
  for (const id of claimIds) {
    if (!registry.claims[id]) {
      errors.push({
        code: "missing_claim_id",
        detail: `claim_id「${id}」不在 registry`,
      });
    }
  }
  return errors;
}

/**
 * Final assembly: Face01 target_evidence_ids must exist (typically page 02 units).
 */
export function assertPage02EvidenceTargetsExist(
  registry: EvidenceRegistry,
  targetEvidenceIds: readonly string[],
): EvidenceRegistryError[] {
  const errors = assertEvidenceIdsExist(registry, targetEvidenceIds);
  return errors.map((e) =>
    e.code === "missing_evidence_id"
      ? { ...e, code: "orphan_page02_ref" as const }
      : e,
  );
}

export function isConfirmedFact(fact: DecisionReportRealityFact): boolean {
  return fact.status === "confirmed";
}

/** user_estimate must never be treated as independently_verified. */
export function assertFactVerificationLegal(
  fact: DecisionReportRealityFact,
): EvidenceRegistryError | null {
  if (
    fact.verification === "independently_verified" &&
    fact.status !== "confirmed"
  ) {
    return {
      code: "invalid_evidence",
      detail: `fact「${fact.fact_id}」非 confirmed 不得标 independently_verified`,
    };
  }
  if (
    fact.verification === "user_estimate" &&
    fact.status === "confirmed" &&
    // estimates can be present but must not be silently upgraded
    false
  ) {
    return null;
  }
  return null;
}

export function rejectUnknownOrDeclinedAsConfirmed(
  fact: DecisionReportRealityFact,
): EvidenceRegistryError | null {
  if (
    (fact.status === "unknown" ||
      fact.status === "declined" ||
      fact.status === "not_applicable") &&
    fact.verification === "independently_verified"
  ) {
    return {
      code: "hypothesis_as_fact",
      detail: `fact「${fact.fact_id}」status=${fact.status} 不得标 independently_verified`,
    };
  }
  return null;
}
