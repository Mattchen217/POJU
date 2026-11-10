/**
 * Production Adaptive Turn branch for formal Conflict Resolution.
 * Calls clarifyConflict() only after an explicit user choice; persists via C1.
 */

import { clarifyConflict } from "@/lib/poju/decision-context/conflict-lifecycle";
import { reaggregateDirsOnSession } from "@/lib/poju/decision-context/na-validation-from-session";
import { persistDcLifecycleChange } from "@/lib/poju/decision-context/production-dc-lifecycle";
import type { Conflict } from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  activateNextBlueprintPriorityBand,
  ensureDecisionBlueprint,
} from "./blueprint";
import {
  planForSameConflictClarification,
  resolveConflictChoice,
  type ConflictClarificationTarget,
} from "./conflict-clarification";
import { buildUnderstandingState } from "./understanding-state";
import type {
  AdaptiveQuestionPlan,
  AdaptiveTurnResult,
  UnderstandingState,
} from "./types";

export type ConflictClarificationTurnDeps = {
  buildUnderstanding: (
    args: Parameters<typeof buildUnderstandingState>[0],
  ) => UnderstandingState;
  planFromState: (
    session: POJUSessionState,
    understanding: UnderstandingState,
    now: string,
  ) => Promise<{
    session: POJUSessionState;
    understanding: UnderstandingState;
    plan: AdaptiveQuestionPlan | null;
    authorized_question: string | null;
    planner_block: { reason_code: string; detail: string } | null;
  }>;
  withUnderstanding: (
    session: POJUSessionState,
    understanding: UnderstandingState,
    plan: AdaptiveQuestionPlan | null,
    askSnap: POJUSessionState["intake_ask_plan"],
  ) => POJUSessionState;
  outcomeFromPlanResult: (planned: {
    plan: AdaptiveQuestionPlan | null;
    planner_block: { reason_code: string; detail: string } | null;
  }) => AdaptiveTurnResult["outcome"];
  errorText: (e: unknown) => string;
};


export function findClarifiedConflictForTurn(
  session: POJUSessionState,
  sourceTurnId: string,
): Conflict | null {
  const turnId = sourceTurnId.trim();
  if (!turnId) return null;
  for (const conflict of session.decision_context?.conflicts ?? []) {
    if (conflict.state !== "clarified" || !conflict.resolution) continue;
    try {
      const parsed = JSON.parse(conflict.resolution) as { source_turn_id?: string };
      if (parsed.source_turn_id === turnId) return conflict;
    } catch {
      if (conflict.resolution.includes(turnId)) return conflict;
    }
  }
  return null;
}

