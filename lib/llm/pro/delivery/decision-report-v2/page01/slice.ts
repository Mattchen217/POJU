/**
 * Page 01 feed slice — only what Face01 needs.
 * Never dump full chat, full ProfileStructured, full DC, or full glossary.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { DecisionReportInputSchema } from "../schemas";
import type {
  ApprovedReading,
  DecisionReportInput,
  DecisionReportLocale,
  DecisionReportRealityFact,
  EvidenceRegistry,
  PersonalAnalysisAnchor,
  ReportClaim,
} from "../types";
import { normalizeReportLocale } from "../body-compliance";

/** Page01-only fact row: DC fact + selection metadata (does not mutate DC). */
export type Page01SliceFact = DecisionReportRealityFact & {
  /** Structured relevance to this decision — never upgrades status/verification. */
  selection_kind: "linked" | "candidate";
  selection_reasons?: string[];
};

export type Page01FeedSlice = {
  report_id: string;
  locale: DecisionReportLocale;
  decision: DecisionReportInput["decision"];
  reality_context: {
    facts: Page01SliceFact[];
    conflicts: unknown[];
    hypotheses: unknown[];
  };
  personal_analysis: {
    profile_version: string;
    /** Legacy single stamp. */
    available_domains: string[];
    /** Per-domain version map (bazi/ziwei hashes). */
    domain_versions?: { bazi?: string; ziwei?: string };
    relevant_anchors: PersonalAnalysisAnchor[];
    approved_readings: ApprovedReading[];
  };
  report_analysis: {
    decision_synthesis: unknown;
    candidate_paths: unknown[];
    key_claims: ReportClaim[];
    unresolved_issues: unknown[];
  };
  evidence_registry: {
    claim_ids: string[];
    evidence: Array<{
      evidence_id: string;
      source_type: string;
      source_id: string;
      supports_claim_ids: string[];
      limits_claim_ids: string[];
      explanation: string;
      term_ids: string[];
      verification_status?: string;
    }>;
  };
};

function mapDcFacts(dc: DecisionContext): DecisionReportRealityFact[] {
  return (dc.reality_facts ?? []).map((f) => ({
    fact_id: f.fact_id,
    content: f.statement,
    status: f.status,
    verification: f.verification_level,
    source_reference: f.source_turn_id ?? undefined,
  }));
}

/**
 * Project DC → report reality facts without upgrading status/verification.
 */
export function realityFactsFromDecisionContext(
  dc: DecisionContext,
): DecisionReportRealityFact[] {
  return mapDcFacts(dc);
}

/**
 * Build DecisionReportInput from DC + precomputed personal/report analysis.
 * Rejects inventing readings or upgrading estimates.
 */
export function buildDecisionReportInput(input: {
  report_id: string;
  locale: string;
  dc: DecisionContext;
  personal_analysis: DecisionReportInput["personal_analysis"];
  report_analysis: DecisionReportInput["report_analysis"];
}): DecisionReportInput {
  const locale = normalizeReportLocale(input.locale);
  const question =
    input.dc.definition?.decision_question?.trim() ||
    input.dc.definition?.concrete_event?.trim() ||
    "";
  const desired =
    input.dc.definition?.desired_outcome?.trim() ||
    "";

  const payload: DecisionReportInput = {
    report_id: input.report_id,
    locale,
    decision: {
      question: question || "（未提供决策问题）",
      desired_outcome: desired,
      decision_definition: input.dc.definition ?? null,
      decision_constraints: input.dc.constraints ?? [],
    },
    reality_context: {
      facts: mapDcFacts(input.dc),
      conflicts: input.dc.conflicts ?? [],
      hypotheses: input.dc.hypotheses ?? [],
    },
    personal_analysis: input.personal_analysis,
    report_analysis: input.report_analysis,
  };

  return DecisionReportInputSchema.parse(payload);
}

/**
 * Slice report input for Face 01 only.
 * Drops irrelevant personal domains not referenced by approved readings / key claims.
 */
