/**
 * Product Stage 4 — report binding + P5/P6/P8 structural acceptance helpers.
 * Does not call LLM; validates artifacts against frozen DC contracts.
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type {
  DecisionContext,
  DecisionContextBinding,
  Hypothesis,
} from "./types";
import {
  assertSnapshotMatchesBinding,
  bindingFromDecisionContext,
  DcReportBindError,
  DC_REPORT_READONLY,
} from "./read-bound";

export const STAGE4_P5_FACE = "05" as const satisfies DecisionPageId;
export const STAGE4_P6_FACE = "06" as const satisfies DecisionPageId;
export const STAGE4_P8_FACE = "08" as const satisfies DecisionPageId;

export type Stage4ReviewDecision = "continue" | "adjust" | "stop" | "rerun";

export type Stage4VerificationExperiment = {
  hypothesis: string;
  action: string;
  observe: string;
  window: string;
  success_criteria: string;
  if_fail: string;
  defer_costs: string;
};

export type Stage4ValueDimension =
  | "problem_understanding"
  | "attribution_quality"
  | "real_world_fit"
  | "choice_value"
  | "action_value"
  | "reversibility"
  | "internal_consistency"
  | "expression_quality";

export const STAGE4_VALUE_DIMENSIONS: readonly Stage4ValueDimension[] = [
  "problem_understanding",
  "attribution_quality",
  "real_world_fit",
  "choice_value",
  "action_value",
  "reversibility",
  "internal_consistency",
  "expression_quality",
] as const;

export type Stage4ReportArtifact = {
  binding: DecisionContextBinding;
  /** Immutable copy of the frozen DC used for this report. */
  context_snapshot: DecisionContext;
  faces: {
    "05"?: Record<string, unknown>;
    "06"?: Record<string, unknown>;
    "08"?: Record<string, unknown>;
  };
  generated_at?: string;
  report_id?: string;
};

export class Stage4ReportError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "Stage4ReportError";
    this.code = code;
  }
}

/** Refuse any write-back attempt against a frozen DC used for Stage 4. */
export function assertStage4ReadOnly(dc: DecisionContext): void {
  if (dc.status === "final" || dc.status === "superseded") {
    throw new DcReportBindError(
      DC_REPORT_READONLY,
      `Stage4 read-only: refusing mutate of ${dc.status} DecisionContext ${dc.context_id}@v${dc.version}`,
    );
  }
}

export function bindStage4Report(
  frozen: DecisionContext,
  faces: Stage4ReportArtifact["faces"] = {},
  meta?: { report_id?: string; generated_at?: string },
): Stage4ReportArtifact {
  if (frozen.status !== "final" && frozen.status !== "superseded") {
    throw new Stage4ReportError(
      "STAGE4_DC_NOT_FROZEN",
      `Stage4 requires frozen DC, got status=${frozen.status}`,
    );
  }
  const binding = bindingFromDecisionContext(frozen);
  assertSnapshotMatchesBinding(frozen, binding);
  return {
    binding,
    context_snapshot: frozen,
    faces,
    report_id: meta?.report_id,
    generated_at: meta?.generated_at ?? new Date().toISOString(),
  };
}

function asNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function parseVerificationExperiment(
  face06: Record<string, unknown> | null | undefined,
): Stage4VerificationExperiment | null {
  if (!face06) return null;
  const raw = face06.verification_experiment;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hypothesis = asNonEmptyString(o.hypothesis);
  const action = asNonEmptyString(o.action);
  const observe = asNonEmptyString(o.observe);
  const window = asNonEmptyString(o.window);
  const success_criteria = asNonEmptyString(o.success_criteria);
  const if_fail = asNonEmptyString(o.if_fail);
  const defer_costs = asNonEmptyString(o.defer_costs);
  if (
    !hypothesis ||
    !action ||
    !observe ||
    !window ||
    !success_criteria ||
    !if_fail ||
    !defer_costs
  ) {
    return null;
  }
  return {
    hypothesis,
    action,
    observe,
    window,
    success_criteria,
    if_fail,
    defer_costs,
  };
}

export function parseReviewDecision(
  face08: Record<string, unknown> | null | undefined,
): Stage4ReviewDecision | null {
  const v = face08?.review_decision;
  if (v === "continue" || v === "adjust" || v === "stop" || v === "rerun") {
    return v;
  }
  return null;
}

/**
 * Shared core metrics: Face 08 must reference observables that appear in Face 06 experiment.
 */
