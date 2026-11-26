/**
 * CAS-atomic clarification allowance claims against the authoritative Session record.
 * Local-only / unit tests (no session_id) use in-memory claimClarification.
 * Authoritative sessions with a session_id always fail closed — never fall back to memory.
 *
 * Request-scoped reservation notes let the authoritative chat turn durable-release
 * claims on definite abort / commit failure without guessing concurrent claims.
 */

import { AsyncLocalStorage } from "node:async_hooks";

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
import {
  claimClarification,
  GLOBAL_CORE_SPENT_CEILING,
  releaseClarification,
} from "./budget-ledger";

const CAS_RETRY_MAX = 8;

/** Ownership proof for a claim this request newly acquired (plan_id + claimed_at). */
export type ClarificationClaimReservation = {
  plan_id: string;
  claimed_at: string;
};

type ClarificationClaimRequestFrame = {
  reservations: ClarificationClaimReservation[];
};

const clarificationClaimRequestAls =
  new AsyncLocalStorage<ClarificationClaimRequestFrame>();

export function runWithClarificationClaimRequestScope<T>(
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(
    clarificationClaimRequestAls.run({ reservations: [] }, fn),
  );
}

export function noteClarificationClaimReserved(
  reservation: ClarificationClaimReservation,
): void {
  const frame = clarificationClaimRequestAls.getStore();
  if (!frame) return;
  const plan_id = reservation.plan_id.trim();
  const claimed_at = reservation.claimed_at.trim();
  if (!plan_id || !claimed_at) return;
  const existing = frame.reservations.find((r) => r.plan_id === plan_id);
  if (existing) {
    existing.claimed_at = claimed_at;
    return;
  }
  frame.reservations.push({ plan_id, claimed_at });
}

export function listClarificationClaimReservationsThisRequest(): ClarificationClaimReservation[] {
  const frame = clarificationClaimRequestAls.getStore();
  return frame ? frame.reservations.map((r) => ({ ...r })) : [];
}

/** @deprecated Use listClarificationClaimReservationsThisRequest — plan_id alone is not ownership. */
export function listClarificationClaimsReservedThisRequest(): string[] {
  return listClarificationClaimReservationsThisRequest().map((r) => r.plan_id);
}

export function clearClarificationClaimsReservedThisRequest(): void {
  const frame = clarificationClaimRequestAls.getStore();
  if (frame) frame.reservations.length = 0;
}

function thisRequestOwnsClaim(plan_id: string, claimed_at: string): boolean {
  const frame = clarificationClaimRequestAls.getStore();
  if (!frame) return false;
  return frame.reservations.some(
    (r) => r.plan_id === plan_id && r.claimed_at === claimed_at,
  );
}

function forgetClarificationClaimReserved(plan_id: string): void {
  const frame = clarificationClaimRequestAls.getStore();
  if (!frame) return;
  frame.reservations = frame.reservations.filter((r) => r.plan_id !== plan_id);
}

