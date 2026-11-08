/**
 * Collecting-phase DC turn orchestration for `handleUserMessage`:
 *   persistCollectingUserTurnDc (C1) → selectNextIntakeAskForSession.
 *
 * Adoption rule: the caller's Session takes the new DC only when C1 committed it
 * (or reported a prior commit via `idempotent_skip`). A rolled-back commit leaves
 * the caller's Session exactly as passed in — the uncommitted DC never reaches
 * memory, so a later whole-session save cannot write it outside C1. Next-ask
 * planning reads only that adopted / unchanged Session; a planning failure keeps
 * the committed DC and writes no plan.
 */

import type { POJUSessionState } from "@/lib/poju/types";

export type CollectingDcTurnOutcome =
  /** DC committed by C1 (or prior commit via idempotent_skip) and adopted. */
  | "dc_committed"
  /** Collecting mapper skipped this turn (no draft DC, empty / duplicate turn…). */
  | "not_applied"
  /** C1 rolled back; caller Session returned unchanged, no planning. */
  | "persist_failed"
  /** DC mapper / persist threw; caller Session returned unchanged, no planning. */
  | "persist_threw";

export type CollectingDcTurnResult = {
  session: POJUSessionState;
  outcome: CollectingDcTurnOutcome;
  /** True when a fresh next-ask plan was written onto `session`. */
  ask_planned: boolean;
  /** Persist error, mapper skip reason, or `idempotent_skip`. */
  persist_error?: string;
  /** Set when next-ask planning threw (DC stays as adopted). */
  ask_error?: string;
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runCollectingDcTurn(
  session: POJUSessionState,
  input: { statement: string; source_turn_id: string; now: string },
): Promise<CollectingDcTurnResult> {
  let current = session;
  let outcome: CollectingDcTurnOutcome;
  let persistError: string | undefined;
  try {
    const { persistCollectingUserTurnDc } = await import(
      "@/lib/poju/decision-context/production-dc-lifecycle"
    );
    const collected = await persistCollectingUserTurnDc(session, {
      statement: input.statement,
      source_turn_id: input.source_turn_id,
      now: input.now,
    });
    persistError = collected.error;
    if (!collected.applied) {
      outcome = "not_applied";
    } else if (collected.error === undefined || collected.error === "idempotent_skip") {
      current = collected.session;
      outcome = "dc_committed";
    } else {
      return { session, outcome: "persist_failed", ask_planned: false, persist_error: collected.error };
    }
  } catch (e) {
    return { session, outcome: "persist_threw", ask_planned: false, persist_error: errorText(e) };
  }

  // Intake 2.0 production ask planning — sole scoring path via shared resolver.
  if (current.decision_context?.status !== "draft") {
    return { session: current, outcome, ask_planned: false, persist_error: persistError };
  }
  try {
    const { selectNextIntakeAskForSession } = await import(
      "@/lib/poju/decision-context/production-intake-ask"
    );
    const planned = selectNextIntakeAskForSession({ session: current, nowIso: input.now });
    return { session: planned.session, outcome, ask_planned: true, persist_error: persistError };
  } catch (e) {
    return {
      session: current,
      outcome,
      ask_planned: false,
      persist_error: persistError,
      ask_error: errorText(e),
    };
  }
}
