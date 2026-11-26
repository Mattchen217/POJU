/**
 * CAS-atomic clarification allowance claims against the authoritative Session record.
 * When no server session / store is available, falls back to in-memory claimClarification
 * on the passed session (unit tests and local-only runs).
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

function shouldFallbackToInMemory(error: unknown): boolean {
  if (error instanceof SessionPersistenceUnavailableError) return true;
  if (error instanceof SessionAuthorityError) {
    return error.code === "session_not_found" || error.code === "server_persistence_unavailable";
  }
  return false;
}

async function defaultAuthoritativeReserve(
  input: ReserveClarificationClaimCasInput,
): Promise<ReserveClarificationClaimCasResult> {
  const sessionId = input.session.session_id?.trim();
  if (!sessionId) {
    return inMemoryReserveClarificationClaim(input.session, input.plan_id, input.now);
  }

  const store = getSessionAuthorityStore();
  for (let attempt = 0; attempt < CAS_RETRY_MAX; attempt += 1) {
    let current: ServerSessionRecord;
    try {
      current = await requireAuthoritativeSession(sessionId);
    } catch (error) {
      if (shouldFallbackToInMemory(error)) {
        return inMemoryReserveClarificationClaim(input.session, input.plan_id, input.now);
      }
      throw error;
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

    const claim = claimClarification(understanding.budget, input.plan_id, input.now);
    if (!claim.ok) {
      return {
        ok: false,
        session: snap,
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
      if (shouldFallbackToInMemory(error)) {
        return inMemoryReserveClarificationClaim(input.session, input.plan_id, input.now);
      }
      throw error;
    }

    if (casResult.ok) {
      return {
        ok: true,
        session: {
          ...nextSnapshot,
          session_revision: next.revision,
        },
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