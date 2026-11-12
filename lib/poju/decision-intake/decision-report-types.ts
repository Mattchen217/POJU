/**
 * M3 — Decision Intake 2.0 Personal Analysis + Freeze-bound eight-page report.
 * Shared (client + server) types and identity helpers. No IO here.
 *
 * Authority: the frozen DecisionContext snapshot is the only fact source.
 * Personal Analysis and page records are derived artifacts bound to one Freeze.
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";

export const DI2_REPORT_SCHEMA_VERSION = "di2-eight-page-v1" as const;
export const PERSONAL_ANALYSIS_SCHEMA_VERSION = "di2-personal-analysis-v1" as const;
export const DI2_REPORT_SOURCE = "decision_intake_v2" as const;

/** Reading order: 07 only when topic applies; 03 appendix always last. */
export const DI2_READING_ORDER: readonly DecisionPageId[] = [
  "01",
  "02",
  "04",
  "05",
  "06",
  "07",
  "08",
  "03",
] as const;

/**
 * Page dependency waves. One model wave per invoke; later waves read earlier pages.
 * 03 is assembled deterministically from the chart lines every other page cited,
 * so it closes the chain.
 */
export const DI2_PAGE_WAVES: readonly (readonly DecisionPageId[])[] = [
  ["02", "04", "05", "07"],
  ["01", "06"],
  ["08"],
  ["03"],
] as const;

export const DI2_PAGE_UPSTREAM: Readonly<Partial<Record<DecisionPageId, readonly DecisionPageId[]>>> = {
  "01": ["02", "05"],
  "06": ["05"],
  "08": ["05", "06"],
};

/** Production 1+1 cap for model quality / transport failures per unit. */
export const DI2_MAX_UNIT_ATTEMPTS = 2;

/** How an analysis claim relates to the frozen facts. Never upgraded by code or model. */
export type EpistemicClass =
  | "confirmed_fact"
  | "user_stated_unverified"
  | "user_estimate"
  | "analysis_hypothesis"
  | "pattern_judgment";

export const EPISTEMIC_CLASSES: readonly EpistemicClass[] = [
  "confirmed_fact",
  "user_stated_unverified",
  "user_estimate",
  "analysis_hypothesis",
  "pattern_judgment",
] as const;

/** Deterministic status of one referenced source item (computed from DC / chart, never by model). */
export type EvidenceRefKind =
  | "definition"
  | "reality_fact"
  | "constraint"
  | "hypothesis"
  | "dir"
  | "conflict"
  | "information_boundary"
  | "chart_line"
  | "ziwei_line"
  | "analysis_item";

export type EvidenceRefStatus =
  | "confirmed_fact"
  | "user_stated_unverified"
  | "user_estimate"
  | "unknown_or_declined"
  | "constraint_confirmed"
  | "constraint_unverified"
  | "hypothesis"
  | "dir_known"
  | "dir_unknown"
  | "dir_conflict"
  | "dir_not_applicable"
  | "conflict_open"
  | "conflict_clarified"
  | "boundary"
  | "decision_definition"
  | "local_calculation"
  | "personal_analysis";

export type EvidenceReference = {
  ref_id: string;
  kind: EvidenceRefKind;
  status: EvidenceRefStatus;
  excerpt: string;
};

export type PersonalAnalysisItem = {
  item_id: string;
  /** User-visible plain language. */
  text: string;
  /** Basis layer — traditional reasoning chain; may carry closed-set terms. */
  traditional_basis: string;
  /** Optional auxiliary modern explanation. Never a validation of the traditional basis. */
  science_note: string | null;
  basis_class: EpistemicClass;
  evidence_refs: string[];
};

export type PersonalAnalysisArtifact = {
  /** Deterministic from frozen DC definition + Blueprint (not model-written). */
  decision_target: {
    decision_question: string | null;
    concrete_event: string | null;
    desired_outcome: string | null;
    stakes: string | null;
    goal_priorities: string[];
    unacceptable_outcomes: string[];
  };
  personal_pattern_analysis: PersonalAnalysisItem[];
  personal_strengths: PersonalAnalysisItem[];
  personal_risks: PersonalAnalysisItem[];
  decision_tendencies: PersonalAnalysisItem[];
  constraint_interaction: PersonalAnalysisItem[];
  decision_path_implications: PersonalAnalysisItem[];
  unresolved_conditions: PersonalAnalysisItem[];
  /** Deterministic: every ref cited above, with its frozen status. */
  evidence_references: EvidenceReference[];
  confidence_and_limits: {
    overall_confidence: "low" | "medium" | "high";
    limits: string[];
    /** Deterministic from DC (boundaries + unknown DIRs + unresolved conflicts). */
    information_boundaries: string[];
  };
};

export type PersonalAnalysisSectionKey = Exclude<
  keyof PersonalAnalysisArtifact,
  "decision_target" | "evidence_references" | "confidence_and_limits"
>;

export const PERSONAL_ANALYSIS_SECTIONS: readonly PersonalAnalysisSectionKey[] = [
  "personal_pattern_analysis",
  "personal_strengths",
  "personal_risks",
  "decision_tendencies",
  "constraint_interaction",
  "decision_path_implications",
  "unresolved_conditions",
] as const;