export function sliceForPage01(input: {
  report: DecisionReportInput;
  registry: EvidenceRegistry;
  /** Optional: only keep these fact ids (topic filter). Empty = keep all non-invented. */
  relevantFactIds?: ReadonlySet<string>;
  relevantReadingIds?: ReadonlySet<string>;
  /**
   * Per-fact selection metadata from fact-relevance (linked|candidate).
   * Required for model-visible classification; defaults to candidate if missing.
   */
  factSelectionById?: ReadonlyMap<
    string,
    { kind: "linked" | "candidate"; reasons: string[] }
  >;
  domain_versions?: { bazi?: string; ziwei?: string };
}): Page01FeedSlice {
  const { report, registry } = input;

  const facts: Page01SliceFact[] = report.reality_context.facts
    .filter((f) => {
      if (input.relevantFactIds && input.relevantFactIds.size > 0) {
        return input.relevantFactIds.has(f.fact_id);
      }
      return true;
    })
    .map((f) => {
      const meta = input.factSelectionById?.get(f.fact_id);
      return {
        ...f,
        selection_kind: meta?.kind ?? "candidate",
        selection_reasons: meta?.reasons ?? ["unspecified"],
      };
    });

  const readings = report.personal_analysis.approved_readings.filter((r) => {
    if (input.relevantReadingIds && input.relevantReadingIds.size > 0) {
      return input.relevantReadingIds.has(r.reading_id);
    }
    return true;
  });

  const readingIdSet = new Set(readings.map((r) => r.reading_id));
  const anchors = report.personal_analysis.relevant_anchors.filter((a) => {
    // Keep anchors cited by remaining readings' anchor_ids, or all if no filter.
    if (!input.relevantReadingIds || input.relevantReadingIds.size === 0) {
      return true;
    }
    return readings.some((r) => r.anchor_ids.includes(a.anchor_id));
  });

  const keyClaims = (report.report_analysis.key_claims ?? []).filter((c) => {
    // Only claims that cite remaining evidence or are in registry.
    if (!c.evidence_ids?.length) return registry.claims[c.claim_id] != null;
    return c.evidence_ids.some((id) => registry.evidence[id] != null);
  });
  const claimIdSet = new Set([
    ...Object.keys(registry.claims),
    ...keyClaims.map((c) => c.claim_id),
  ]);
  const claimIds = [...claimIdSet];

  // Evidence: reality facts + readings still in slice; mechanism/planned keep if registry-present
  // (caller must already trim irrelevant registry entries — do not dump full book).
  const factIdSet = new Set(facts.map((f) => f.fact_id));
  const evidence = Object.values(registry.evidence)
    .filter((e) => {
      if (e.source_type === "reality_fact") {
        return factIdSet.has(e.source_id);
      }
      if (e.source_type === "personal_reading") {
        return readingIdSet.has(e.source_id);
      }
      return (
        e.supports_claim_ids.some((id) => claimIdSet.has(id)) ||
        e.limits_claim_ids.some((id) => claimIdSet.has(id)) ||
        e.source_type === "reality_mechanism"
      );
    })
    .map((e) => ({
      evidence_id: e.evidence_id,
      source_type: e.source_type,
      source_id: e.source_id,
      supports_claim_ids: e.supports_claim_ids,
      limits_claim_ids: e.limits_claim_ids,
      explanation: e.explanation,
      term_ids: e.term_ids,
      verification_status: e.verification_status,
    }));

  // Conflicts/hypotheses: only unresolved / decision-bound (cap), not whole DC dump.
  const conflicts = (report.reality_context.conflicts ?? []).slice(0, 6);
  const hypotheses = (report.reality_context.hypotheses ?? []).slice(0, 6);

  return {
    report_id: report.report_id,
    locale: report.locale,
    decision: report.decision,
    reality_context: {
      facts,
      conflicts,
      hypotheses,
    },
    personal_analysis: {
      profile_version: report.personal_analysis.profile_version,
      available_domains: report.personal_analysis.available_domains,
      ...(input.domain_versions
        ? { domain_versions: input.domain_versions }
        : {}),
      relevant_anchors: anchors,
      approved_readings: readings,
    },
    report_analysis: {
      decision_synthesis: report.report_analysis.decision_synthesis,
      candidate_paths: (report.report_analysis.candidate_paths ?? []).slice(
        0,
        4,
      ),
      key_claims: keyClaims.slice(0, 8),
      unresolved_issues: (report.report_analysis.unresolved_issues ?? []).slice(
        0,
        6,
      ),
    },
    evidence_registry: {
      claim_ids: claimIds.slice(0, 12),
      evidence,
    },
  };
}

/**
 * Hard limits for Page 01 model context.
 * Oversized = fail closed (do not send to model).
 */
export const PAGE01_SLICE_LIMITS = {
  facts: 16,
  readings: 16,
  anchors: 20,
  evidence: 32,
  claims: 12,
} as const;

/** Detect whether a slice exceeds safe Page 01 feed limits. */
export function page01SliceLooksOversized(slice: Page01FeedSlice): string[] {
  const hits: string[] = [];
  if (slice.reality_context.facts.length > PAGE01_SLICE_LIMITS.facts) {
    hits.push("too_many_facts");
  }
  if (
    slice.personal_analysis.approved_readings.length >
    PAGE01_SLICE_LIMITS.readings
  ) {
    hits.push("too_many_readings");
  }
  if (
    slice.personal_analysis.relevant_anchors.length > PAGE01_SLICE_LIMITS.anchors
  ) {
    hits.push("too_many_anchors");
  }
  if (
    slice.evidence_registry.evidence.length > PAGE01_SLICE_LIMITS.evidence
  ) {
    hits.push("too_many_evidence");
  }
  if (slice.evidence_registry.claim_ids.length > PAGE01_SLICE_LIMITS.claims) {
    hits.push("too_many_claims");
  }
  return hits;
}
