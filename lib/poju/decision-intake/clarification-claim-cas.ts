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
import { claimClarification } from "./budget-ledger";

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

/**
 * Business reject (allowance exhausted / already confirmed): keep the working
 * turn's in-flight fields, but never stamp current.revision onto a Session whose
 * budget/claims still reflect the pre-read working copy. Authoritative budget is
 * the sole source for ledger + claims at that revision.
 */
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
  if (!workUnderstanding) {
    return {
      ...working,
      session_revision: revision,
      decision_understanding: authUnderstanding,
    };
  }
  return {
    ...working,
    session_revision: revision,
    decision_understanding: {
      ...workUnderstanding,
      budget: authUnderstanding.budget,
      last_sent_question:
        authUnderstanding.last_sent_question ?? workUnderstanding.last_sent_question,
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