export function assertP5P6P8Consistency(artifact: Stage4ReportArtifact): void {
  const f05 = artifact.faces["05"];
  const f06 = artifact.faces["06"];
  const f08 = artifact.faces["08"];
  if (!f05 || !f06 || !f08) {
    throw new Stage4ReportError(
      "STAGE4_FACES_INCOMPLETE",
      "Stage4 acceptance requires faces 05, 06, and 08",
    );
  }

  const first = asNonEmptyString(f05.first_choice);
  const second = asNonEmptyString(f05.second_choice);
  const switchOrStop = asNonEmptyString(f05.switch_or_stop);
  if (!first || !second || !switchOrStop) {
    throw new Stage4ReportError(
      "STAGE4_P5_INCOMPLETE",
      "P5 requires first_choice, second_choice, and switch_or_stop",
    );
  }
  const conditions = asNonEmptyString(f05.recommendation_conditions);
  const dc = artifact.context_snapshot;
  const p5CriticalUnknown = dc.dirs.some(
    (d) => d.may_affect_p5_ranking && d.current_state === "unknown",
  );
  const unresolvedPreferred = dc.conflicts.some(
    (c) =>
      (c.state === "open" || c.state === "unresolved_in_final") &&
      c.affects_preferred_path !== false,
  );
  if ((p5CriticalUnknown || unresolvedPreferred) && !conditions) {
    throw new Stage4ReportError(
      "STAGE4_P5_CONDITIONS_REQUIRED",
      "P5 recommendation_conditions required when P5-critical unknowns or preferred-path conflicts remain",
    );
  }

  const experiment = parseVerificationExperiment(f06);
  if (!experiment) {
    throw new Stage4ReportError(
      "STAGE4_P6_EXPERIMENT_REQUIRED",
      "P6 verification_experiment with all 7 fields is required",
    );
  }

  const review = parseReviewDecision(f08);
  if (!review) {
    throw new Stage4ReportError(
      "STAGE4_P8_REVIEW_REQUIRED",
      "P8 review_decision must be continue|adjust|stop|rerun",
    );
  }
  const shared = asStringArray(f08.shared_core_metrics);
  if (shared.length === 0) {
    throw new Stage4ReportError(
      "STAGE4_P8_SHARED_METRICS_REQUIRED",
      "P8 shared_core_metrics must be non-empty and align with P6 observables",
    );
  }

  const observeBlob = [
    experiment.observe,
    experiment.success_criteria,
    experiment.hypothesis,
  ]
    .join("\n")
    .toLowerCase();
  const aligned = shared.some((m) => {
    const token = m.toLowerCase().slice(0, 24);
    return observeBlob.includes(token) || token.includes(observeBlob.slice(0, 24));
  });
  if (!aligned) {
    // Soft textual overlap: also accept if any metric phrase appears in observe/success.
    const loose = shared.some((m) =>
      observeBlob.includes(m.toLowerCase().slice(0, Math.min(12, m.length))),
    );
    if (!loose) {
      throw new Stage4ReportError(
        "STAGE4_P8_METRICS_MISALIGN",
        "P8 shared_core_metrics must trace to P6 experiment observe/success_criteria",
      );
    }
  }

  assertSnapshotMatchesBinding(dc, artifact.binding);
}

/** Hypotheses that still need validation — preferred P6 targets. */
export function pendingHypothesesForP6(dc: DecisionContext): Hypothesis[] {
  return dc.hypotheses.filter(
    (h) =>
      h.state === "proposed" ||
      h.state === "pending_validation" ||
      h.state === "challenged",
  );
}

/**
 * Build a deterministic Stage 4 sample artifact from a frozen DC (no LLM).
 * Used for acceptance samples and structural tests.
 */
