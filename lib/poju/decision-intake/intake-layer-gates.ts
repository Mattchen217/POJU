/**
 * Report-driven intake layer gates.
 * Code derives problem / desired-outcome sufficiency from DC authority.
 * Model assessments are proposals only — never sole advancement authority.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { dirIntakeAnswerCoverage } from "./intake-answer-coverage";
import {
  intakeLayerForDir,
  type IntakeLayerFocus,
} from "./investigation-report-map";
import type { ReportCoverageSnapshot } from "./report-section-coverage";

export type IntakeGateVerdict = {
  passed: boolean;
  reasons: string[];
  supporting_fact_ids: string[];
  missing_dir_ids: string[];
  critical_ambiguities: string[];
};

export type IntakeLayerGateSnapshot = {
  problem_understanding: IntakeGateVerdict;
  desired_outcome: IntakeGateVerdict;
  current_intake_layer: IntakeLayerFocus;
};

const PROBLEM_CORE_DIRS = ["DIR-DEF-QUESTION", "DIR-STATUS-QUO"] as const;
const DESIRED_CORE_DIRS = ["DIR-DEF-OUTCOME"] as const;
/** Soft expectation dirs — only block when present on DC and still open. */
const DESIRED_SOFT_DIRS = [
  "DIR-DEF-PRIORITIES",
  "DIR-DEF-UNACCEPTABLE",
  "DIR-DEF-STAKES",
] as const;

function factsForDir(dc: DecisionContext, dirId: string): string[] {
  return dc.reality_facts
    .filter((f) => (f.related_dir_ids ?? []).includes(dirId))
    .map((f) => f.fact_id);
}

function dirResolved(
  dc: DecisionContext,
  dirId: string,
): { resolved: boolean; fact_ids: string[]; state: string | null } {
  const dir = dc.dirs.find((d) => d.dir_id === dirId);
  if (!dir || dir.id_lifecycle !== "active") {
    return { resolved: true, fact_ids: [], state: "inactive" };
  }
  if (dir.current_state === "known" || dir.current_state === "n_a") {
    return {
      resolved: true,
      fact_ids: factsForDir(dc, dirId),
      state: dir.current_state,
    };
  }
  const coverage = dirIntakeAnswerCoverage(dc, dir);
  if (coverage.answered) {
    return {
      resolved: true,
      fact_ids: coverage.fact_ids,
      state: coverage.information_boundary ? "boundary" : "answered",
    };
  }
  return {
    resolved: false,
    fact_ids: factsForDir(dc, dirId),
    state: dir.current_state,
  };
}

function questionText(dc: DecisionContext): string {
  return (dc.definition.decision_question ?? "").trim();
}

function desiredText(dc: DecisionContext): string {
  return (dc.definition.desired_outcome ?? "").trim();
}

/**
 * Problem Understanding Gate — decision-type adaptive, not a full-field checklist.
 * Requires a concrete decision question; status quo only when it would change
 * the problem definition and is still open on DC.
 */
