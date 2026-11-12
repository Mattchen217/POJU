/**
 * M5-R1 — charge authorization for Decision Intake 2.0 reports (server).
 *
 * One pivot pass per session. The authorization record (durable, per session) is the
 * only proof of payment the report chain accepts — a job's existence is not:
 *
 *   (none) ──claim──▶ pending ──charge ok──────────▶ authorized   (terminal)
 *                        │    ──charge refused─────▶ refused ──abort claim──▶ abort_claimed
 *                        │    ──charge unknown─────▶ uncertain    (reconciled by re-claim)
 *                        └── claim older than CLAIM_MS: abandoned, re-claimable
 *
 *   refused         a later start may re-claim it (then the refusal's abort is lost to it)
 *   abort_claimed   owned by the refusal's abort of one job (`abort_job_id`), claimed under
 *                   the claimant's session lock (`abort_lock_*`): no claim, no charge, no
 *                   run for the session until that abort is finished; abandoned past the
 *                   window, it is resumed only by whoever takes the resume right (CAS)
 *   abort_completed the refused job is terminated; a later start re-claims (same ref)
 *
 * Every transition is a compare-and-set on the exact record, so two requests can
 * never both hold a claim, and a claimant whose claim was taken over (its attempt_id is
 * no longer the record's) can neither write its outcome nor act on it. A refusal stops
 * a job only through the `refused → abort_claimed` CAS, which a re-claim of the same
 * record excludes. `charge_ref` (the pass ledger idempotency ref) is fixed at the first
 * claim and reused by every later attempt: a reconcile of a charge whose outcome was
 * lost (RPC error, record write failure, killed invoke) returns `already_consumed`
 * instead of debiting again.
 *
 * A job runs only under an execution grant: written for that job (id, session,
 * generation) once its session is authorized, re-checked by the worker at entry and
 * before every checkpoint, deleted when the job is aborted.
 *
 * A job's report is served only under its own durable delivery authorization (job,
 * session, generation, charge ref), recorded when it is granted and sealed at commit;
 * a refusal abort revokes it permanently. See `verifyDecisionReportDelivery`.
 */

import { durableKv, kv, KV_TTL } from "@/lib/kv/client";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";

const RETENTION = KV_TTL.DECISION_AUTHORITY_RETENTION;
const GRANT_TTL = KV_TTL.POJU_XHIGH_JOB;

/** A claim older than this is abandoned (its request died mid-charge) and may be re-claimed. */
export const DI2_CHARGE_CLAIM_MS = 60_000;
/** A refusal abort claim older than this was abandoned mid-abort; any request may resume it. */
export const DI2_ABORT_CLAIM_MS = DI2_CHARGE_CLAIM_MS;

export type DecisionReportChargeResult =
  | { ok: true }
  | { ok: false; response: Response; uncertain?: boolean };

export type DecisionReportCharge = (input: {
  sessionId: string;
  question: string;
  jointPassRef: string | null;
}) => Promise<DecisionReportChargeResult>;

export type ChargeAuthorizationState =
  | "pending"
  | "authorized"
  | "refused"
  | "uncertain"
  | "abort_claimed"
  | "abort_completed";

export type ChargeAuthorization = {
  version: 1;
  session_id: string;
  state: ChargeAuthorizationState;
  /** Pass ledger idempotency ref (joint ref or session id), fixed at the first claim. */
  charge_ref: string;
  joint_pass_ref: string | null;
  /** Usage label for the pass ledger. */
  question: string;
  /** The request holding (or last holding) the claim. */
  attempt_id: string;
  claimed_at: number;
  attempts: number;
  reason: string | null;
  updated_at: number;
  authorized_at: number | null;
  /** The one job a refusal's abort terminates (set by the `refused → abort_claimed` CAS). */
  abort_job_id?: string | null;
  /** Identity of that abort claim; the completion CAS is bound to it. */
  abort_attempt_id?: string | null;
  abort_claimed_at?: number | null;
  abort_completed_at?: number | null;
  /**
   * The session lock the abort was claimed under (the claimant start's owner identity).
   * Its release step deletes only this lock; null on pre-FU3 records (never deleted).
   */
  abort_lock_token?: string | null;
  abort_lock_owner_attempt_id?: string | null;
  /** Last request that took the resume right of an abandoned abort (CAS on the record). */
  abort_resumer_id?: string | null;
  abort_resumed_at?: number | null;
};

