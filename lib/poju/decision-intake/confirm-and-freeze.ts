/**
 * M2.1 — Final understanding confirm → legal fact promotion → sufficiency → Freeze.
 *
 * Closes the broken production chain after M1-R adaptive Q&A:
 *   Readiness stop → user confirm → Confirmation Events + confirmed status
 *   → DIR reaggregate → evaluateDecisionSufficiency → ensureSessionFrozenForDelivery
 *
 * Forbidden: fake DIR.current_state; Freeze when sufficiency.canStop is false;
 * Opening-Gate-style batch without user confirm turn provenance.
 */

import {
  appendConfirmationEventWithProvenance,
  makeFactConfirmEventId,
  type ConfirmationEvent,
} from "@/lib/poju/decision-context/confirmation-event";
import { evaluateDecisionSufficiency } from "@/lib/poju/decision-context/stop-criteria";
import { reaggregateDirsOnSession } from "@/lib/poju/decision-context/na-validation-from-session";
import { applyDcToWorking } from "@/lib/poju/decision-context/persist";
import {
  ensureSessionFrozenForDelivery,
  type FreezeWireResult,
} from "@/lib/poju/decision-context/production-freeze-wire";
import type {
  Constraint,
  DecisionContext,
  RealityFact,
} from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";

const CONFIRM_RE =
  /^(确认|同意|没问题|可以|正确|好的|是的|确认无误|yes|y|confirm|ok|okay|looks\s*good)([。.!！\s]|$)/i;
const ADD_MORE_RE =
  /(补充|修改|不对|还有|更正|不正确|再问|继续问|add\s*more|incorrect|not\s*right|change)/i;

export function isFinalUnderstandingConfirmText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (ADD_MORE_RE.test(t) && !CONFIRM_RE.test(t)) return false;
  return CONFIRM_RE.test(t) || t === "确认" || t === "同意";
}

export function isFinalUnderstandingAddMoreText(text: string): boolean {
  return ADD_MORE_RE.test(text.trim());
}

export function sessionReadyForFinalConfirm(session: POJUSessionState): boolean {
  const u = session.decision_understanding;
  if (!u) return false;
  if (u.readiness.can_ask !== false) return false;
  return (
    u.readiness.verdict === "ready_for_final_confirm" ||
    u.readiness.verdict === "hard_budget_exhausted"
  );
}

function promoteFact(f: RealityFact, now: string): RealityFact {
  if (f.status === "unknown" || f.status === "declined" || f.status === "not_applicable") {
    return f;
  }
  if (f.status === "confirmed" && f.user_confirmed === true) return f;
  const verification_level =
    f.verification_level === "none" ? "user_asserted" : f.verification_level;
  if (
    verification_level !== "user_asserted" &&
    verification_level !== "user_estimate" &&
    verification_level !== "independently_verified"
  ) {
    return f;
  }
  if (verification_level === "independently_verified") {
    return {
      ...f,
      status: "confirmed",
      verification_level,
      user_confirmed: false,
      updated_at: now,
    };
  }
  return {
    ...f,
    status: "confirmed",
    verification_level:
      verification_level === "user_estimate" ? "user_asserted" : verification_level,
    user_confirmed: true,
    updated_at: now,
  };
}

function promoteConstraint(c: Constraint, now: string): Constraint {
  if (c.status === "unknown" || c.status === "declined" || c.status === "not_applicable") {
    return c;
  }
  if (c.status === "confirmed" && c.user_confirmed === true) return c;
  return {
    ...c,
    status: "confirmed",
    verification_level:
      c.verification_level === "none" ? "user_asserted" : c.verification_level,
    user_confirmed: true,
    updated_at: now,
  };
}

