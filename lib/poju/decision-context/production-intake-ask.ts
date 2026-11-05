/**
 * Production Intake 2.0 next-ask orchestration.
 *
 * Call chain (sole scoring path):
 *   selectNextIntakeAskForSession
 *     → planNextAskFromCandidates
 *       → scorePlanningCandidate
 *         → resolveDirRoleEvidence
 *
 * Wired from agent collecting after DC turn persist. No parallel gain/unresolved path.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type { NaValidationContext } from "./explicit-na-validate";
import { buildNaValidationContextFromSession } from "./na-validation-from-session";
import {
  planNextAskFromCandidates,
  type PlanNextAskResult,
  type RankablePlanningCandidate,
  type RankedPlanningCandidate,
} from "./question-plan-cycle";
import { snapshotFromDc } from "./question-planning";
import type { DecisionContext } from "./types";

export const INTAKE_ASK_SCORING_PATH =
  "selectNextIntakeAskForSession→planNextAskFromCandidates→scorePlanningCandidate→resolveDirRoleEvidence" as const;

export type IntakeAskPlanSnapshot = {
  scored_at: string;
  scoring_path: typeof INTAKE_ASK_SCORING_PATH;
  selected_candidate_id: string | null;
  ranked_candidate_ids: string[];
  unresolved_counts: Record<string, number>;
  gap_types: Record<string, string>;
};

/** Build dir_based gap candidates from live DC dirs (unknown/conflict). */
export function buildIntakeCandidatesFromDc(
  dc: DecisionContext,
): RankablePlanningCandidate[] {
  const out: RankablePlanningCandidate[] = [];
  for (const dir of dc.dirs) {
    if (dir.id_lifecycle === "deprecated") continue;
    if (dir.current_state === "known" || dir.current_state === "n_a") continue;
    const roles = dir.required_fact_roles ?? [];
    if (roles.length === 0) continue;
    const fact_role_codes = roles.map(
      (r) => `v1/dir/${dir.dir_id}/role/${r}`,
    );
    const gate =
      dir.may_affect_p5_ranking === true ? ("P0" as const) : ("P1" as const);
    out.push({
      candidate_id: `cq_dir_${dir.dir_id}`,
      kind: "dir_based",
      dir_ids: [dir.dir_id],
      ddr_ids: [`DDR_FOR_${dir.dir_id}`],
      fact_role_codes,
      impact: {
        decision_critical: dir.may_affect_p5_ranking === true,
        may_affect_p5_ranking: dir.may_affect_p5_ranking === true,
        gate_class: gate,
      },
      depth: 1,
      repetition_count: 0,
      budget_cost: 1,
    });
  }
  return out;
}

export type SelectNextIntakeAskInput = {
  session: POJUSessionState;
  nowIso?: string;
  remaining_hard_budget?: number;
  /** Extra candidates (e.g. source_only) supplied by Gate/CFP layer. */
  extraCandidates?: RankablePlanningCandidate[];
  naValidation?: NaValidationContext;
  softGate?: { verdict: "PASS" | "WARN" | "FAIL" };
  p0DdrIncomplete?: boolean;
  p0SourceNotOk?: boolean;
};

export type SelectNextIntakeAskResult = {
  session: POJUSessionState;
  plan: PlanNextAskResult;
  selected: RankedPlanningCandidate | null;
  production_call_chain: typeof INTAKE_ASK_SCORING_PATH;
  skipped_reason?: string;
};

/**
 * Production entry: score/sort/select next ask for a session with draft DC.
 * Always uses planNextAskFromCandidates — never a second scoring algorithm.
 */
export function selectNextIntakeAskForSession(
  input: SelectNextIntakeAskInput,
): SelectNextIntakeAskResult {
  const dc = input.session.decision_context;
  if (!dc || (dc.status !== "draft" && dc.status !== "final")) {
    return {
      session: input.session,
      plan: {
        ranked: [],
        selected: null,
        scoring_path: "scorePlanningCandidate→resolveDirRoleEvidence",
      },
      selected: null,
      production_call_chain: INTAKE_ASK_SCORING_PATH,
      skipped_reason: "no_dc",
    };
  }

  const candidates = [
    ...buildIntakeCandidatesFromDc(dc),
    ...(input.extraCandidates ?? []),
  ];

  const naValidation =
    input.naValidation ??
    buildNaValidationContextFromSession(input.session, {
      nowIso: input.nowIso,
    });

  const plan = planNextAskFromCandidates({
    candidates,
    snap: snapshotFromDc(dc),
    naValidation,
    softGate: input.softGate,
    p0DdrIncomplete: input.p0DdrIncomplete,
    p0SourceNotOk: input.p0SourceNotOk,
    remaining_hard_budget: input.remaining_hard_budget ?? 15,
  });

  const now = input.nowIso ?? new Date().toISOString();
  const snapshot: IntakeAskPlanSnapshot = {
    scored_at: now,
    scoring_path: INTAKE_ASK_SCORING_PATH,
    selected_candidate_id: plan.selected?.candidate.candidate_id ?? null,
    ranked_candidate_ids: plan.ranked.map((r) => r.candidate.candidate_id),
    unresolved_counts: Object.fromEntries(
      plan.ranked.map((r) => [
        r.candidate.candidate_id,
        r.score.unresolved_count,
      ]),
    ),
    gap_types: Object.fromEntries(
      plan.ranked.map((r) => [r.candidate.candidate_id, r.score.gap_type]),
    ),
  };

  return {
    session: {
      ...input.session,
      intake_ask_plan: snapshot,
    },
    plan,
    selected: plan.selected,
    production_call_chain: INTAKE_ASK_SCORING_PATH,
  };
}