export type ChargeSettlement =
  | { state: "authorized"; record: ChargeAuthorization }
  /** Another request holds a live claim; nothing may run until it resolves. */
  | { state: "pending"; record: ChargeAuthorization }
  /**
   * The current record is `refused`. `record.attempt_id` names the attempt that recorded
   * it; `response` is the pass refusal when that attempt was this call's.
   */
  | { state: "refused"; record: ChargeAuthorization; response: Response | null }
  /**
   * This call's claim was taken over (its attempt_id is no longer the record's) before it
   * could record its outcome. Its own result decides nothing: the current claimant's does.
   */
  | { state: "stale_claim"; record: ChargeAuthorization }
  /**
   * A refusal's abort owns the session (`record.abort_job_id`): nothing may be claimed,
   * charged or run until that abort is finished.
   */
  | { state: "abort_in_progress"; record: ChargeAuthorization }
  /** Outcome unknown (or not recorded); the next claim reconciles with the same ref. */
  | { state: "uncertain"; reason: string }
  /** No record and this caller may not open a charge. */
  | { state: "required" };

const NO_ABORT = {
  abort_job_id: null,
  abort_attempt_id: null,
  abort_claimed_at: null,
  abort_completed_at: null,
  abort_lock_token: null,
  abort_lock_owner_attempt_id: null,
  abort_resumer_id: null,
  abort_resumed_at: null,
} as const satisfies Partial<ChargeAuthorization>;

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

export function di2ChargeAuthorizationKey(session_id: string): string {
  return `poju-di2:charge-auth:${safe(session_id)}`;
}

export function di2ExecutionGrantKey(job_id: string): string {
  return `poju-di2:exec-grant:${safe(job_id)}`;
}

type CasKv = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => Promise<"OK" | null | unknown>;
  compareAndSetExact?: (key: string, expectedJson: string | null, next: unknown, opts?: { ex?: number }) => Promise<boolean>;
  eval?: (script: string, keys: string[], args: string[]) => Promise<unknown>;
};

/** Lua: SET only when the current raw value equals ARGV[1]. */
const CAS_EXACT_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if type(raw) ~= 'string' then raw = tostring(raw) end
if raw ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

function store(): CasKv {
  return durableKv() as unknown as CasKv;
}

export async function loadChargeAuthorization(session_id: string): Promise<ChargeAuthorization | null> {
  const got = await store().get<ChargeAuthorization>(di2ChargeAuthorizationKey(session_id));
  return got && typeof got === "object" && got.session_id === session_id ? got : null;
}

/** Exact-value CAS on any durable key (null = must be absent). */
async function casExact(key: string, expected: unknown | null, next: unknown, ttl: number): Promise<boolean> {
  const s = store();
  if (expected === null) return (await s.set(key, next, { ex: ttl, nx: true })) === "OK";
  const expectedJson = JSON.stringify(expected);
  if (typeof s.compareAndSetExact === "function") {
    return s.compareAndSetExact(key, expectedJson, next, { ex: ttl });
  }
  if (typeof s.eval === "function") {
    const r = await s.eval(CAS_EXACT_LUA, [key], [expectedJson, JSON.stringify(next), String(ttl)]);
    return r === 1 || r === true;
  }
  throw new Error(`durable CAS unavailable for ${key}`);
}

/** Replace `expected` (null = absent) with `next`, atomically. */
async function casAuthorization(
  session_id: string,
  expected: ChargeAuthorization | null,
  next: ChargeAuthorization,
  ttl: number = RETENTION,
): Promise<boolean> {
  return casExact(di2ChargeAuthorizationKey(session_id), expected, next, ttl);
}