function claimedAtFromBudget(
  budget: NonNullable<
    NonNullable<POJUSessionState["decision_understanding"]>["budget"]
  >,
  plan_id: string,
): string | null {
  const claim = budget.clarification_claims?.find((c) => c.plan_id === plan_id);
  const at = claim?.claimed_at?.trim();
  return at || null;
}

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
  /** Present only when this request newly owns (or already owns) the reservation. */
  reservation?: ClarificationClaimReservation;
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
  const existing = understanding.budget.clarification_claims?.find(
    (c) => c.plan_id === plan_id,
  );
  if (existing?.status === "claimed") {
    if (thisRequestOwnsClaim(plan_id, existing.claimed_at)) {
      const reservation = { plan_id, claimed_at: existing.claimed_at };
      return { ok: true, session, reservation };
    }
    return {
      ok: false,
      session,
      block_reason: "clarification_claim_held",
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
  const claimed_at = claimedAtFromBudget(claim.budget, plan_id);
  if (!claimed_at) {
    return {
      ok: false,
      session,
      block_reason: "missing_claim_provenance",
    };
  }
  const reservation = { plan_id, claimed_at };
  noteClarificationClaimReserved(reservation);
  return {
    ok: true,
    reservation,
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
    // Already claimed: only the owning request may treat this as idempotent success.
    // A concurrent request that merely observes the claim must NOT gain ownership.
    if (existingClaim?.status === "claimed") {
      noteAuthoritativeSessionCasRevision(current.revision);
      if (thisRequestOwnsClaim(input.plan_id, existingClaim.claimed_at)) {
        const reservation = {
          plan_id: input.plan_id,
          claimed_at: existingClaim.claimed_at,
        };
        return {
          ok: true,
          reservation,
          session: overlayClaimOntoWorkingSession(
            input.session,
            understanding.budget,
            current.revision,
          ),
        };
      }
      return {
        ok: false,
        session: mergeAuthoritativeBudgetOnReject(
          input.session,
          snap,
          current.revision,
        ),
        block_reason: "clarification_claim_held",
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
      const claimed_at = claimedAtFromBudget(claim.budget, input.plan_id);
      if (!claimed_at) {
        return {
          ok: false,
          session: input.session,
          block_reason: "missing_claim_provenance",
        };
      }
      const reservation = { plan_id: input.plan_id, claimed_at };
      noteClarificationClaimReserved(reservation);
      // Keep the caller's in-flight turn state; only overlay the CAS claim + new revision.
      return {
        ok: true,
        reservation,
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

export type ReleaseClarificationClaimCasInput = {
  session: POJUSessionState;
  plan_id: string;
  now: string;
  /**
   * Ownership proof from the successful reserve (must match durable claim.claimed_at).
   * Required for authoritative release — plan_id alone is not sufficient.
   */
  claimed_at: string;
  /**
   * When set, only release if the durable claim's send_event_id matches
   * (or the durable claim has no send_event_id yet — pre-send reservation).
   */
  send_event_id?: string;
  /** Test-only override. */
  casRelease?: (
    input: ReleaseClarificationClaimCasInput,
  ) => Promise<ReleaseClarificationClaimCasResult>;
};

export type ReleaseClarificationClaimCasResult = {
  ok: boolean;
  session: POJUSessionState;
  block_reason?: string;
};

function inMemoryReleaseClarificationClaim(
  session: POJUSessionState,
  plan_id: string,
  now: string,
  claimed_at: string,
): ReleaseClarificationClaimCasResult {
  const understanding = session.decision_understanding;
  if (!understanding?.budget) {
    return { ok: false, session, block_reason: "missing_decision_understanding" };
  }
  const existing = understanding.budget.clarification_claims?.find(
    (c) => c.plan_id === plan_id,
  );
  if (existing?.status === "confirmed") {
    return { ok: false, session, block_reason: "already_confirmed" };
  }
  if (existing && existing.claimed_at !== claimed_at) {
    return { ok: false, session, block_reason: "reservation_ownership_mismatch" };
  }
  const requestFrame = clarificationClaimRequestAls.getStore();
  if (requestFrame && !thisRequestOwnsClaim(plan_id, claimed_at)) {
    return { ok: false, session, block_reason: "reservation_ownership_mismatch" };
  }
  if (existing?.status === "released") {
    forgetClarificationClaimReserved(plan_id);
    return { ok: true, session };
  }
  const budget = releaseClarification(understanding.budget, plan_id, now);
  forgetClarificationClaimReserved(plan_id);
  return {
    ok: true,
    session: {
      ...session,
      decision_understanding: { ...understanding, budget },
    },
  };
}

async function defaultAuthoritativeRelease(
  input: ReleaseClarificationClaimCasInput,
): Promise<ReleaseClarificationClaimCasResult> {
  const claimedAt = input.claimed_at?.trim();
  if (!claimedAt) {
    return {
      ok: false,
      session: input.session,
      block_reason: "missing_reservation_ownership",
    };
  }

  const sessionId = input.session.session_id?.trim();
  if (!sessionId) {
    return inMemoryReleaseClarificationClaim(
      input.session,
      input.plan_id,
      input.now,
      claimedAt,
    );
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

    const existing = understanding.budget.clarification_claims?.find(
      (c) => c.plan_id === input.plan_id,
    );
    if (!existing) {
      noteAuthoritativeSessionCasRevision(current.revision);
      forgetClarificationClaimReserved(input.plan_id);
      return {
        ok: true,
        session: overlayClaimOntoWorkingSession(
          input.session,
          understanding.budget,
          current.revision,
        ),
      };
    }

    // Ownership: durable claimed_at must match the reservation proof from reserve.
    if (existing.claimed_at !== claimedAt) {
      return {
        ok: false,
        session: mergeAuthoritativeBudgetOnReject(
          input.session,
          snap,
          current.revision,
        ),
        block_reason: "reservation_ownership_mismatch",
      };
    }
    // Inside a chat request scope, only the reserving request may release —
    // observing claimed_at on the authoritative snapshot is not ownership.
    const requestFrame = clarificationClaimRequestAls.getStore();
    if (requestFrame && !thisRequestOwnsClaim(input.plan_id, claimedAt)) {
      return {
        ok: false,
        session: mergeAuthoritativeBudgetOnReject(
          input.session,
          snap,
          current.revision,
        ),
        block_reason: "reservation_ownership_mismatch",
      };
    }

    if (existing.status === "released") {
      noteAuthoritativeSessionCasRevision(current.revision);
      forgetClarificationClaimReserved(input.plan_id);
      return {
        ok: true,
        session: overlayClaimOntoWorkingSession(
          input.session,
          understanding.budget,
          current.revision,
        ),
      };
    }
    if (existing.status === "confirmed") {
      return {
        ok: false,
        session: mergeAuthoritativeBudgetOnReject(
          input.session,
          snap,
          current.revision,
        ),
        block_reason: "already_confirmed",
      };
    }

    if (
      input.send_event_id &&
      existing.send_event_id &&
      existing.send_event_id !== input.send_event_id
    ) {
      return {
        ok: false,
        session: mergeAuthoritativeBudgetOnReject(
          input.session,
          snap,
          current.revision,
        ),
        block_reason: "send_event_mismatch",
      };
    }

    const releasedBudget = releaseClarification(
      understanding.budget,
      input.plan_id,
      input.now,
    );
    const nextSnapshot: POJUSessionState = {
      ...snap,
      decision_understanding: {
        ...understanding,
        budget: releasedBudget,
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
      noteAuthoritativeSessionCasRevision(next.revision);
      forgetClarificationClaimReserved(input.plan_id);
      return {
        ok: true,
        session: overlayClaimOntoWorkingSession(
          input.session,
          releasedBudget,
          next.revision,
        ),
      };
    }
    if (casResult.reason === "cas_conflict" || casResult.reason === "missing") {
      continue;
    }
    return {
      ok: false,
      session: input.session,
      block_reason: "clarification_release_cas_exhausted",
    };
  }

  return {
    ok: false,
    session: input.session,
    block_reason: "clarification_release_cas_exhausted",
  };
}

export async function releaseClarificationClaimCas(
  input: ReleaseClarificationClaimCasInput,
): Promise<ReleaseClarificationClaimCasResult> {
  if (input.casRelease) {
    return input.casRelease(input);
  }
  return defaultAuthoritativeRelease(input);
}

/**
 * Definite failures may durable-release this-request reservations.
 * Uncertain persistence outcomes must keep the claim for reconcile.
 */
export function isDefiniteClarificationReleaseFailure(error: unknown): boolean {
  if (error === "aborted") return true;
  if (!error) return false;
  if (typeof error === "object" && (error as { name?: string }).name === "AbortError") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("abort") || message.includes("AbortError")) return true;
  if (error instanceof SessionAuthorityError) {
    // Timed-out / BUSY CAS: may or may not have landed — keep claim for reconcile.
    if (error.code === "server_persistence_unavailable") return false;
    return true;
  }
  if (error instanceof SessionPersistenceUnavailableError) return false;
  // Any other definite request failure (no successful durable commit of this turn).
  return true;
}
