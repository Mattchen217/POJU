# -*- coding: utf-8 -*-
"""M2.3-R2-FU patch: prevent planner from bypassing open P0/P1 obligations."""
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")

# ---------- types.ts: add planner_blocked outcome ----------
types_path = ROOT / "lib/poju/decision-intake/types.ts"
types = types_path.read_text(encoding="utf-8")
old_outcomes = '''export type AdaptiveTurnResult = {
  session: import("@/lib/poju/types").POJUSessionState;
  outcome:
    | "planned"
    | "ready_no_question"
    | "dc_persist_failed"
    | "dc_persist_threw"
    | "not_applicable_phase"
    | "idempotent_replay";
  answer_event: AnswerEvent | null;
  understanding: UnderstandingState | null;
  plan: AdaptiveQuestionPlan | null;
  authorized_question: string | null;
  persist_error?: string;
  ask_error?: string;
};'''
new_outcomes = '''export type AdaptiveTurnResult = {
  session: import("@/lib/poju/types").POJUSessionState;
  outcome:
    | "planned"
    | "ready_no_question"
    | "planner_blocked"
    | "dc_persist_failed"
    | "dc_persist_threw"
    | "not_applicable_phase"
    | "idempotent_replay";
  answer_event: AnswerEvent | null;
  understanding: UnderstandingState | null;
  plan: AdaptiveQuestionPlan | null;
  authorized_question: string | null;
  persist_error?: string;
  ask_error?: string;
};'''
if old_outcomes not in types:
    raise SystemExit("types.ts AdaptiveTurnResult block not found")
types_path.write_text(types.replace(old_outcomes, new_outcomes, 1), encoding="utf-8")
print("patched types.ts")

# ---------- collecting-dc-turn.ts ----------
cdc_path = ROOT / "lib/poju/collecting-dc-turn.ts"
cdc = cdc_path.read_text(encoding="utf-8")
old_cdc_outcome = '''export type CollectingDcTurnOutcome =
  /** DC committed by C1 (or prior commit via idempotent_skip) and adopted. */
  | "dc_committed"
  /** Collecting mapper skipped this turn (no draft DC, empty / duplicate turn). */
  | "not_applied"
  /** C1 rolled back; caller Session returned unchanged, no planning. */
  | "persist_failed"
  /** DC mapper / persist threw; caller Session returned unchanged, no planning. */
  | "persist_threw";'''
new_cdc_outcome = '''export type CollectingDcTurnOutcome =
  /** DC committed by C1 (or prior commit via idempotent_skip) and adopted. */
  | "dc_committed"
  /** Collecting mapper skipped this turn (no draft DC, empty / duplicate turn). */
  | "not_applied"
  /** C1 rolled back; caller Session returned unchanged, no planning. */
  | "persist_failed"
  /** DC mapper / persist threw; caller Session returned unchanged, no planning. */
  | "persist_threw"
  /**
   * Planner could not authorize a Catalog-scoped question while open Blueprint
   * P0/P1 obligations remain and hard budget remains. Nonterminal — do not
   * treat as investigation-complete / final-confirm.
   */
  | "planner_blocked";'''
if old_cdc_outcome not in cdc:
    raise SystemExit("collecting-dc-turn outcome union not found")
cdc = cdc.replace(old_cdc_outcome, new_cdc_outcome, 1)

old_map_idempotent = '''  if (turn.outcome === "idempotent_replay") {
    return {
      session: turn.session,
      outcome: "not_applied",
      ask_planned: Boolean(turn.plan) || (turn.understanding != null && !turn.ask_error),
      persist_error: turn.persist_error ?? "turn_already_mapped",
      ...common,
    };
  }'''
new_map_block = '''  if (turn.outcome === "idempotent_replay") {
    return {
      session: turn.session,
      outcome: "not_applied",
      ask_planned: Boolean(turn.plan) || (turn.understanding != null && !turn.ask_error),
      persist_error: turn.persist_error ?? "turn_already_mapped",
      ...common,
    };
  }
  if (turn.outcome === "planner_blocked") {
    return {
      session: turn.session,
      outcome: "planner_blocked",
      ask_planned: false,
      persist_error: turn.persist_error,
      ask_error: turn.ask_error ?? "planner_blocked",
      ...common,
      authorized_question: null,
      plan: null,
    };
  }'''
if old_map_idempotent not in cdc:
    raise SystemExit("collecting-dc-turn idempotent_replay map not found")
cdc = cdc.replace(old_map_idempotent, new_map_block, 1)
cdc_path.write_text(cdc, encoding="utf-8")
print("patched collecting-dc-turn.ts")

print("phase1 ok")