async function chargeUnderClaim(claim: ChargeAuthorization, charge: DecisionReportCharge): Promise<ChargeSettlement> {
  let state: ChargeAuthorizationState;
  let reason: string | null = null;
  let response: Response | null = null;
  try {
    const r = await charge({
      sessionId: claim.session_id,
      question: claim.question,
      jointPassRef: claim.joint_pass_ref,
    });
    if (r.ok) state = "authorized";
    else if (r.uncertain) {
      state = "uncertain";
      reason = "charge_unconfirmed";
    } else {
      state = "refused";
      reason = `charge_refused:${r.response.status}`;
      response = r.response;
    }
  } catch (e) {
    state = "uncertain";
    reason = `charge_threw:${e instanceof Error ? e.message : String(e)}`.slice(0, 200);
  }
  const now = Date.now();
  const final: ChargeAuthorization = {
    ...claim,
    state,
    reason,
    updated_at: now,
    authorized_at: state === "authorized" ? now : null,
  };
  let wrote = false;
  try {
    wrote = await casAuthorization(claim.session_id, claim, final);
  } catch (e) {
    console.error("[decision-report] charge authorization write failed", { session_id: claim.session_id, e });
  }
  if (wrote) {
    if (state === "authorized") return { state: "authorized", record: final };
    if (state === "refused") return { state: "refused", record: final, response };
    return { state: "uncertain", reason: reason ?? "charge_unconfirmed" };
  }
  return settleLostWrite(claim, state, response);
}

/**
 * This call's outcome was not recorded. Only the server record decides what it means:
 *  - unreadable → uncertain (fail closed);
 *  - authorized → authorized (terminal; never downgraded);
 *  - another attempt_id → the claim was taken over: stale, this outcome decides nothing;
 *  - still this attempt and pending → the outcome is unrecorded: uncertain, reconciled
 *    with the same ref once the claim expires;
 *  - this attempt, terminal (the write landed but was not acknowledged) → that state.
 */
async function settleLostWrite(
  claim: ChargeAuthorization,
  outcome: ChargeAuthorizationState,
  response: Response | null,
): Promise<ChargeSettlement> {
  let latest: ChargeAuthorization | null;
  try {
    latest = await loadChargeAuthorization(claim.session_id);
  } catch {
    return { state: "uncertain", reason: "authorization_unreadable" };
  }
  if (!latest) return { state: "uncertain", reason: "authorization_missing_after_charge" };
  if (latest.state === "authorized") return { state: "authorized", record: latest };
  if (latest.attempt_id !== claim.attempt_id) return { state: "stale_claim", record: latest };
  if (latest.state === "abort_claimed") return { state: "abort_in_progress", record: latest };
  if (latest.state === "refused" && outcome === "refused") return { state: "refused", record: latest, response };
  return { state: "uncertain", reason: "authorization_write_unconfirmed" };
}

/**
 * Bring the session's authorization to a settled answer for this request.
 *  - authorized: nothing to charge (first charge done; later generations are free);
 *  - live pending: another request is charging — do not run, do not charge;
 *  - abort_claimed: a refusal's abort owns the session — no claim, no charge, whatever
 *    the caller (start, Regenerate, Continue);
 *  - none / refused / abort_completed: open a charge only when `allowNewCharge` (a start);
 *  - uncertain / abandoned pending: reconcile — re-claim and charge the same ref.
 */
export async function settleDecisionReportCharge(input: {
  session_id: string;
  question: string;
  joint_pass_ref: string | null;
  allowNewCharge: boolean;
  charge: DecisionReportCharge;
}): Promise<ChargeSettlement> {
  const { session_id } = input;
  for (let round = 0; round < 4; round++) {
    let cur: ChargeAuthorization | null;
    try {
      cur = await loadChargeAuthorization(session_id);
    } catch {
      return { state: "uncertain", reason: "authorization_unreadable" };
    }
    if (cur?.state === "authorized") return { state: "authorized", record: cur };
    if (cur?.state === "abort_claimed") return { state: "abort_in_progress", record: cur };
    if (cur?.state === "pending" && Date.now() - cur.claimed_at < DI2_CHARGE_CLAIM_MS) {
      return { state: "pending", record: cur };
    }
    if (!input.allowNewCharge && (!cur || cur.state === "refused" || cur.state === "abort_completed")) {
      return cur ? { state: "refused", record: cur, response: null } : { state: "required" };
    }
    const now = Date.now();
    const claim: ChargeAuthorization = cur
      ? {
          ...cur,
          state: "pending",
          question: cur.question || input.question,
          attempt_id: crypto.randomUUID(),
          claimed_at: now,
          attempts: cur.attempts + 1,
          reason: null,
          updated_at: now,
          authorized_at: null,
          ...NO_ABORT,
        }
      : {
          version: 1,
          session_id,
          state: "pending",
          charge_ref: input.joint_pass_ref || session_id,
          joint_pass_ref: input.joint_pass_ref,
          question: input.question,
          attempt_id: crypto.randomUUID(),
          claimed_at: now,
          attempts: 1,
          reason: null,
          updated_at: now,
          authorized_at: null,
          ...NO_ABORT,
        };
    let won: boolean;
    try {
      won = await casAuthorization(session_id, cur, claim);
    } catch {
      return { state: "uncertain", reason: "authorization_unwritable" };
    }
    if (won) return chargeUnderClaim(claim, input.charge);
  }
  const last = await loadChargeAuthorization(session_id).catch(() => null);
  if (last?.state === "authorized") return { state: "authorized", record: last };
  if (last?.state === "abort_claimed") return { state: "abort_in_progress", record: last };
  return last ? { state: "pending", record: last } : { state: "uncertain", reason: "authorization_contended" };
}

