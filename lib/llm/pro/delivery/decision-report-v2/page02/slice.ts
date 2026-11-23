/**
 * Page 02 feed slice — why this judgment fits you.
 * Only Face02-relevant personal units + DC facts; never dump full packs.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type {
  ApprovedReading,
  DecisionReportInput,
  EvidenceRegistry,
  PersonalAnalysisAnchor,
  ReportClaim,
} from "../types";
import {
  buildDecisionReportInput,
  sliceForPage01,
  type Page01FeedSlice,
  type Page01SliceFact,
} from "../page01/slice";

export type Page02SliceFact = Page01SliceFact;

export type Page02FeedSlice = Page01FeedSlice & {
  /** Page01 judgment context for explanation alignment — not an evidence source. */
  page01_judgment_context: {
    core_judgment_text: string | null;
    why_paths: string[];
  };
};

export type { Page01FeedSlice };

export function sliceForPage02(input: {
  report: DecisionReportInput;
  registry: EvidenceRegistry;
  relevantFactIds?: ReadonlySet<string>;
  relevantReadingIds?: ReadonlySet<string>;
  factSelectionById?: ReadonlyMap<
    string,
    { kind: "linked" | "candidate"; reasons: string[] }
  >;
  domain_versions?: { bazi?: string; ziwei?: string };
  page01_judgment_context?: {
    core_judgment_text: string | null;
    why_paths: string[];
  };
}): Page02FeedSlice {
  const base = sliceForPage01(input);
  return {
    ...base,
    page01_judgment_context: input.page01_judgment_context ?? {
      core_judgment_text: null,
      why_paths: [],
    },
  };
}

export const PAGE02_SLICE_LIMITS = {
  facts: 16,
  readings: 16,
  anchors: 20,
  evidence: 32,
  claims: 12,
} as const;

export function page02SliceLooksOversized(slice: Page02FeedSlice): string[] {
  const hits: string[] = [];
  if (slice.reality_context.facts.length > PAGE02_SLICE_LIMITS.facts) {
    hits.push("too_many_facts");
  }
  if (
    slice.personal_analysis.approved_readings.length >
    PAGE02_SLICE_LIMITS.readings
  ) {
    hits.push("too_many_readings");
  }
  if (
    slice.personal_analysis.relevant_anchors.length > PAGE02_SLICE_LIMITS.anchors
  ) {
    hits.push("too_many_anchors");
  }
  if (
    slice.evidence_registry.evidence.length > PAGE02_SLICE_LIMITS.evidence
  ) {
    hits.push("too_many_evidence");
  }
  if (slice.evidence_registry.claim_ids.length > PAGE02_SLICE_LIMITS.claims) {
    hits.push("too_many_claims");
  }
  return hits;
}

export function buildDecisionReportInputForPage02(input: {
  report_id: string;
  locale: string;
  dc: DecisionContext;
  personal_analysis: DecisionReportInput["personal_analysis"];
  report_analysis: DecisionReportInput["report_analysis"];
}): DecisionReportInput {
  return buildDecisionReportInput(input);
}

export type {
  ApprovedReading,
  PersonalAnalysisAnchor,
  ReportClaim,
};
