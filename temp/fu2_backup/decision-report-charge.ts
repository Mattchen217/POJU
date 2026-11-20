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
 *   abort_claimed   owned by the refusal's abort of one job (`abort_job_id`): no claim, no
 *                   charge, no run for the session until that abort is finished
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

/** Replace `expected` (null = absent) with `next`, atomically. */
async function casAuthorization(
  session_id: string,
  expected: ChargeAuthorization | null,
  next: ChargeAuthorization,
): Promise<boolean> {
  const s = store();
  const key = di2ChargeAuthorizationKey(session_id);
  if (expected === null) return (await s.set(key, next, { ex: RETENTION, nx: true })) === "OK";
  const expectedJson = JSON.stringify(expected);
  if (typeof s.compareAndSetExact === "function") {
    return s.compareAndSetExact(key, expectedJson, next, { ex: RETENTION });
  }
  if (typeof s.eval === "function") {
    const r = await s.eval(CAS_EXACT_LUA, [key], [expectedJson, JSON.stringify(next), String(RETENTION)]);
    return r === 1 || r === true;
  }
  throw new Error("charge authorization CAS unavailable");
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
          abort_job_id: null,
          abort_attempt_id: null,
          abort_claimed_at: null,
          abort_completed_at: null,
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
          abort_job_id: null,
          abort_attempt_id: null,
          abort_claimed_at: null,
          abort_completed_at: null,
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