// ─── refusal → job abort (atomic claim, resumable completion) ──────────────

export type RefusalAbortClaim =
  /** This call's CAS moved the refusal to `abort_claimed` for `job_id`: it owns the abort. */
  | { kind: "claimed"; record: ChargeAuthorization }
  /** An abort is already claimed: only `record.abort_job_id` may be (resumed and) terminated. */
  | { kind: "in_progress"; record: ChargeAuthorization }
  /** This refusal's abort already finished (`record.abort_job_id`). */
  | { kind: "completed"; record: ChargeAuthorization }
  /** The session was authorized meanwhile: no abort. */
  | { kind: "superseded"; record: ChargeAuthorization }
  /** Another attempt owns the record (re-claimed, re-charged): this refusal decides nothing. */
  | { kind: "stale"; record: ChargeAuthorization | null }
  /** The record could not be read or written with certainty: no abort (fail closed). */
  | { kind: "uncertain"; reason: string };

function classifyAbortClaim(latest: ChargeAuthorization | null, refusal: ChargeAuthorization): RefusalAbortClaim {
  if (!latest) return { kind: "uncertain", reason: "authorization_missing" };
  if (latest.state === "authorized") return { kind: "superseded", record: latest };
  if (latest.state === "abort_claimed") return { kind: "in_progress", record: latest };
  if (latest.attempt_id !== refusal.attempt_id || latest.charge_ref !== refusal.charge_ref) {
    return { kind: "stale", record: latest };
  }
  if (latest.state === "abort_completed") return { kind: "completed", record: latest };
  // Same attempt, still `refused`, yet the claim did not land: unknown, not a refusal to act on.
  return { kind: "uncertain", reason: "abort_claim_unconfirmed" };
}

/**
 * The right to terminate `job_id` for a refusal, taken atomically: `refused` (recorded by
 * this settlement's attempt, same session and charge ref) → `abort_claimed` by CAS on the
 * exact record. A start that re-claims the same `refused` record CASes against the same
 * value, so exactly one of them wins: either the job is aborted, or it is charged again —
 * never "confirmed refused" and then charged by someone else before the abort.
 */
export async function claimDecisionReportRefusalAbort(
  s: ChargeSettlement,
  job_id: string,
  lock: { lock_token: string; owner_attempt_id: string },
): Promise<RefusalAbortClaim> {
  if (s.state !== "refused") return { kind: "stale", record: null };
  const refusal = s.record;
  let cur: ChargeAuthorization | null;
  try {
    cur = await loadChargeAuthorization(refusal.session_id);
  } catch {
    return { kind: "uncertain", reason: "authorization_unreadable" };
  }
  const eligible =
    cur !== null &&
    cur.state === "refused" &&
    cur.attempt_id === refusal.attempt_id &&
    cur.session_id === refusal.session_id &&
    cur.charge_ref === refusal.charge_ref;
  if (!eligible) return classifyAbortClaim(cur, refusal);

  const now = Date.now();
  const next: ChargeAuthorization = {
    ...cur!,
    state: "abort_claimed",
    abort_job_id: job_id,
    abort_attempt_id: crypto.randomUUID(),
    abort_claimed_at: now,
    abort_completed_at: null,
    abort_lock_token: lock.lock_token,
    abort_lock_owner_attempt_id: lock.owner_attempt_id,
    abort_resumer_id: null,
    abort_resumed_at: null,
    updated_at: now,
  };
  try {
    if (await casAuthorization(refusal.session_id, cur, next)) return { kind: "claimed", record: next };
  } catch (e) {
    console.error("[decision-report] abort claim write failed", { session_id: refusal.session_id, e });
  }
  let latest: ChargeAuthorization | null;
  try {
    latest = await loadChargeAuthorization(refusal.session_id);
  } catch {
    return { kind: "uncertain", reason: "authorization_unreadable" };
  }
  // The write landed but its acknowledgement was lost.
  if (latest?.state === "abort_claimed" && latest.abort_attempt_id === next.abort_attempt_id) {
    return { kind: "claimed", record: latest };
  }
  return classifyAbortClaim(latest, refusal);
}

