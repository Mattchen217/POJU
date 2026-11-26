/**
 * CAS-atomic clarification allowance claims against the authoritative Session record.
 * Local-only / unit tests (no session_id) use in-memory claimClarification.
 * Authoritative sessions with a session_id always fail closed — never fall back to memory.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import {
  SessionPersistenceUnavailableError,
  getSessionAuthorityStore,
} from "@/lib/poju/session-authority/store";
import {
  SessionAuthorityError,
  applyServerExpiryToSnapshot,
  associationsFromSnapshot,
  hashSessionSnapshot,
  requireAuthoritativeSession,
} from "@/lib/poju/session-authority/lifecycle";
import type { ServerSessionRecord } from "@/lib/poju/session-authority/types";
import { noteAuthoritativeSessionCasRevision } from "@/lib/poju/session-authority/authoritative-revision-anchor";
import { claimClarification, GLOBAL_CORE_SPENT_CEILING } from "./budget-ledger";

const CAS_RETRY_MAX = 8;

export type ReserveClarificationClaimCasInput = {
  session: POJUSessionState;
  plan_id: string;
  now: string;
  /** Test-only override of the reserve path (real store tests leave this unset). */
  casReserve?: (input: ReserveClarificationClaimCasInput) => Promise<ReserveClarificationClaimCasResult>;
};

export type ReserveClarificationClaimCasResult = {
  ok: boolean;
  session: POJUSessionState;
  block_reason?: string;
};

function inMemoryReserveClarificationClaim(
  session: POJUSessionState,
  plan_id: string,
  now: string,
): ReserveClarificationClaimCasResult {
  const understanding = session.decision_understanding;
  if (!understanding?.budget) {
    return {
      ok: false,
      session,
      block_reason: "missing_decision_understanding",
    };
  }
  const claim = claimClarification(understanding.budget, plan_id, now);
  if (!claim.ok) {
    return {
      ok: false,
      session,
      block_reason:
        claim.reason === "already_confirmed"
          ? "already_confirmed"
          : "clarification_allowance_exhausted",
    };
  }
  return {
    ok: true,
    session: {
      ...session,
      decision_understanding: {
        ...understanding,
        budget: claim.budget,
      },
    },
  };
}

function authoritativeClaimBlockReason(reason?: string): string {
  if (reason === "already_confirmed") return "already_confirmed";
  return "clarification_allowance_exhausted";
}

function buildRecordWithSnapshot(
  current: ServerSessionRecord,
  snapshot: POJUSessionState,
  now: string,
): ServerSessionRecord {
  const merged = applyServerExpiryToSnapshot(snapshot, {
    session_id: current.session_id,
    expires_at: current.expires_at,
    created_at: current.created_at,
    revision: current.revision + 1,
    session_generation: current.session_generation,
  });
  merged.session_id = current.session_id;
  merged.session_revision = current.revision + 1;
  merged.expires_at = current.expires_at;
  return {
    ...current,
    v: current.v,
    session_id: current.session_id,
    session_generation: current.session_generation,
    revision: current.revision + 1,
    updated_at: now,
    expires_at: current.expires_at,
    lifecycle_status: "active",
    snapshot_hash: hashSessionSnapshot(merged),
    session_snapshot: merged,
    last_committed_turn_id: current.last_committed_turn_id,
    ...associationsFromSnapshot(merged),
  };
}

function overlayClaimOntoWorkingSession(
  working: POJUSessionState,
  claimedBudget: NonNullable<
    NonNullable<POJUSessionState["decision_understanding"]>["budget"]
  >,
  revision: number,
): POJUSessionState {
  const understanding = working.decision_understanding;
  if (!understanding?.budget) {
    return {
      ...working,
      session_revision: revision,
    };
  }
  return {
    ...working,
    session_revision: revision,
    decision_understanding: {
      ...understanding,
      budget: {
        ...understanding.budget,
        clarification_allowance: claimedBudget.clarification_allowance,
        clarification_claims: claimedBudget.clarification_claims,
        clarification_rounds: claimedBudget.clarification_rounds,
      },
    },
  };
}

type BudgetSnap = NonNullable<
  NonNullable<POJUSessionState["decision_understanding"]>["budget"]
