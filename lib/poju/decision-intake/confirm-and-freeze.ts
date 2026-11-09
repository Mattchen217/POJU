/**
 * M2.1 — Final understanding confirm → legal fact promotion → sufficiency → Freeze.
 *
 * Closes the broken production chain after M1-R adaptive Q&A:
 *   Readiness stop → user confirm → Confirmation Events + confirmed status
 *   → DIR reaggregate → evaluateDecisionSufficiency → ensureSessionFrozenForDelivery
 *
 * Promotion contract (Max M2.1 REQUEST CHANGES):
 * - user_estimate + unverified stays unverified + user_estimate (never confirmed/user_asserted)
 * - user_asserted + unverified → confirmed ONLY after valid Confirmation Event + source + turn
 * - independently_verified is never converted via user confirm
 * - unknown / declined / not_applicable never promote
 * - RealityFact.user_confirmed is derived from Confirmation Events only
 * - Constraints obey the same source + event rules
 * - Missing source_turn_id or event-create failure → fail-closed (no partial promotions)
 *
 * Forbidden: fake DIR.current_state; Freeze when sufficiency.canStop is false;
 * Opening-Gate-style batch without user confirm turn provenance.
 */

import {
  appendConfirmationEventWithProvenance,
  deriveUserConfirmedFromEvents,
  hasUserConfirmEventForTarget,
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

function isTerminalNonPromoteStatus(
  status: RealityFact["status"] | Constraint["status"],
): boolean {
  return (
    status === "unknown" ||
    status === "declined" ||
    status === "not_applicable"
  );
}

/** Eligible for legal user-confirm promotion to confirmed + user_asserted. */
function isUserAssertedUnverifiedCandidate(input: {
  status: RealityFact["status"] | Constraint["status"];
  verification_level: RealityFact["verification_level"] | Constraint["verification_level"];
  user_confirmed: boolean;
}): boolean {
  if (isTerminalNonPromoteStatus(input.status)) return false;
  if (input.verification_level === "independently_verified") return false;
  if (input.verification_level === "user_estimate") return false;
  if (input.verification_level !== "user_asserted") return false;
  if (input.status === "confirmed" && input.user_confirmed === true) return false;
  // Only unverified user_asserted (or confirmed without derived flag) may enter the event path.
  return input.status === "unverified" || input.status === "confirmed";
}

type FactPromotePlan = {
  kind: "fact";
  fact_id: string;
  source_turn_id: string;
};

type ConstraintPromotePlan = {
  kind: "constraint";
  constraint_id: string;
  source_turn_id: string;
};

type PromotePlan = FactPromotePlan | ConstraintPromotePlan;

/**
 * Build an all-or-nothing Confirmation Event plan.
 * - user_estimate / independently_verified / terminal statuses: ignored (left unchanged)
 * - user_asserted without source_turn_id: fail-closed
 * - event append failure: fail-closed (caller discards tentative events)
 */
function planAndAppendConfirmationEvents(input: {
  session: POJUSessionState;
  before: DecisionContext;
  confirmationTurnId: string;
  now: string;
}): {
  events: ConfirmationEvent[];
  plans: PromotePlan[];
  error?: string;
  newly_appended: number;
} {
  const plans: PromotePlan[] = [];

  for (const f of input.before.reality_facts) {
    if (
      !isUserAssertedUnverifiedCandidate({
        status: f.status,
        verification_level: f.verification_level,
        user_confirmed: f.user_confirmed === true,
      })
    ) {
      continue;
    }
    const source = f.source_turn_id?.trim() ?? "";
    if (!source) {
      return {
        events: [...(input.session.confirmation_events ?? [])],
        plans: [],
        newly_appended: 0,
        error: `missing_source_turn_id:fact:${f.fact_id}`,
      };
    }
    plans.push({ kind: "fact", fact_id: f.fact_id, source_turn_id: source });
  }

  for (const c of input.before.constraints) {
    if (
      !isUserAssertedUnverifiedCandidate({
        status: c.status,
        verification_level: c.verification_level,
        user_confirmed: c.user_confirmed === true,
      })
    ) {
      continue;
    }
    const source = c.source_turn_id?.trim() ?? "";
    if (!source) {
      return {
        events: [...(input.session.confirmation_events ?? [])],
        plans: [],
        newly_appended: 0,
        error: `missing_source_turn_id:constraint:${c.constraint_id}`,
      };
    }
    plans.push({
      kind: "constraint",
      constraint_id: c.constraint_id,
      source_turn_id: source,
    });
  }

  let events = [...(input.session.confirmation_events ?? [])];
  const ctx = {
    session_id: input.session.session_id,
    expected_session_id: input.session.session_id,
    messages: input.session.messages,
    decision_context: input.before,
  };
  let newly_appended = 0;

  for (const plan of plans) {
    if (plan.kind === "fact") {
      if (
        hasUserConfirmEventForTarget(events, {
          type: "fact",
          fact_id: plan.fact_id,
        })
      ) {
        continue;
      }
      const raw = {
        event_id: makeFactConfirmEventId(
          `${plan.fact_id}_${input.confirmationTurnId}`,
        ),
        target_type: "fact" as const,
        fact_id: plan.fact_id,
        source_turn_id: plan.source_turn_id,
        confirmation_turn_id: input.confirmationTurnId,
        confirmation_action_id: `m21_final_confirm_fact_${plan.fact_id}`,
        event_type: "confirm_fact" as const,
        actor: "user" as const,
        confirmed_at: input.now,
        event_version: 1 as const,
      };
      try {
        const appended = appendConfirmationEventWithProvenance(ctx, events, raw);
        events = appended.events;
        if (appended.outcome === "appended") newly_appended += 1;
      } catch (e) {
        return {
          events: [...(input.session.confirmation_events ?? [])],
          plans: [],
          newly_appended: 0,
          error: e instanceof Error ? e.message : String(e),
        };
      }
      continue;
    }

    if (
      hasUserConfirmEventForTarget(events, {
        type: "constraint",
        constraint_id: plan.constraint_id,
      })
    ) {
      continue;
    }
    const raw = {
      event_id: `constraint_confirm_event_${plan.constraint_id}_${input.confirmationTurnId}`,
      target_type: "constraint" as const,
      constraint_id: plan.constraint_id,
      source_turn_id: plan.source_turn_id,
      confirmation_turn_id: input.confirmationTurnId,
      confirmation_action_id: `m21_final_confirm_constraint_${plan.constraint_id}`,
      event_type: "confirm_constraint" as const,
      actor: "user" as const,
      confirmed_at: input.now,
      event_version: 1 as const,
    };
    try {
      const appended = appendConfirmationEventWithProvenance(ctx, events, raw);
      events = appended.events;
      if (appended.outcome === "appended") newly_appended += 1;
    } catch (e) {
      return {
        events: [...(input.session.confirmation_events ?? [])],
        plans: [],
        newly_appended: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return { events, plans, newly_appended };
}

/**
 * Apply legal status promotion ONLY after Confirmation Events exist.
 * user_confirmed is always derived from events — never written as authority true.
 */
function applyLegalPromotionAfterEvents(input: {
  before: DecisionContext;
  events: ConfirmationEvent[];
  now: string;
}): {
  reality_facts: RealityFact[];
  constraints: Constraint[];
  promoted_fact_ids: string[];
  promoted_constraint_ids: string[];
  changed: boolean;
} {
  const promoted_fact_ids: string[] = [];
  const promoted_constraint_ids: string[] = [];
  let changed = false;

  const reality_facts = input.before.reality_facts.map((f) => {
    // Estimates: keep unverified + user_estimate; do not convert via user confirm.
    if (f.verification_level === "user_estimate") {
      return f;
    }
    // Independently verified: never convert via user confirm.
    if (f.verification_level === "independently_verified") {
      return f;
    }
    if (isTerminalNonPromoteStatus(f.status)) {
      return f;
    }
    if (f.verification_level !== "user_asserted") {
      return f;
    }

    const hasEvt = hasUserConfirmEventForTarget(input.events, {
      type: "fact",
      fact_id: f.fact_id,
    });
    if (!hasEvt) {
      // No valid Confirmation Event → never mark user_confirmed.
      if (f.user_confirmed === true) {
        changed = true;
        return { ...f, user_confirmed: false, updated_at: input.now };
      }
      return f;
    }

    const nextStatus: RealityFact["status"] = "confirmed";
    const user_confirmed = deriveUserConfirmedFromEvents({
      status: nextStatus,
      verification_level: "user_asserted",
      events: input.events,
      target: { type: "fact", fact_id: f.fact_id },
    });

    if (
      f.status === nextStatus &&
      f.verification_level === "user_asserted" &&
      f.user_confirmed === user_confirmed
    ) {
      return f;
    }

    if (user_confirmed === true && f.user_confirmed !== true) {
      promoted_fact_ids.push(f.fact_id);
    }
    changed = true;
    return {
      ...f,
      status: nextStatus,
      verification_level: "user_asserted" as const,
      user_confirmed,
      updated_at: input.now,
    };
  });

  const constraints = input.before.constraints.map((c) => {
    if (c.verification_level === "user_estimate") {
      return c;
    }
    if (c.verification_level === "independently_verified") {
      return c;
    }
    if (isTerminalNonPromoteStatus(c.status)) {
      return c;
    }
    if (c.verification_level !== "user_asserted") {
      return c;
    }

    const hasEvt = hasUserConfirmEventForTarget(input.events, {
      type: "constraint",
      constraint_id: c.constraint_id,
    });
    if (!hasEvt) {
      if (c.user_confirmed === true) {
        changed = true;
        return { ...c, user_confirmed: false, updated_at: input.now };
      }
      return c;
    }

    const nextStatus: Constraint["status"] = "confirmed";
    const user_confirmed = deriveUserConfirmedFromEvents({
      status: nextStatus,
      verification_level: "user_asserted",
      events: input.events,
      target: { type: "constraint", constraint_id: c.constraint_id },
    });

    if (
      c.status === nextStatus &&
      c.verification_level === "user_asserted" &&
      c.user_confirmed === user_confirmed
    ) {
      return c;
    }

    if (user_confirmed === true && c.user_confirmed !== true) {
      promoted_constraint_ids.push(c.constraint_id);
    }
    changed = true;
    return {
      ...c,
      status: nextStatus,
      verification_level: "user_asserted" as const,
      user_confirmed,
      updated_at: input.now,
    };
  });

  return {
    reality_facts,
    constraints,
    promoted_fact_ids,
    promoted_constraint_ids,
    changed,
  };
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

  // 1) Events first (all-or-nothing). No in-memory promotions before events succeed.
  const built = planAndAppendConfirmationEvents({
    session: input.session,
    before: dc,
    confirmationTurnId: input.confirmation_turn_id,
    now,
  });
  if (built.error) {
    return {
      session: input.session,
      outcome: "promote_failed",
      sufficiency_can_stop: false,
      error: built.error,
      promoted_fact_ids: [],
      promoted_constraint_ids: [],
    };
  }

  // 2) Derive status + user_confirmed from events only.
  const applied = applyLegalPromotionAfterEvents({
    before: dc,
    events: built.events,
    now,
  });

  const versionBump = applied.changed || built.newly_appended > 0;
  let working: POJUSessionState = {
    ...input.session,
    confirmation_events: built.events,
    decision_context: {
      ...dc,
      reality_facts: applied.reality_facts,
      constraints: applied.constraints,
      updated_at: versionBump ? now : dc.updated_at,
      version: versionBump ? (dc.version ?? 1) + 1 : dc.version,
    },
  };

  const dirs = await reaggregateDirsOnSession(working, working.decision_context!.dirs, {
    realityFacts: applied.reality_facts,
    constraints: applied.constraints,
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
        promoted_fact_ids: [],
        promoted_constraint_ids: [],
      };
    }
    return {
      session: persisted.session,
      outcome: "not_sufficient_after_confirm",
      sufficiency_can_stop: false,
      error: sufficiency.reasons.join(";"),
      promoted_fact_ids: applied.promoted_fact_ids,
      promoted_constraint_ids: applied.promoted_constraint_ids,
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
      promoted_fact_ids: [],
      promoted_constraint_ids: [],
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
      promoted_fact_ids: applied.promoted_fact_ids,
      promoted_constraint_ids: applied.promoted_constraint_ids,
    };
  }
  if (freeze.skipped) {
    return {
      session: freeze.session,
      outcome: "not_sufficient_after_confirm",
      sufficiency_can_stop: false,
      freeze,
      error: freeze.reason,
      promoted_fact_ids: applied.promoted_fact_ids,
      promoted_constraint_ids: applied.promoted_constraint_ids,
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
    promoted_fact_ids: applied.promoted_fact_ids,
    promoted_constraint_ids: applied.promoted_constraint_ids,
  };
}