/** Last time the abort was claimed or its resume right taken: it is held for the window after. */
export function abortHeldSince(rec: ChargeAuthorization): number {
  return Math.max(rec.abort_claimed_at ?? 0, rec.abort_resumed_at ?? 0);
}

export type RefusalAbortResumeRight =
  /** This call owns the resume of `record.abort_job_id` (CAS landed). */
  | { kind: "taken"; record: ChargeAuthorization }
  /** Another request claimed or resumed it inside the window, or it moved on. */
  | { kind: "lost"; record: ChargeAuthorization | null }
  | { kind: "uncertain"; reason: string };

/**
 * The right to resume an abandoned abort, taken atomically: CAS on the exact
 * `abort_claimed` record read (idle past the window) → same abort (job, attempt, lock
 * identity) with this resumer's id and a fresh `abort_resumed_at`. Two resumers of the
 * same record are exclusive; a record completed or re-claimed meanwhile is not resumed.
 */
export async function claimRefusalAbortResume(rec: ChargeAuthorization): Promise<RefusalAbortResumeRight> {
  if (rec.state !== "abort_claimed" || !rec.abort_job_id || !rec.abort_attempt_id) {
    return { kind: "lost", record: rec };
  }
  if (Date.now() - abortHeldSince(rec) < DI2_ABORT_CLAIM_MS) return { kind: "lost", record: rec };
  const now = Date.now();
  const next: ChargeAuthorization = {
    ...rec,
    abort_resumer_id: crypto.randomUUID(),
    abort_resumed_at: now,
    updated_at: now,
  };
  try {
    if (await casAuthorization(rec.session_id, rec, next)) return { kind: "taken", record: next };
  } catch (e) {
    console.error("[decision-report] abort resume claim write failed", { session_id: rec.session_id, e });
  }
  let latest: ChargeAuthorization | null;
  try {
    latest = await loadChargeAuthorization(rec.session_id);
  } catch {
    return { kind: "uncertain", reason: "authorization_unreadable" };
  }
  if (latest?.state === "abort_claimed" && latest.abort_resumer_id === next.abort_resumer_id) {
    return { kind: "taken", record: latest };
  }
  return { kind: "lost", record: latest };
}

/**
 * Close a claimed abort once every termination step is done: `abort_claimed` →
 * `abort_completed`, CAS on the exact claimed record (so bound to its abort_attempt_id
 * and abort_job_id). True when this call wrote it or the same abort was already
 * completed; false when the record moved elsewhere or could not be confirmed.
 */
export async function completeRefusalAbortRecord(claimed: ChargeAuthorization): Promise<boolean> {
  if (claimed.state !== "abort_claimed" || !claimed.abort_job_id || !claimed.abort_attempt_id) return false;
  const now = Date.now();
  const done: ChargeAuthorization = {
    ...claimed,
    state: "abort_completed",
    abort_completed_at: now,
    updated_at: now,
  };
  try {
    if (await casAuthorization(claimed.session_id, claimed, done)) return true;
  } catch (e) {
    console.error("[decision-report] abort completion write failed", { session_id: claimed.session_id, e });
  }
  const latest = await loadChargeAuthorization(claimed.session_id).catch(() => null);
  return (
    latest?.state === "abort_completed" &&
    latest.abort_attempt_id === claimed.abort_attempt_id &&
    latest.abort_job_id === claimed.abort_job_id
  );
}

// ─── per-job execution grant ───────────────────────────────────────────────

export type DecisionReportExecutionGrant = {
  job_id: string;
  session_id: string;
  execution_generation: number;
  charge_ref: string;
  granted_at: number;
};

export type ExecutionGrantCheck = { ok: true } | { ok: false; reason: string };

/**
 * The job may run: its grant names this job, session and generation, and the session's
 * authorization is `authorized` under the same charge ref. Read failures refuse.
 */
