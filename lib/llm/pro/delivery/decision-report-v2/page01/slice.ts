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

export type Page01FeedSlice = {
  report_id: string;
  locale: DecisionReportLocale;
  decision: DecisionReportInput["decision"];
  reality_context: {
    facts: DecisionReportRealityFact[];
    conflicts: unknown[];
    hypotheses: unknown[];
  };
  personal_analysis: {
    profile_version: string;
    available_domains: string[];
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
  return (dc.realityFacts ?? []).map((f) => ({
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
}): Page01FeedSlice {
  const { report, registry } = input;

  const facts = report.reality_context.facts.filter((f) => {
    if (input.relevantFactIds && input.relevantFactIds.size > 0) {
      return input.relevantFactIds.has(f.fact_id);
    }
    return true;
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

  const claimIds = Object.keys(registry.claims);
  const evidence = Object.values(registry.evidence).map((e) => ({
    evidence_id: e.evidence_id,
    source_type: e.source_type,
    source_id: e.source_id,
    supports_claim_ids: e.supports_claim_ids,
    limits_claim_ids: e.limits_claim_ids,
    explanation: e.explanation,
    term_ids: e.term_ids,
    verification_status: e.verification_status,
  }));

  // Ensure we don't leak readings that were filtered out via evidence source ids silently —
  // evidence stays; model must not invent new reading ids beyond personal_analysis.
  void readingIdSet;

  return {
    report_id: report.report_id,
    locale: report.locale,
    decision: report.decision,
    reality_context: {
      facts,
      conflicts: report.reality_context.conflicts,
      hypotheses: report.reality_context.hypotheses,
    },
    personal_analysis: {
      profile_version: report.personal_analysis.profile_version,
      available_domains: report.personal_analysis.available_domains,
      relevant_anchors: anchors,
      approved_readings: readings,
    },
    report_analysis: report.report_analysis,
    evidence_registry: {
      claim_ids: claimIds,
      evidence,
    },
  };
}

/** Detect whether a slice accidentally contains a full dump signal. */
export function page01SliceLooksOversized(slice: Page01FeedSlice): string[] {
  const warnings: string[] = [];
  if (slice.reality_context.facts.length > 40) {
    warnings.push("too_many_facts");
  }
  if (slice.personal_analysis.approved_readings.length > 20) {
    warnings.push("too_many_readings");
  }
  if (slice.personal_analysis.relevant_anchors.length > 30) {
    warnings.push("too_many_anchors");
  }
  return warnings;
}