export async function handleConflictClarificationAnswer(input: {
  current: POJUSessionState;
  original: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
  target: ConflictClarificationTarget;
  /**
   * @internal Test-only. Substitutes persistDcLifecycleChange for C1 fault injection.
   * Production callers must omit this so the official lifecycle persist is used.
   */
  persistOverride?: (
    previous: POJUSessionState,
    nextDcSession: POJUSessionState,
    idempotency_key: string,
  ) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;
} & ConflictClarificationTurnDeps): Promise<AdaptiveTurnResult> {
  const {
    statement,
    source_turn_id,
    now,
    target,
    buildUnderstanding,
    planFromState,
    withUnderstanding,
    outcomeFromPlanResult,
    errorText,
  } = input;
  let current = input.current;
  const key = `dc_conflict_clarify:${current.session_id}:${source_turn_id}`;

  const finishFromCurrent = async (
    session: POJUSessionState,
    outcome: AdaptiveTurnResult["outcome"],
    persist_error?: string,
  ): Promise<AdaptiveTurnResult> => {
    const bp2 = ensureDecisionBlueprint(session, { now });
    session = bp2.session;
    session = activateNextBlueprintPriorityBand(session, now);
    const understanding = buildUnderstanding({
      session,
      blueprint: session.decision_blueprint!,
      now,
      last_answer_event_id: null,
    });
    const planned = await planFromState(session, understanding, now);
    return {
      session: planned.session,
      outcome:
        outcome === "idempotent_replay"
          ? "idempotent_replay"
          : outcomeFromPlanResult(planned),
      ask_error: planned.planner_block
        ? `${planned.planner_block.reason_code}:${planned.planner_block.detail}`
        : undefined,
      answer_event: null,
      understanding: planned.understanding,
      plan: planned.plan,
      authorized_question: planned.authorized_question,
      persist_error,
    };
  };

  // Same source_turn_id must not re-run the official lifecycle transition.
  const prior = current.decision_context?.conflicts.find(
    (item) => item.conflict_id === target.conflict_id,
  );
  if (prior?.state === "clarified" && prior.resolution) {
    try {
      const parsed = JSON.parse(prior.resolution) as { source_turn_id?: string };
      if (parsed.source_turn_id === source_turn_id) {
        return finishFromCurrent(current, "idempotent_replay", "idempotent_skip");
      }
    } catch {
      // Resolution may be non-JSON; fall through to the persist-key check.
    }
  }
  if ((current.decision_context_idempotency_keys ?? []).includes(key)) {
    return finishFromCurrent(current, "idempotent_replay", "idempotent_skip");
  }

  const result = resolveConflictChoice({
    statement,
    target,
    session: current,
  });

  if (result.kind === "ambiguous") {
    if (result.reason === "stale_conflict_target") {
      return finishFromCurrent(current, "planned", "stale_conflict_target");
    }
    // Keep the same open Conflict; do not write facts or treat the reply as confirmation.
    current = activateNextBlueprintPriorityBand(current, now);
    const understanding = buildUnderstanding({
      session: current,
      blueprint: current.decision_blueprint!,
      now,
      last_answer_event_id: null,
    });
    const samePlan = planForSameConflictClarification(current, target);
    if (!samePlan) {
      return finishFromCurrent(current, "planned", "stale_conflict_target");
    }
    const u: UnderstandingState = {
      ...understanding,
      next_question_plan: samePlan,
    };
    return {
      session: withUnderstanding(
        current,
        u,
        samePlan,
        current.intake_ask_plan ?? null,
      ),
      outcome: "planned",
      answer_event: null,
      understanding: u,
      plan: samePlan,
      authorized_question: samePlan.question_text,
    };
  }

  const dc = current.decision_context;
  if (!dc) {
    return finishFromCurrent(current, "planned", "stale_conflict_target");
  }
  const conflict = dc.conflicts.find(
    (item) => item.conflict_id === target.conflict_id,
  );
  if (!conflict || conflict.state !== "open") {
    return finishFromCurrent(current, "planned", "stale_conflict_target");
  }

  const clarified = clarifyConflict(
    conflict,
    JSON.stringify({
      selected_fact_id: result.fact_id,
      source_turn_id,
      user_statement: statement.slice(0, 1000),
    }),
    {
      user_confirmation: true,
      now,
    },
  );

  const conflicts = dc.conflicts.map((item) =>
    item.conflict_id === clarified.conflict_id ? clarified : item,
  );
  const dirs = await reaggregateDirsOnSession(current, dc.dirs, {
    realityFacts: dc.reality_facts,
    constraints: dc.constraints,
    conflicts,
    nowIso: now,
  });
  const nextSession: POJUSessionState = {
    ...current,
    decision_context: {
      ...dc,
      conflicts,
      dirs,
      updated_at: now,
      version: (dc.version ?? 1) + 1,
    },
  };

  try {
    const persistFn = input.persistOverride ?? persistDcLifecycleChange;
    const persisted = await persistFn(
      input.original,
      nextSession,
      key,
    );
    if (persisted.error === "idempotent_skip") {
      current = {
        ...nextSession,
        ...persisted.session,
        decision_context:
          persisted.session.decision_context ?? current.decision_context,
        decision_context_versions:
          persisted.session.decision_context_versions ??
          current.decision_context_versions,
        decision_context_idempotency_keys:
          persisted.session.decision_context_idempotency_keys ??
          current.decision_context_idempotency_keys,
        control_plane:
          persisted.session.control_plane ?? current.control_plane,
        decision_blueprint: current.decision_blueprint,
        messages: current.messages,
        agent_v2: current.agent_v2,
      };
      return finishFromCurrent(current, "idempotent_replay", "idempotent_skip");
    }
    if (!persisted.committed) {
      return {
        session: input.original,
        outcome: "dc_persist_failed",
        answer_event: null,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error: persisted.error ?? "persist_failed",
      };
    }
    current = {
      ...nextSession,
      ...persisted.session,
      decision_context:
        persisted.session.decision_context ?? nextSession.decision_context,
      decision_context_versions:
        persisted.session.decision_context_versions ??
        nextSession.decision_context_versions,
      decision_context_idempotency_keys:
        persisted.session.decision_context_idempotency_keys ??
        nextSession.decision_context_idempotency_keys,
      control_plane:
        persisted.session.control_plane ?? nextSession.control_plane,
      decision_blueprint: nextSession.decision_blueprint,
      messages: nextSession.messages,
      agent_v2: nextSession.agent_v2,
      session_revision: persisted.session.session_revision,
      dc_write_revision: persisted.session.dc_write_revision,
    };
    return finishFromCurrent(current, "planned");
  } catch (e) {
    return {
      session: input.original,
      outcome: "dc_persist_threw",
      answer_event: null,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: errorText(e),
    };
  }
}