export async function verifyDecisionReportExecution(job: PojuXhighJob): Promise<ExecutionGrantCheck> {
  try {
    const grant = await kv.get<DecisionReportExecutionGrant>(di2ExecutionGrantKey(job.job_id));
    if (!grant) return { ok: false, reason: "grant_missing" };
    if (
      grant.job_id !== job.job_id ||
      grant.session_id !== job.session_id ||
      grant.execution_generation !== job.execution_generation
    ) {
      return { ok: false, reason: "grant_mismatch" };
    }
    const auth = await loadChargeAuthorization(job.session_id);
    if (!auth || auth.state !== "authorized") return { ok: false, reason: `charge_${auth?.state ?? "missing"}` };
    if (auth.charge_ref !== grant.charge_ref) return { ok: false, reason: "grant_charge_mismatch" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `grant_unreadable:${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Grant a live job of an authorized session (idempotent). Refuses terminal jobs and
 * sessions whose authorization is anything but `authorized`.
 */
export async function grantDecisionReportExecution(job: PojuXhighJob): Promise<ExecutionGrantCheck> {
  if (job.status !== "pending" && job.status !== "running") return { ok: false, reason: `job_${job.status}` };
  if (typeof job.execution_generation !== "number") return { ok: false, reason: "job_without_generation" };
  const existing = await verifyDecisionReportExecution(job);
  if (existing.ok) return existing;
  let auth: ChargeAuthorization | null;
  try {
    auth = await loadChargeAuthorization(job.session_id);
  } catch {
    return { ok: false, reason: "authorization_unreadable" };
  }
  if (!auth || auth.state !== "authorized") return { ok: false, reason: `charge_${auth?.state ?? "missing"}` };
  // The job's delivery right is recorded (durably, bound to this job) before it may run;
  // a job whose delivery was revoked by a refusal never runs again.
  const delivery = await grantDecisionReportDelivery(job, auth);
  if (!delivery.ok) return { ok: false, reason: delivery.reason };
  const grant: DecisionReportExecutionGrant = {
    job_id: job.job_id,
    session_id: job.session_id,
    execution_generation: job.execution_generation,
    charge_ref: auth.charge_ref,
    granted_at: Date.now(),
  };
  try {
    await kv.set(di2ExecutionGrantKey(job.job_id), grant, { ex: GRANT_TTL });
  } catch {
    return { ok: false, reason: "grant_unwritable" };
  }
  return verifyDecisionReportExecution(job);
}

export async function revokeDecisionReportExecution(job_id: string): Promise<void> {
  await kv.del(di2ExecutionGrantKey(job_id));
}

// ─── per-job delivery authorization (durable) ──────────────────────────────

/**
 * Outlives the completed report record it gates: written / refreshed before that record
 * is committed, with the report retention plus one execution window of margin.
 */
const DELIVERY_TTL = RETENTION + KV_TTL.POJU_XHIGH_JOB;

/**
 * The right to deliver one job's report, bound to that job's paid authorization. The
 * execution grant (2 h) only lets a job run; this record is what a finished report is
 * served under for the whole retention window.
 *
 *   (absent) ──grant (NX)──▶ granted ──refresh (same binding)──▶ granted
 *   (absent | granted) ──refusal abort──▶ revoked                (terminal)
 *
 * A revoked record is never written back to `granted` (grants only create an absent
 * record or refresh an identical one), so a later authorization of the session — same
 * `charge_ref`, abort fields cleared — cannot reopen a refused job. An absent record
 * denies delivery (legacy jobs without payment evidence, expired records).
 */
export type DecisionReportDeliveryAuthorization = {
  version: 1;
  job_id: string;
  session_id: string;
  execution_generation: number | null;
  charge_ref: string | null;
  state: "granted" | "revoked";
  granted_at: number | null;
  revoked_at: number | null;
  reason: string | null;
};

export type DeliveryCheck =
  | { ok: true; record: DecisionReportDeliveryAuthorization }
  /** `unreadable`: a store read failed (retry); `revoked`: a refusal ended this job's delivery. */
  | { ok: false; reason: string; unreadable: boolean; revoked: boolean };

export type DeliveryTarget = { job_id: string; session_id: string; execution_generation?: number | null };

export function di2DeliveryAuthorizationKey(job_id: string): string {
  return `poju-di2:delivery-auth:${safe(job_id)}`;
}

function denied(reason: string, extra: { unreadable?: boolean; revoked?: boolean } = {}): DeliveryCheck {
  return { ok: false, reason, unreadable: extra.unreadable ?? false, revoked: extra.revoked ?? false };
}

async function loadDeliveryRecord(job_id: string): Promise<DecisionReportDeliveryAuthorization | null> {
  const got = await store().get<DecisionReportDeliveryAuthorization>(di2DeliveryAuthorizationKey(job_id));
  return got && typeof got === "object" ? got : null;
}

function sameDeliveryBinding(
  rec: DecisionReportDeliveryAuthorization,
  job: { job_id: string; session_id: string; execution_generation?: number | null },
  charge_ref: string,
): boolean {
  return (
    rec.job_id === job.job_id &&
    rec.session_id === job.session_id &&
    rec.execution_generation === (job.execution_generation ?? null) &&
    rec.charge_ref === charge_ref
  );
}

/**
 * May this job's report (analysis, pages, result) be returned? Only when its own delivery
 * record is `granted` for exactly this job / session / generation, and the session's
 * charge is `authorized` under the same `charge_ref`. Every other state — revoked,
 * absent, mismatched, session not authorized, or any read failure — denies.
 */
export async function verifyDecisionReportDelivery(target: DeliveryTarget): Promise<DeliveryCheck> {
  let rec: DecisionReportDeliveryAuthorization | null;
  try {
    rec = await loadDeliveryRecord(target.job_id);
  } catch {
    return denied("delivery_unreadable", { unreadable: true });
  }
  if (!rec) return denied("delivery_missing");
  if (rec.job_id !== target.job_id || rec.session_id !== target.session_id) return denied("delivery_mismatch");
  if (rec.state === "revoked") return denied("delivery_revoked", { revoked: true });
  if (rec.state !== "granted") return denied("delivery_invalid");
  if (rec.execution_generation !== (target.execution_generation ?? null)) return denied("delivery_generation_mismatch");
  let auth: ChargeAuthorization | null;
  try {
    auth = await loadChargeAuthorization(target.session_id);
  } catch {
    return denied("authorization_unreadable", { unreadable: true });
  }
  if (!auth) return denied("authorization_missing");
  if (auth.state !== "authorized") return denied(`charge_${auth.state}`);
  if (!rec.charge_ref || auth.charge_ref !== rec.charge_ref) return denied("delivery_charge_mismatch");
  return { ok: true, record: rec };
}

/**
 * Record (or confirm) the delivery right of a job of an authorized session: NX create,
 * or an identical record already there. A revoked or differently bound record refuses.
 * `refresh` re-writes the identical record to restart its retention.
 */
export async function grantDecisionReportDelivery(
  job: PojuXhighJob,
  auth: ChargeAuthorization,
  opts: { refresh?: boolean } = {},
): Promise<DeliveryCheck> {
  if (typeof job.execution_generation !== "number") return denied("job_without_generation");
  if (auth.state !== "authorized" || auth.session_id !== job.session_id) return denied(`charge_${auth.state}`);
  const key = di2DeliveryAuthorizationKey(job.job_id);
  for (let round = 0; round < 4; round++) {
    let cur: DecisionReportDeliveryAuthorization | null;
    try {
      cur = await loadDeliveryRecord(job.job_id);
    } catch {
      return denied("delivery_unreadable", { unreadable: true });
    }
    if (cur?.state === "revoked") return denied("delivery_revoked", { revoked: true });
    if (cur) {
      if (cur.state !== "granted" || !sameDeliveryBinding(cur, job, auth.charge_ref)) return denied("delivery_mismatch");
      if (!opts.refresh) return { ok: true, record: cur };
      try {
        if (await casExact(key, cur, cur, DELIVERY_TTL)) return { ok: true, record: cur };
      } catch {
        return denied("delivery_unwritable", { unreadable: true });
      }
      continue;
    }
    const rec: DecisionReportDeliveryAuthorization = {
      version: 1,
      job_id: job.job_id,
      session_id: job.session_id,
      execution_generation: job.execution_generation,
      charge_ref: auth.charge_ref,
      state: "granted",
      granted_at: Date.now(),
      revoked_at: null,
      reason: null,
    };
    try {
      if (await casExact(key, null, rec, DELIVERY_TTL)) return { ok: true, record: rec };
    } catch {
      return denied("delivery_unwritable", { unreadable: true });
    }
  }
  return denied("delivery_contended", { unreadable: true });
}

/**
 * End a job's delivery right for good (refusal abort): any current record — absent or
 * granted — becomes `revoked`, by NX create or CAS on the exact value. Idempotent. Throws
 * when the write cannot be confirmed, so the abort stays incomplete and resumable.
 */
export async function revokeDecisionReportDelivery(input: {
  job_id: string;
  session_id: string;
  execution_generation: number | null;
  charge_ref: string | null;
  reason: string;
}): Promise<void> {
  const key = di2DeliveryAuthorizationKey(input.job_id);
  for (let round = 0; round < 4; round++) {
    const cur = await loadDeliveryRecord(input.job_id);
    if (cur && cur.session_id !== input.session_id) {
      throw new Error(`delivery record of ${input.job_id} belongs to another session`);
    }
    if (cur?.state === "revoked") return;
    const now = Date.now();
    const next: DecisionReportDeliveryAuthorization = {
      version: 1,
      job_id: input.job_id,
      session_id: input.session_id,
      execution_generation: cur ? cur.execution_generation : input.execution_generation,
      charge_ref: cur ? cur.charge_ref : input.charge_ref,
      state: "revoked",
      granted_at: cur?.granted_at ?? null,
      revoked_at: now,
      reason: input.reason,
    };
    if (await casExact(key, cur, next, DELIVERY_TTL)) return;
  }
  throw new Error(`delivery revocation of ${input.job_id} contended`);
}

/**
 * At report commit: the job ran under a valid execution grant, so its delivery right is
 * recorded (created for a job granted before delivery records existed) and both it and
 * the session authorization are re-written to outlive the report record about to be
 * committed. Any failure refuses the commit.
 */
export async function sealDecisionReportDelivery(job: PojuXhighJob): Promise<DeliveryCheck> {
  const exec = await verifyDecisionReportExecution(job);
  if (!exec.ok) return denied(exec.reason, { unreadable: exec.reason.startsWith("grant_unreadable") });
  let auth: ChargeAuthorization | null;
  try {
    auth = await loadChargeAuthorization(job.session_id);
  } catch {
    return denied("authorization_unreadable", { unreadable: true });
  }
  if (!auth || auth.state !== "authorized") return denied(`charge_${auth?.state ?? "missing"}`);
  const granted = await grantDecisionReportDelivery(job, auth, { refresh: true });
  if (!granted.ok) return granted;
  if (!(await retainChargeAuthorization(auth))) return denied("authorization_unretained", { unreadable: true });
  return verifyDecisionReportDelivery(job);
}

/**
 * Restart the retention of an existing delivery right and of its session authorization
 * (a report record rebuilt for a job that lost it). Never creates either record.
 */
export async function retainDecisionReportDelivery(target: DeliveryTarget): Promise<DeliveryCheck> {
  const check = await verifyDecisionReportDelivery(target);
  if (!check.ok) return check;
  try {
    if (!(await casExact(di2DeliveryAuthorizationKey(target.job_id), check.record, check.record, DELIVERY_TTL))) {
      return denied("delivery_unretained", { unreadable: true });
    }
    const auth = await loadChargeAuthorization(target.session_id);
    if (!auth || !(await retainChargeAuthorization(auth))) return denied("authorization_unretained", { unreadable: true });
  } catch {
    return denied("delivery_unwritable", { unreadable: true });
  }
  return check;
}

/** Re-write an `authorized` record unchanged (its terminal state) to restart its retention. */
async function retainChargeAuthorization(auth: ChargeAuthorization): Promise<boolean> {
  if (auth.state !== "authorized") return false;
  try {
    return await casAuthorization(auth.session_id, auth, auth, DELIVERY_TTL);
  } catch {
    return false;
  }
}

/** Thrown by the dispatcher for a job without a valid execution grant. */
export class DecisionReportNotAuthorizedError extends Error {
  readonly code = "CHARGE_NOT_AUTHORIZED" as const;
  readonly reason: string;
  constructor(job_id: string, reason: string) {
    super(`report job ${job_id} is not authorized to run (${reason})`);
    this.name = "DecisionReportNotAuthorizedError";
    this.reason = reason;
  }
}
