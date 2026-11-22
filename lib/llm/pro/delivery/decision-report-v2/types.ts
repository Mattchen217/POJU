/**
 * Decision Report V2 — shared evidence / claim / segment contracts.
 * Product SoT: `.cursor/docs/decision-report/内容规格-SoT-2026-10-27.md`
 *
 * Body and evidence are separate structured layers. Markdown label splitting
 * is not the authority for new reports.
 */

import type {
  FactStatus,
  VerificationLevel,
} from "@/lib/poju/decision-context/types";

/** Internal page ids (03 retained as glossary appendix meta id). */
export type DecisionReportPageId =
  | "01"
  | "02"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08";

export type DecisionReportLocale = "zh" | "en" | "es" | "fr" | "de";

export type ReportClaimType =
  | "recommendation"
  | "personal_interpretation"
  | "reality_analysis"
  | "risk"
  | "condition"
  | "action"
  | "hypothesis";

export type EvidenceRequirement = "required" | "optional" | "not_required";

export type ReportEvidenceSourceType =
  | "personal_reading"
  | "reality_fact"
  | "reality_mechanism"
  | "explicit_hypothesis";

export type ReportClaim = {
  claim_id: string;
  page_id: DecisionReportPageId;
  segment_id: string;
  body_text: string;
  claim_type: ReportClaimType;
  evidence_ids: string[];
  evidence_requirement: EvidenceRequirement;
  limitation?: string;
};

export type ReportEvidence = {
  evidence_id: string;
  source_type: ReportEvidenceSourceType;
  /** reading_id | fact_id | mechanism_id | hypothesis_id */
  source_id: string;
  term_ids: string[];
  explanation: string;
  supports_claim_ids: string[];
  limits_claim_ids: string[];
  verification_status?: string;
};

export type ReportSegmentBody = {
  text: string;
  claim_ids: string[];
};

export type ReportSegmentEvidence = {
  items: ReportEvidence[];
};

export type ReportSegment = {
  segment_id: string;
  heading: string;
  body: ReportSegmentBody;
  /** null = no evidence fold for this segment */
  evidence: ReportSegmentEvidence | null;
};

export type DecisionReportRealityFact = {
  fact_id: string;
  content: string;
  status: FactStatus;
  verification: VerificationLevel;
  source_reference?: string;
};

export type PersonalAnalysisAnchor = {
  anchor_id: string;
  source_domain: string;
  source_reference: string;
  term_id?: string;
  internal_anchor: unknown;
  approved_interpretation: string;
  availability_status: string;
};

export type ApprovedReading = {
  reading_id: string;
  anchor_ids: string[];
  term_ids: string[];
  interpretation: string;
  scope: string;
  confidence_status: string;
};

export type TermAllowlistEntry = {
  term_id: string;
  soft_label: string;
  definition: string;
  related_reading_ids: string[];
};

export type DecisionReportInput = {
  report_id: string;
  locale: DecisionReportLocale;
  decision: {
    question: string;
    desired_outcome: string;
    decision_definition: unknown;
    decision_constraints: unknown;
  };
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
};

export type EvidenceRegistry = {
  claims: Record<string, ReportClaim>;
  evidence: Record<string, ReportEvidence>;
};

export type GlossaryAppendixTerm = {
  term_id: string;
  soft_label: string;
  definition: string;
};

export type GlossaryAppendix = {
  page: "03";
  face: "03";
  kind: "glossary_appendix";
  page_title: string;
  page_subtitle: string;
  reading_note: string;
  terms: GlossaryAppendixTerm[];
};

export type ConditionStatus =
  | "satisfied"
  | "unconfirmed"
  | "conflicted"
  | "not_applicable";