>;

/**
 * Same ledger rule as budget-ledger counterLedgerConsistent:
 * core_effective_answer_rounds === min(turnIds.length, GLOBAL_CORE_SPENT_CEILING).
 */
function coreLedgerConsistent(budget: BudgetSnap): boolean {
  const core = budget.core_effective_answer_rounds ?? 0;
  const turns = budget.core_counted_source_turn_ids ?? [];
  return core === Math.min(turns.length, GLOBAL_CORE_SPENT_CEILING);
}

function authIdListPreservedInWork(
  workIds: string[] | undefined,
  authIds: string[] | undefined,
): boolean {
  const auth = authIds ?? [];
  if (!auth.length) return true;
  const work = new Set(workIds ?? []);
  return auth.every((id) => work.has(id));
}

function authTurnIdsPreservedInWork(work: BudgetSnap, auth: BudgetSnap): boolean {
  return authIdListPreservedInWork(
    work.core_counted_source_turn_ids,
    auth.core_counted_source_turn_ids,
  );
}

function authEventIdsPreservedInWork(work: BudgetSnap, auth: BudgetSnap): boolean {
  return authIdListPreservedInWork(
    work.core_counted_answer_event_ids,
    auth.core_counted_answer_event_ids,
  );
}

function workingLedgerPreservesAuthProvenance(
  work: BudgetSnap,
  auth: BudgetSnap,
): boolean {
  return (
    authTurnIdsPreservedInWork(work, auth) && authEventIdsPreservedInWork(work, auth)
  );
}

/**
 * Business reject merge (field-scoped):
 * - Base budget → authoritative (asked/remaining/depth/complexity stay concurrent-safe).
 * - Clarification claims / allowance / rounds → authoritative.
 * - Core ledger only → overlay working when workCore > authCore and the working
 *   ledger is consistent and preserves authoritative turn + event provenance.
 * - Equal core: prefer longer working turn-id lists only when both ledgers are
 *   consistent and working retains every authoritative turn/event id.
 * - last_sent_question handled by caller (authoritative, including null).
 */
function mergeBudgetFieldsOnReject(work: BudgetSnap, auth: BudgetSnap): BudgetSnap {
  const workCore = work.core_effective_answer_rounds ?? 0;
  const authCore = auth.core_effective_answer_rounds ?? 0;

  const clarificationAuthority = {
    clarification_allowance: auth.clarification_allowance,
    clarification_claims: auth.clarification_claims,
    clarification_rounds: auth.clarification_rounds,
  };

  const base: BudgetSnap = {
    ...auth,
    ...clarificationAuthority,
  };

  if (workCore > authCore) {
    if (
      !coreLedgerConsistent(work) ||
      !workingLedgerPreservesAuthProvenance(work, auth)
    ) {
      // Unproven / provenance-breaking this-turn core — keep authoritative budget.
      return base;
    }
    return {
      ...base,
      core_effective_answer_rounds: work.core_effective_answer_rounds,
      core_counted_source_turn_ids: work.core_counted_source_turn_ids,
      core_counted_answer_event_ids: work.core_counted_answer_event_ids,
    };
  }

  const workIds = work.core_counted_source_turn_ids ?? [];
  const authIds = auth.core_counted_source_turn_ids ?? [];
  const preferWorkLedger =
    workCore === authCore &&
    workIds.length > authIds.length &&
    coreLedgerConsistent(work) &&
    coreLedgerConsistent(auth) &&
    workingLedgerPreservesAuthProvenance(work, auth);

  if (!preferWorkLedger) return base;

  return {
    ...base,
    core_counted_source_turn_ids: work.core_counted_source_turn_ids,
    core_counted_answer_event_ids: work.core_counted_answer_event_ids,
  };
}