export type PersonalAnalysisStatus = "pending" | "running" | "completed" | "failed";

export type PersonalAnalysisRecord = {
  analysis_id: string;
  idempotency_key: string;
  session_id: string;
  freeze_id: string;
  context_id: string;
  context_version: number;
  context_hash: string;
  profile_id: string | null;
  profile_hash: string;
  analysis_schema_version: string;
  status: PersonalAnalysisStatus;
  attempts: number;
  generated_at: string | null;
  updated_at: string;
  analysis_result: PersonalAnalysisArtifact | null;
  error: string | null;
  retryable: boolean;
  model?: string | null;
  tokens_used?: number;
};

export type DecisionReportPageApplicability = "applies" | "not_applicable";

export type DecisionReportPageRecord = {
  page_id: DecisionPageId;
  status: "pending" | "completed" | "failed";
  applicability: DecisionReportPageApplicability;
  /** Rendered user-facing markdown (body + basis fold). Never a DC JSON dump. */
  content_markdown: string;
  /** Structured page payload after validation (for audit / re-render). */
  structured: Record<string, unknown> | null;
  job_id: string;
  execution_generation: number;
  freeze_id: string;
  context_hash: string;
  report_schema_version: string;
  analysis_id: string;
  attempts: number;
  generated_at: string | null;
  error: string | null;
};

export type DecisionReportJobInput = {
  kind: "decision_intake_report";
  session_id: string;
  locale: string;
  freeze_id: string;
  context_id: string;
  context_version: number;
  context_hash: string;
  report_schema_version: string;
  analysis_schema_version: string;
  profile_id: string | null;
  profile_hash: string;
  /** M4 — server Freeze receipt this job was started from (re-verified every stage). */
  freeze_receipt_id: string;
  frozen_at: string;
  /** M4 — server profile receipt (recomputed at frozen_at under this schema). */
  profile_receipt_id: string;
  profile_calculation_schema_version: string;
  analysis_key: string;
  /** Session-side FreezeBoundReportJob id this execution fills. */
  report_job_id: string;
  page07_applies: boolean;
  page07_topic: string | null;
  regenerate: boolean;
};

export type DecisionReportJobResult = {
  kind: "decision_intake_report";
  report_job_id: string;
  analysis_id: string;
  freeze_id: string;
  context_hash: string;
  report_schema_version: string;
  execution_generation: number;
  page_ids: DecisionPageId[];
  full_text: string;
  model: string;
  tokens_used: number;
  completed_at: string;
};

export function personalAnalysisIdempotencyKey(input: {
  session_id: string;
  freeze_id: string;
  context_hash: string;
  profile_hash: string;
  analysis_schema_version?: string;
}): string {
  return [
    input.session_id,
    input.freeze_id,
    input.context_hash,
    input.profile_hash,
    input.analysis_schema_version ?? PERSONAL_ANALYSIS_SCHEMA_VERSION,
  ].join("|");
}

/** Session-side report job id: one per Freeze × profile × schema × execution generation. */
export function di2ReportJobId(input: {
  session_id: string;
  freeze_id: string;
  profile_hash: string;
  execution_generation: number;
  report_schema_version?: string;
}): string {
  const raw = [
    "di2_report",
    input.session_id,
    input.freeze_id,
    input.profile_hash.slice(0, 16),
    input.report_schema_version ?? DI2_REPORT_SCHEMA_VERSION,
    `g${input.execution_generation}`,
  ].join(":");
  return raw.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

export function isDecisionReportJobInput(input: unknown): input is DecisionReportJobInput {
  return (
    Boolean(input) &&
    typeof input === "object" &&
    (input as { kind?: unknown }).kind === "decision_intake_report"
  );
}

export function isDecisionReportJobResult(result: unknown): result is DecisionReportJobResult {
  return (
    Boolean(result) &&
    typeof result === "object" &&
    (result as { kind?: unknown }).kind === "decision_intake_report" &&
    typeof (result as DecisionReportJobResult).full_text === "string"
  );
}

/** Status payload returned by /api/poju/decision-report (status / start / continue). */
export type DecisionReportStatusPayload = {
  ok: boolean;
  job_id: string | null;
  session_id: string;
  status: "pending" | "running" | "completed" | "failed" | "missing";
  current_stage: string | null;
  execution_generation: number | null;
  freeze_id: string | null;
  context_hash: string | null;
  report_job_id: string | null;
  profile_hash: string | null;
  analysis: {
    status: PersonalAnalysisStatus | "missing";
    analysis_id: string | null;
    attempts: number;
    error: string | null;
    record: PersonalAnalysisRecord | null;
  };
  pages: DecisionReportPageRecord[];
  result: DecisionReportJobResult | null;
  retryable: boolean;
  failure_reason: string | null;
  error: string | null;
  /** M5 — pending/running only: lease held (live), hand-off in flight (dispatching), or nobody (none). */
  worker?: "live" | "dispatching" | "none" | null;
};
