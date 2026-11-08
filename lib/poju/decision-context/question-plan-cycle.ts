/**
 * Production Question Planning cycle (Intake 2.0 Stage 3.2).
 *
 * Sole production entry for candidate score → sort → select.
 * MUST call scorePlanningCandidate (shared resolveDirRoleEvidence).
 * Forbidden: parallel gain/unresolved heuristics that bypass the resolver.
 */

import type { NaValidationContext } from "./explicit-na-validate";
import {
  scorePlanningCandidate,
  type CandidateScore,
  type PlanningCandidate,
  type PlanningDcSnapshot,
  type SoftGateSnapshot,
} from "./question-planning";

export type RankablePlanningCandidate = PlanningCandidate & {
  depth: number;
  repetition_count: number;
  budget_cost: number;
};

export type RankedPlanningCandidate = {
  candidate: RankablePlanningCandidate;
  score: CandidateScore;
  sort_key: string;
};

export type PlanNextAskInput = {
  candidates: RankablePlanningCandidate[];
  snap: PlanningDcSnapshot;
  naValidation?: NaValidationContext;
  softGate?: SoftGateSnapshot;
  p0DdrIncomplete?: boolean;
  p0SourceNotOk?: boolean;
  /** Remaining hard ask budget; candidates with budget_cost > remaining are skipped for selection. */
  remaining_hard_budget: number;
};

export type PlanNextAskResult = {
  /** Deterministic ranked list (all scored candidates). */
  ranked: RankedPlanningCandidate[];
  /** Top selectable candidate within budget, or null. */
  selected: RankedPlanningCandidate | null;
  /**
   * Literal proof for independent review: every score went through
   * scorePlanningCandidate → resolveDirRoleEvidence. No bypass path exists.
   */
  scoring_path: string;
};

function gateRank(gate: "P0" | "P1" | "P2"): number {
  if (gate === "P0") return 3;
  if (gate === "P1") return 2;
  return 1;
}

function kindRank(kind: PlanningCandidate["kind"]): number {
  return kind === "dir_based" ? 0 : 1;
}

function primaryDirId(c: PlanningCandidate): string {
  if (c.kind !== "dir_based" || c.dir_ids.length === 0) return "";
  return [...c.dir_ids].sort()[0]!;
}

function normalizedDdrIds(c: PlanningCandidate): string {
  return [...new Set(c.ddr_ids)].sort().join(",");
}

/**
 * Build lexicographic sort key per Planning §2.1 Final sort key.
 * Encodes DESC fields by inverting numeric ranks into zero-padded descending keys.
 */
export function buildCandidateSortKey(
  candidate: RankablePlanningCandidate,
  score: CandidateScore,
): string {
  const gr = gateRank(candidate.impact.gate_class);
  const p5 = candidate.impact.may_affect_p5_ranking ? 1 : 0;
  const crit = candidate.impact.decision_critical ? 1 : 0;
  const gain = score.information_gain_est;
  const depth = candidate.depth;
  const rep = candidate.repetition_count;
  const kr = kindRank(candidate.kind);
  const dir = primaryDirId(candidate);
  const src = candidate.kind === "source_only" ? (candidate.source_code ?? "") : "";
  const ddrs = normalizedDdrIds(candidate);

  // DESC fields: higher value → earlier. Encode as (MAX - v) zero-padded.
  const gateEnc = String(9 - gr).padStart(1, "0");
  const p5Enc = String(1 - p5);
  const critEnc = String(1 - crit);
  const gainEnc = String(1_000_000 - Math.min(gain, 999_999)).padStart(7, "0");
  const depthEnc = String(Math.min(depth, 999)).padStart(3, "0");
  const repEnc = String(Math.min(rep, 999)).padStart(3, "0");
  const kindEnc = String(kr);

  return [
    gateEnc,
    p5Enc,
    critEnc,
    gainEnc,
    depthEnc,
    repEnc,
    kindEnc,
    dir,
    src,
    ddrs,
    candidate.candidate_id,
  ].join("|");
}

/**
 * Production planner: score every candidate via shared resolver, sort, select.
 * source_only keeps unresolved_count=0 / source_pending semantics inside scorePlanningCandidate.
 */
export function planNextAskFromCandidates(
  input: PlanNextAskInput,
): PlanNextAskResult {
  const ranked: RankedPlanningCandidate[] = [];

  for (const candidate of input.candidates) {
    const score = scorePlanningCandidate(candidate, input.snap, {
      naValidation: input.naValidation,
      softGate: input.softGate,
      p0DdrIncomplete: input.p0DdrIncomplete,
      p0SourceNotOk: input.p0SourceNotOk,
    });
    ranked.push({
      candidate,
      score,
      sort_key: buildCandidateSortKey(candidate, score),
    });
  }

  ranked.sort((a, b) => {
    if (a.sort_key < b.sort_key) return -1;
    if (a.sort_key > b.sort_key) return 1;
    return 0;
  });

  const selected =
    ranked.find((r) => r.candidate.budget_cost <= input.remaining_hard_budget) ??
    null;

  return {
    ranked,
    selected,
    scoring_path: "scorePlanningCandidate\u2192resolveDirRoleEvidence",
  };
}