export function evaluateProblemUnderstandingGate(
  dc: DecisionContext,
): IntakeGateVerdict {
  const reasons: string[] = [];
  const supporting_fact_ids: string[] = [];
  const missing_dir_ids: string[] = [];
  const critical_ambiguities: string[] = [];

  const q = questionText(dc);
  const questionDir = dirResolved(dc, "DIR-DEF-QUESTION");
  const statusDir = dirResolved(dc, "DIR-STATUS-QUO");

  if (q.length < 8 && !questionDir.resolved) {
    missing_dir_ids.push("DIR-DEF-QUESTION");
    critical_ambiguities.push("decision_question_unclear");
    reasons.push("decision_question_insufficient");
  } else if (!questionDir.resolved && q.length < 24) {
    // Short opener without DIR resolution — still need clarification.
    missing_dir_ids.push("DIR-DEF-QUESTION");
    critical_ambiguities.push("decision_question_needs_grounding");
    reasons.push("decision_question_not_grounded");
  } else {
    supporting_fact_ids.push(...questionDir.fact_ids);
    reasons.push("decision_question_grounded");
  }

  // Status quo: require only when the DIR is active/open and no situational facts exist.
  const statusFacts = dc.reality_facts.filter(
    (f) =>
      (f.related_dir_ids ?? []).includes("DIR-STATUS-QUO") ||
      (f.fact_roles ?? []).includes("status_quo"),
  );
  const statusOnDc = dc.dirs.some(
    (d) => d.dir_id === "DIR-STATUS-QUO" && d.id_lifecycle === "active",
  );
  if (statusOnDc && !statusDir.resolved && statusFacts.length === 0) {
    missing_dir_ids.push("DIR-STATUS-QUO");
    critical_ambiguities.push("situation_boundary_unknown");
    reasons.push("status_quo_needed_for_problem_definition");
  } else if (statusOnDc) {
    supporting_fact_ids.push(...statusDir.fact_ids, ...statusFacts.map((f) => f.fact_id));
    reasons.push("status_quo_sufficient_or_bounded");
  }

  // Open conflicts touching problem DIRs (via fact → DIR links) block the gate.
  const problemConflicts = dc.conflicts.filter((c) => {
    if (c.state !== "open") return false;
    return c.fact_ids.some((fid) => {
      const fact = dc.reality_facts.find((f) => f.fact_id === fid);
      return (fact?.related_dir_ids ?? []).some((id) =>
        (PROBLEM_CORE_DIRS as readonly string[]).includes(id),
      );
    });
  });
  if (problemConflicts.length > 0) {
    critical_ambiguities.push("open_problem_conflict");
    reasons.push("open_problem_conflict");
  }

  const passed =
    missing_dir_ids.length === 0 &&
    !critical_ambiguities.includes("open_problem_conflict") &&
    !critical_ambiguities.includes("decision_question_unclear") &&
    !critical_ambiguities.includes("decision_question_needs_grounding");

  return {
    passed,
    reasons,
    supporting_fact_ids: [...new Set(supporting_fact_ids)],
    missing_dir_ids: [...new Set(missing_dir_ids)],
    critical_ambiguities,
  };
}

/**
 * Desired Outcome Gate — only meaningful after problem gate passes.
 * Core: desired outcome must be concrete enough to evaluate report recommendations.
 */
export function evaluateDesiredOutcomeGate(dc: DecisionContext): IntakeGateVerdict {
  const reasons: string[] = [];
  const supporting_fact_ids: string[] = [];
  const missing_dir_ids: string[] = [];
  const critical_ambiguities: string[] = [];

  const outcomeText = desiredText(dc);
  const outcomeDir = dirResolved(dc, "DIR-DEF-OUTCOME");
  const outcomeFacts = dc.reality_facts.filter(
    (f) =>
      (f.related_dir_ids ?? []).includes("DIR-DEF-OUTCOME") ||
      (f.fact_roles ?? []).includes("desired_outcome"),
  );

  if (!outcomeDir.resolved && outcomeText.length < 4 && outcomeFacts.length === 0) {
    missing_dir_ids.push("DIR-DEF-OUTCOME");
    critical_ambiguities.push("desired_outcome_unclear");
    reasons.push("desired_outcome_missing");
  } else {
    supporting_fact_ids.push(...outcomeDir.fact_ids, ...outcomeFacts.map((f) => f.fact_id));
    reasons.push("desired_outcome_grounded");
  }

  // Soft dirs: if active and completely unanswered with no facts, mark as soft miss
  // but do not hard-fail when outcome itself is grounded (avoid questionnaire fill).
  for (const dirId of DESIRED_SOFT_DIRS) {
    const soft = dirResolved(dc, dirId);
    if (soft.state === "inactive") continue;
    if (!soft.resolved && soft.fact_ids.length === 0) {
      reasons.push(`soft_expectation_open:${dirId}`);
    } else {
      supporting_fact_ids.push(...soft.fact_ids);
    }
  }

  const outcomeConflicts = dc.conflicts.filter((c) => {
    if (c.state !== "open") return false;
    return c.fact_ids.some((fid) => {
      const fact = dc.reality_facts.find((f) => f.fact_id === fid);
      return (fact?.related_dir_ids ?? []).some((id) =>
        (DESIRED_CORE_DIRS as readonly string[]).includes(id),
      );
    });
  });
  if (outcomeConflicts.length > 0) {
    critical_ambiguities.push("open_desired_conflict");
    reasons.push("open_desired_conflict");
  }

  const passed =
    missing_dir_ids.length === 0 &&
    !critical_ambiguities.includes("desired_outcome_unclear") &&
    !critical_ambiguities.includes("open_desired_conflict");

  return {
    passed,
    reasons,
    supporting_fact_ids: [...new Set(supporting_fact_ids)],
    missing_dir_ids: [...new Set(missing_dir_ids)],
    critical_ambiguities,
  };
}