function buildEventsForPromotion(input: {
  session: POJUSessionState;
  before: DecisionContext;
  afterFacts: RealityFact[];
  afterConstraints: Constraint[];
  confirmationTurnId: string;
  now: string;
}): { events: ConfirmationEvent[]; error?: string } {
  let events = [...(input.session.confirmation_events ?? [])];
  const ctx = {
    session_id: input.session.session_id,
    expected_session_id: input.session.session_id,
    messages: input.session.messages,
    decision_context: input.before,
  };

  for (const f of input.afterFacts) {
    const prev = input.before.reality_facts.find((x) => x.fact_id === f.fact_id);
    if (!prev) continue;
    if (prev.status === "confirmed" && prev.user_confirmed === true) continue;
    if (f.status !== "confirmed" || f.user_confirmed !== true) continue;
    if (!f.source_turn_id?.trim()) continue;
    const raw = {
      event_id: makeFactConfirmEventId(`${f.fact_id}_${input.confirmationTurnId}`),
      target_type: "fact" as const,
      fact_id: f.fact_id,
      source_turn_id: f.source_turn_id,
      confirmation_turn_id: input.confirmationTurnId,
      confirmation_action_id: `m21_final_confirm_fact_${f.fact_id}`,
      event_type: "confirm_fact" as const,
      actor: "user" as const,
      confirmed_at: input.now,
      event_version: 1 as const,
    };
    try {
      const appended = appendConfirmationEventWithProvenance(ctx, events, raw);
      events = appended.events;
    } catch (e) {
      return { events, error: e instanceof Error ? e.message : String(e) };
    }
  }

  for (const c of input.afterConstraints) {
    const prev = input.before.constraints.find((x) => x.constraint_id === c.constraint_id);
    if (!prev) continue;
    if (prev.status === "confirmed" && prev.user_confirmed === true) continue;
    if (c.status !== "confirmed" || c.user_confirmed !== true) continue;
    if (!c.source_turn_id?.trim()) continue;
    const raw = {
      event_id: `constraint_confirm_event_${c.constraint_id}_${input.confirmationTurnId}`,
      target_type: "constraint" as const,
      constraint_id: c.constraint_id,
      source_turn_id: c.source_turn_id,
      confirmation_turn_id: input.confirmationTurnId,
      confirmation_action_id: `m21_final_confirm_constraint_${c.constraint_id}`,
      event_type: "confirm_constraint" as const,
      actor: "user" as const,
      confirmed_at: input.now,
      event_version: 1 as const,
    };
    try {
      const appended = appendConfirmationEventWithProvenance(ctx, events, raw);
      events = appended.events;
    } catch (e) {
      return { events, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { events };
}

async function persistPromotedDc(input: {
  previous: POJUSessionState;
  next: POJUSessionState;
  idempotency_key: string;
}): Promise<{ session: POJUSessionState; committed: boolean; error?: string }> {
  const { commitDecisionContextChange } = await import("@/lib/poju/session-manager");
  if (!input.next.decision_context) {
    return { session: input.next, committed: false, error: "missing_dc" };
  }
  const commit = await commitDecisionContextChange({
    session: input.next,
    idempotency_key: input.idempotency_key,
    require_control_plane: false,
    apply: (tx) => {
      applyDcToWorking(
        tx,
        input.next.decision_context!,
        input.next.decision_context_versions ?? [],
      );
      // Extra session fields already live on input.next; mergeDcPersistSliceIntoSession
      // keeps them from the memory snapshot. Mirror onto working via widen for clarity.
      const working = tx.working as typeof tx.working & {
        confirmation_events?: POJUSessionState["confirmation_events"];
        decision_understanding?: POJUSessionState["decision_understanding"];
        decision_blueprint?: POJUSessionState["decision_blueprint"];
        agent_v2?: POJUSessionState["agent_v2"];
      };
      working.confirmation_events = input.next.confirmation_events ?? [];
      if (input.next.control_plane) {
        working.control_plane = input.next.control_plane;
      }
      if (input.next.decision_understanding) {
        working.decision_understanding = input.next.decision_understanding;
      }
      if (input.next.decision_blueprint) {
        working.decision_blueprint = input.next.decision_blueprint;
      }
      if (input.next.agent_v2) {
        working.agent_v2 = input.next.agent_v2;
      }
    },
  });
  if (commit.idempotent_skip) {
    return {
      session: {
        ...input.next,
        decision_context:
          commit.session.decision_context ?? input.next.decision_context,
        decision_context_versions:
          commit.session.decision_context_versions ??
          input.next.decision_context_versions,
        confirmation_events:
          commit.session.confirmation_events ?? input.next.confirmation_events,
        session_revision: commit.session.session_revision,
        dc_write_revision: commit.session.dc_write_revision,
      },
      committed: false,
      error: "idempotent_skip",
    };
  }
  if (!commit.committed) {
    return {
      session: input.previous,
      committed: false,
      error: commit.error ?? "persist_failed",
    };
  }
  return {
    session: {
      ...input.next,
      ...commit.session,
      confirmation_events:
        commit.session.confirmation_events ?? input.next.confirmation_events,
      decision_context:
        commit.session.decision_context ?? input.next.decision_context,
      messages: input.next.messages,
      agent_v2: input.next.agent_v2 ?? commit.session.agent_v2,
      decision_blueprint:
        input.next.decision_blueprint ?? commit.session.decision_blueprint,
      decision_understanding:
        input.next.decision_understanding ?? commit.session.decision_understanding,
    },
    committed: true,
  };
}

export type ConfirmAndFreezeResult = {
  session: POJUSessionState;
  outcome:
    | "frozen"
    | "not_ready"
    | "not_sufficient_after_confirm"
    | "promote_failed"
    | "persist_failed"
    | "freeze_failed"
    | "add_more"
    | "not_confirm_text";
  sufficiency_can_stop: boolean;
  freeze?: FreezeWireResult;
  error?: string;
  promoted_fact_ids: string[];
  promoted_constraint_ids: string[];
};

/**
 * Production M2.1 entry: user confirmed final understanding.
 * Mutates only via Confirmation Events + legal status promotion + Freeze wire.
 */
export async function confirmUnderstandingAndFreeze(input: {
  session: POJUSessionState;
  statement: string;
  confirmation_turn_id: string;
  now?: string;
}): Promise<ConfirmAndFreezeResult> {
  const now = input.now ?? new Date().toISOString();
  const statement = input.statement.trim();
  const empty = {
    promoted_fact_ids: [] as string[],
    promoted_constraint_ids: [] as string[],
    sufficiency_can_stop: false,
  };

  if (isFinalUnderstandingAddMoreText(statement) && !isFinalUnderstandingConfirmText(statement)) {
    const agent = input.session.agent_v2;
    return {
      ...empty,
      session: {
        ...input.session,
        agent_v2: agent
          ? { ...agent, current_phase: "collecting_context", stall_offer_pending: false }
          : agent,
      },
      outcome: "add_more",
    };
  }

  if (!isFinalUnderstandingConfirmText(statement)) {
    return { ...empty, session: input.session, outcome: "not_confirm_text" };
  }

  if (!sessionReadyForFinalConfirm(input.session)) {
    return { ...empty, session: input.session, outcome: "not_ready" };
  }

  const dc = input.session.decision_context;
  if (!dc || dc.status !== "draft") {
    return {
      ...empty,
      session: input.session,
      outcome: "not_ready",
      error: "no_draft_dc",
    };
  }

  const promoted_fact_ids: string[] = [];
  const promoted_constraint_ids: string[] = [];
  const reality_facts = dc.reality_facts.map((f) => {
    const next = promoteFact(f, now);
    if (
      next.status === "confirmed" &&
      next.user_confirmed === true &&
      (f.status !== "confirmed" || f.user_confirmed !== true)
    ) {
      promoted_fact_ids.push(next.fact_id);
    }
    return next;
  });
  const constraints = dc.constraints.map((c) => {
    const next = promoteConstraint(c, now);
    if (
      next.status === "confirmed" &&
      next.user_confirmed === true &&
      (c.status !== "confirmed" || c.user_confirmed !== true)
    ) {
      promoted_constraint_ids.push(next.constraint_id);
    }
    return next;
  });

  const built = buildEventsForPromotion({
    session: input.session,
    before: dc,
    afterFacts: reality_facts,
    afterConstraints: constraints,
    confirmationTurnId: input.confirmation_turn_id,
    now,
  });
  if (built.error) {
    return {
      session: input.session,
      outcome: "promote_failed",
      sufficiency_can_stop: false,
      error: built.error,
      promoted_fact_ids,
      promoted_constraint_ids,
    };
  }

  let working: POJUSessionState = {
    ...input.session,
    confirmation_events: built.events,
    decision_context: {
      ...dc,
      reality_facts,
      constraints,
      updated_at: now,
      version: (dc.version ?? 1) + 1,
    },
  };

  const dirs = await reaggregateDirsOnSession(working, working.decision_context!.dirs, {
    realityFacts: reality_facts,
    constraints,
    nowIso: now,
  });
  working = {
    ...working,
    decision_context: {
      ...working.decision_context!,
      dirs,
      updated_at: now,
    },
  };

  const sufficiency = evaluateDecisionSufficiency(working.decision_context!);
  const key = `dc_m21_confirm_promote:${working.session_id}:${input.confirmation_turn_id}`;

  if (!sufficiency.canStop) {
    const persisted = await persistPromotedDc({
      previous: input.session,
      next: {
        ...working,
        agent_v2: working.agent_v2
          ? { ...working.agent_v2, current_phase: "collecting_context" }
          : working.agent_v2,
        decision_understanding: working.decision_understanding
          ? {
              ...working.decision_understanding,
              readiness: {
                ...working.decision_understanding.readiness,
                can_ask: true,
                verdict: "continue",
                reasons: [
                  ...working.decision_understanding.readiness.reasons,
                  "confirm_not_sufficient_resume_collecting",
                  ...sufficiency.reasons,
                ],
                sufficiency_verdict: sufficiency.verdict,
              },
              last_sent_question: null,
              next_question_plan: null,
            }
          : working.decision_understanding,
      },
      idempotency_key: key,
    });
    if (!persisted.committed && persisted.error !== "idempotent_skip") {
      return {
        session: input.session,
        outcome: "persist_failed",
        sufficiency_can_stop: false,
        error: persisted.error ?? "persist_failed",
        promoted_fact_ids,
        promoted_constraint_ids,
      };
    }
    return {
      session: persisted.session,
      outcome: "not_sufficient_after_confirm",
      sufficiency_can_stop: false,
      error: sufficiency.reasons.join(";"),
      promoted_fact_ids,
      promoted_constraint_ids,
    };
  }

  const persisted = await persistPromotedDc({
    previous: input.session,
    next: working,
    idempotency_key: key,
  });
  if (!persisted.committed && persisted.error !== "idempotent_skip") {
    return {
      session: input.session,
      outcome: "persist_failed",
      sufficiency_can_stop: true,
      error: persisted.error ?? "persist_failed",
      promoted_fact_ids,
      promoted_constraint_ids,
    };
  }

  const freeze = await ensureSessionFrozenForDelivery(persisted.session, {
    trigger: "sufficiency_end_confirm",
    now,
    from_stall_or_max_turns: false,
    from_purchase_or_report_cta: false,
  });

  if (!freeze.ok) {
    return {
      session: persisted.session,
      outcome: "freeze_failed",
      sufficiency_can_stop: true,
      freeze,
      error: freeze.reason,
      promoted_fact_ids,
      promoted_constraint_ids,
    };
  }
  if (freeze.skipped) {
    return {
      session: freeze.session,
      outcome: "not_sufficient_after_confirm",
      sufficiency_can_stop: false,
      freeze,
      error: freeze.reason,
      promoted_fact_ids,
      promoted_constraint_ids,
    };
  }

  const agent = freeze.session.agent_v2;
  return {
    session: {
      ...freeze.session,
      agent_v2: agent
        ? {
            ...agent,
            current_phase: "awaiting_confirmation",
            stall_offer_pending: false,
          }
        : agent,
      decision_understanding: freeze.session.decision_understanding
        ? {
            ...freeze.session.decision_understanding,
            readiness: {
              verdict: "ready_for_final_confirm",
              can_ask: false,
              reasons: [
                ...(freeze.session.decision_understanding.readiness?.reasons ?? []),
                "frozen_after_user_confirm",
              ],
              sufficiency_verdict: sufficiency.verdict,
            },
            next_question_plan: null,
            last_sent_question: null,
          }
        : freeze.session.decision_understanding,
      adaptive_ask_plan: null,
    },
    outcome: "frozen",
    sufficiency_can_stop: true,
    freeze,
    promoted_fact_ids,
    promoted_constraint_ids,
  };
}