function mergeAuthoritativeBudgetOnReject(
  working: POJUSessionState,
  authoritative: POJUSessionState,
  revision: number,
): POJUSessionState {
  const authUnderstanding = authoritative.decision_understanding;
  const workUnderstanding = working.decision_understanding;
  if (!authUnderstanding?.budget) {
    // Cannot safely represent current.revision without authoritative budget.
    return working;
  }
  if (!workUnderstanding?.budget) {
    return {
      ...working,
      session_revision: revision,
      decision_understanding: {
        ...authUnderstanding,
        last_sent_question: authUnderstanding.last_sent_question ?? null,
      },
    };
  }
  return {
    ...working,
    session_revision: revision,
    decision_understanding: {
      ...workUnderstanding,
      budget: mergeBudgetFieldsOnReject(workUnderstanding.budget, authUnderstanding.budget),
      // Authoritative null must clear working residue — never `?? work`.
      last_sent_question: authUnderstanding.last_sent_question ?? null,
    },
  };
}

function failClosedFromError(error: unknown, session: POJUSessionState): never {
  if (error instanceof SessionAuthorityError) {
    throw error;
  }
  if (error instanceof SessionPersistenceUnavailableError) {
    throw new SessionAuthorityError("server_persistence_unavailable", error.message, {
      session_id: session.session_id,
      recoverable: /timed out|BUSY|SCRIPT/i.test(error.message),
    });
  }
  throw error;
}

async function defaultAuthoritativeReserve(
  input: ReserveClarificationClaimCasInput,
): Promise<ReserveClarificationClaimCasResult> {
  const sessionId = input.session.session_id?.trim();
  // Local-only / unit tests: no authoritative session id → in-memory claim only.
  if (!sessionId) {
    return inMemoryReserveClarificationClaim(input.session, input.plan_id, input.now);
  }

  const store = getSessionAuthorityStore();
  for (let attempt = 0; attempt < CAS_RETRY_MAX; attempt += 1) {
    let current: ServerSessionRecord;
    try {
      current = await requireAuthoritativeSession(sessionId);
    } catch (error) {
      failClosedFromError(error, input.session);
    }

    const snap = current.session_snapshot;
    const understanding = snap.decision_understanding;
    if (!understanding?.budget) {
      return {
        ok: false,
        session: input.session,
        block_reason: "missing_decision_understanding",
      };
    }

    const existingClaim = understanding.budget.clarification_claims?.find(
      (c) => c.plan_id === input.plan_id,
    );
    // Idempotent re-reserve of an open claim: keep current revision (no second CAS bump).
    if (existingClaim?.status === "claimed") {
      noteAuthoritativeSessionCasRevision(current.revision);
      return {
        ok: true,
        session: overlayClaimOntoWorkingSession(
          input.session,
          understanding.budget,
          current.revision,
        ),
      };
    }

    const claim = claimClarification(understanding.budget, input.plan_id, input.now);
    if (!claim.ok) {
      return {
        ok: false,
        session: mergeAuthoritativeBudgetOnReject(
          input.session,
          snap,
          current.revision,
        ),
        block_reason: authoritativeClaimBlockReason(claim.reason),
      };
    }

    const nextSnapshot: POJUSessionState = {
      ...snap,
      decision_understanding: {
        ...understanding,
        budget: claim.budget,
      },
    };
    const next = buildRecordWithSnapshot(current, nextSnapshot, input.now);

    let casResult;
    try {
      casResult = await store.compareAndSetDetailed(sessionId, current.revision, next, {
        intakeCommit: true,
        nowIso: input.now,
      });
    } catch (error) {
      failClosedFromError(error, input.session);
    }

    if (casResult.ok) {
      // Server Authority CAS succeeded — advance the request-scoped authoritative anchor.
      noteAuthoritativeSessionCasRevision(next.revision);
      // Keep the caller's in-flight turn state; only overlay the CAS claim + new revision.
      return {
        ok: true,
        session: overlayClaimOntoWorkingSession(input.session, claim.budget, next.revision),
      };
    }
    if (casResult.reason === "cas_conflict" || casResult.reason === "missing") {
      continue;
    }
    return {
      ok: false,
      session: input.session,
      block_reason: "clarification_claim_cas_exhausted",
    };
  }

  return {
    ok: false,
    session: input.session,
    block_reason: "clarification_claim_cas_exhausted",
  };
}

export async function reserveClarificationClaimCas(
  input: ReserveClarificationClaimCasInput,
): Promise<ReserveClarificationClaimCasResult> {
  if (input.casReserve) {
    return input.casReserve(input);
  }
  return defaultAuthoritativeReserve(input);
}