export function buildStage4SampleFromFrozenDc(
  frozen: DecisionContext,
  opts?: { report_id?: string; now?: string },
): Stage4ReportArtifact {
  const pending = pendingHypothesesForP6(frozen);
  const hyp =
    pending[0]?.statement ??
    frozen.hypotheses[0]?.statement ??
    "Core path assumption still needs a low-cost check";
  const p5UnknownDirs = frozen.dirs.filter(
    (d) => d.may_affect_p5_ranking && d.current_state === "unknown",
  );
  const unresolved = frozen.conflicts.filter(
    (c) => c.state === "open" || c.state === "unresolved_in_final",
  );
  const conditionBits = [
    ...p5UnknownDirs.map((d) => `If DIR ${d.dir_id} resolves differently: ${d.need}`),
    ...unresolved.map(
      (c) => `Unresolved conflict ${c.conflict_id} on ${c.conflict_field}`,
    ),
    ...(frozen.information_boundaries ?? []),
  ];
  const observe = "Whether the low-cost trial produces clearer signal on the target hypothesis";
  const success = "Signal quality improves enough to keep or revise the preferred path without added irreversible cost";

  const faces: Stage4ReportArtifact["faces"] = {
    "05": {
      page: "05",
      face: "05",
      first_choice: `Conditional preferred path aligned to: ${frozen.definition.decision_question ?? frozen.definition.desired_outcome ?? "decision question"}`,
      second_choice:
        "Phased / reversible alternative if preferred preconditions are not met",
      caution_choice:
        "High-commitment path deferred until verification experiment returns",
      switch_or_stop:
        "Switch if preconditions fail; stop if unacceptable outcomes in definition become likely",
      contrast: "Prefer reversible low-cost learning over irreversible commitment",
      recommendation_conditions:
        conditionBits.join("; ") ||
        "Preferred path holds only while current confirmed constraints remain true",
      evidence_trace: [
        ...frozen.reality_facts
          .filter((f) => f.user_confirmed)
          .slice(0, 3)
          .map((f) => `fact:${f.fact_id}`),
        ...frozen.hypotheses.slice(0, 2).map((h) => `hypothesis:${h.hypothesis_id}`),
      ],
    },
    "06": {
      page: "06",
      face: "06",
      near_step_principle: "Run one low-cost reversible verification before larger commitment",
      stage_climate: "Verification window before irreversible spend",
      self_retune: "Adjust cadence if observation noise is high",
      rhythm_note: "Do not expand scope during the verification window",
      verification_experiment: {
        hypothesis: hyp,
        action: "Execute a bounded reversible trial that isolates the hypothesis",
        observe,
        window: "One short observation window sized to the decision stakes (no invented KPI)",
        success_criteria: success,
        if_fail: "Stop expanding cost; adjust path or rerun judgment with new evidence",
        defer_costs:
          "Defer non-reversible spend, long contracts, and identity-level commitments until verification completes",
      },
    },
    "08": {
      page: "08",
      face: "08",
      red_lights: [
        "Irreversible cost rises before verification completes",
        "Preferred-path conflict reopens without user clarification",
        "Observation window ends with no usable signal",
      ],
      review_questions: [
        "Did the experiment raise information quality on the target hypothesis?",
        "Are shared core metrics still aligned with the preferred path?",
        "Is user confirmation needed before continuing?",
      ],
      when_to_rerun:
        "Rerun when material new facts arrive or a preferred-path conflict flips",
      shared_core_metrics: [observe, success],
      review_decision: conditionBits.length ? "adjust" : "continue",
      review_decision_rationale:
        conditionBits.length > 0
          ? "Open unknowns/conflicts require adjust-or-verify before unconditional continue"
          : "No blocking unknown on preferred path; continue under stated conditions",
    },
  };

  return bindStage4Report(frozen, faces, {
    report_id: opts?.report_id ?? `STAGE4-SAMPLE-${frozen.context_id}-v${frozen.version}`,
    generated_at: opts?.now,
  });
}

/** Eight value dimensions checklist for acceptance writeups (manual + structural). */
export function stage4ValueDimensionChecklist(
  artifact: Stage4ReportArtifact,
): Record<Stage4ValueDimension, { ok: boolean; note: string }> {
  assertP5P6P8Consistency(artifact);
  const dc = artifact.context_snapshot;
  const f05 = artifact.faces["05"]!;
  const f06 = artifact.faces["06"]!;
  const experiment = parseVerificationExperiment(f06)!;
  const hasConditions = Boolean(asNonEmptyString(f05.recommendation_conditions));
  const hasConfirmed = dc.reality_facts.some((f) => f.user_confirmed);
  const hasHypothesis = dc.hypotheses.length > 0;
  return {
    problem_understanding: {
      ok: Boolean(dc.definition.decision_question || dc.definition.concrete_event),
      note: "Definition present on frozen DC",
    },
    attribution_quality: {
      ok: hasConfirmed || hasHypothesis,
      note: "Facts/hypotheses separated on DC feed",
    },
    real_world_fit: {
      ok: dc.constraints.length > 0 || Boolean(dc.definition.stakes),
      note: "Constraints or stakes available",
    },
    choice_value: {
      ok: hasConditions || Boolean(asNonEmptyString(f05.switch_or_stop)),
      note: "Conditional ranking + switch/stop",
    },
    action_value: {
      ok: Boolean(experiment.action && experiment.observe),
      note: "P6 verification experiment present",
    },
    reversibility: {
      ok: /revers|可逆|defer|低成本/i.test(
        `${experiment.action} ${experiment.defer_costs} ${asNonEmptyString(f05.contrast) ?? ""}`,
      ),
      note: "Reversibility / defer costs called out",
    },
    internal_consistency: {
      ok: true,
      note: "P5/P6/P8 consistency asserted",
    },
    expression_quality: {
      ok: Boolean(asNonEmptyString(f05.first_choice) && experiment.hypothesis),
      note: "Concrete preferred path + hypothesis language",
    },
  };
}