export function deriveIntakeLayerFocus(input: {
  dc: DecisionContext;
  problem: IntakeGateVerdict;
  desired: IntakeGateVerdict;
  report_coverage: ReportCoverageSnapshot;
  /** New evidence invalidated prior problem grounding. */
  reopen_problem?: boolean;
  reopen_desired?: boolean;
}): IntakeLayerFocus {
  if (input.reopen_problem || !input.problem.passed) {
    return "problem_understanding";
  }
  if (input.reopen_desired || !input.desired.passed) {
    return "desired_outcome";
  }
  if (input.report_coverage.delivery_ready) {
    return "final_understanding_review";
  }
  return "report_details";
}

export function buildIntakeLayerGateSnapshot(input: {
  dc: DecisionContext;
  report_coverage: ReportCoverageSnapshot;
  previous_layer?: IntakeLayerFocus | null;
}): IntakeLayerGateSnapshot {
  const problem = evaluateProblemUnderstandingGate(input.dc);
  const desired = evaluateDesiredOutcomeGate(input.dc);

  // Re-open only when previously past a layer but new conflicts/ambiguities appear.
  const reopen_problem =
    input.previous_layer != null &&
    input.previous_layer !== "problem_understanding" &&
    !problem.passed;
  const reopen_desired =
    !reopen_problem &&
    input.previous_layer != null &&
    (input.previous_layer === "report_details" ||
      input.previous_layer === "final_understanding_review") &&
    !desired.passed;

  const current_intake_layer = deriveIntakeLayerFocus({
    dc: input.dc,
    problem,
    desired,
    report_coverage: input.report_coverage,
    reopen_problem,
    reopen_desired,
  });

  return {
    problem_understanding: problem,
    desired_outcome: desired,
    current_intake_layer,
  };
}

/** Validate model-proposed layer against code gate authority. */
export function validateModelIntakeLayer(
  proposed: string | null | undefined,
  codeLayer: IntakeLayerFocus,
): { ok: true; layer: IntakeLayerFocus } | { ok: false; reason: string } {
  if (!proposed) return { ok: true, layer: codeLayer };
  const allowed: IntakeLayerFocus[] = [
    "problem_understanding",
    "desired_outcome",
    "report_details",
    "final_understanding_review",
  ];
  if (!allowed.includes(proposed as IntakeLayerFocus)) {
    return { ok: false, reason: "illegal_intake_layer" };
  }
  // Model may not skip ahead of code gates.
  const order: IntakeLayerFocus[] = [
    "problem_understanding",
    "desired_outcome",
    "report_details",
    "final_understanding_review",
  ];
  if (order.indexOf(proposed as IntakeLayerFocus) > order.indexOf(codeLayer)) {
    return { ok: false, reason: "intake_layer_ahead_of_gates" };
  }
  return { ok: true, layer: codeLayer };
}

export function dirBelongsToCurrentLayer(
  dirId: string,
  layer: IntakeLayerFocus,
): boolean {
  const mapped = intakeLayerForDir(dirId);
  if (!mapped) return false;
  if (layer === "final_understanding_review") return false;
  if (layer === "report_details") {
    return mapped === "report_details" || mapped === "desired_outcome";
  }
  return mapped === layer;
}
