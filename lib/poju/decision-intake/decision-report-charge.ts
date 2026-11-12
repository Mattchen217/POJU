/**
 * M5-R1 — charge authorization for Decision Intake 2.0 reports (server).
 *
 * One pivot pass per session. The authorization record (durable, per session) is the
 * only proof of payment the report chain accepts — a job's existence is not:
 *
 *   (none) ──claim──▶ pending ──charge ok──────────▶ authorized   (terminal)
 *                        │    ──charge refused─────▶ refused      (a later start re-claims)
 *                        │    ──charge unknown─────▶ uncertain    (reconciled by re-claim)
 *                        └── claim older than CLAIM_MS: abandoned, re-claimable
 *
 * Every transition is a compare-and-set on the exact record, so two requests can
 * never both hold a claim, and a claimant whose claim was taken over (its attempt_id is
 * no longer the record's) can neither write its outcome nor act on it. `charge_ref` (the
 * pass ledger idempotency ref) is fixed at the first claim and reused by every later
 * attempt: a reconcile of a charge whose
 * outcome was lost (RPC error, record write failure, killed invoke) returns
 * `already_consumed` instead of debiting again.
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

export type DecisionReportChargeResult =
  | { ok: true }
  | { ok: false; response: Response; uncertain?: boolean };

export type DecisionReportCharge = (input: {
  sessionId: string;
  question: string;
  jointPassRef: string | null;
}) => Promise<DecisionReportChargeResult>;

export type ChargeAuthorizationState = "pending" | "authorized" | "refused" | "uncertain";

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
  if (latest.state === "refused" && outcome === "refused") return { state: "refused", record: latest, response };
  return { state: "uncertain", reason: "authorization_write_unconfirmed" };
}

/**
 * Bring the session's authorization to a settled answer for this request.
 *  - authorized: nothing to charge (first charge done; later generations are free);
 *  - live pending: another request is charging — do not run, do not charge;
 *  - none / refused: open a charge only when `allowNewCharge` (a start);
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
    if (cur?.state === "pending" && Date.now() - cur.claimed_at < DI2_CHARGE_CLAIM_MS) {
      return { state: "pending", record: cur };
    }
    if (!input.allowNewCharge && (!cur || cur.state === "refused")) {
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
  return last ? { state: "pending", record: last } : { state: "uncertain", reason: "authorization_contended" };
}

/**
 * Abort authority for a refusal: the current record must still be `refused` and recorded
 * by the attempt this settlement carries. A stale claimant, a newer pending / uncertain /
 * authorized record, or an unreadable record never confirms a refusal.
 */
export async function confirmCurrentChargeRefusal(s: ChargeSettlement): Promise<boolean> {
  if (s.state !== "refused") return false;
  let latest: ChargeAuthorization | null;
  try {
    latest = await loadChargeAuthorization(s.record.session_id);
  } catch {
    return false;
  }
  return latest?.state === "refused" && latest.attempt_id === s.record.attempt_id;
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
