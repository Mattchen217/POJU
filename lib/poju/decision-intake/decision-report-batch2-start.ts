/**
 * Unit C / R1 — DI2 Start → Batch2 production engine (Start only).
 *
 * After DI2 authorization / job / fence / charge, kicks Batch2 via the same
 * bootstrap sequence as startReportBatch2Production, but:
 * - Reuses Unit B binding (no second allocateGeneration when gen exists)
 * - Builds inputs via Unit A adapter from verified Freeze/Profile
 * - Resolves ZiweiFactPack only from server-trusted birth recompute
 * - Never falls back to the legacy DI2 eight-page runner
 * - Never accepts client-submitted ZFP objects
 *
 * Execution authority closure (R1 + R2 + R3):
 * Job-only fence CAS is NOT cross-KV atomic with Session Fence (R1 residual).
 * R2: Batch2 Start side effects run only while the caller holds the DI2
 * Report Session Lock (holder "start"). DI2 Regenerate calls
 * supersedeFinalDeliveryJobForRegenerate only under that same lock in
 * createOrReuseDecisionReportJob — so Start and Regenerate are mutually
 * exclusive for the critical window. Before each side effect we
 * updateOwnedReportLock (touch + ownership check); lock loss → Fail Closed.
 * R3: owner-checked lease renewal (withOwnedReportLockLease) keeps touched_at
 * fresh during long awaits (ORCHESTRATE/RECOVER) so 60s idle takeover cannot
 * steal a live Start. Fence assert + start_gate remain defense in depth.
 */

import {
  createJobAndPersist,
  isReportBatch2SharedStoreAvailable,
  loadJobRawBlobs,
  updateJobStatus,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import {
  buildOrchestratePayload,
  buildRecoverPayload,
  getReportBatch2EventSenderForTests,
  isReportBatch2InngestConfigured,
  sendReportBatch2Events,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/dispatch";
import {
  activateGeneration,
  readGeneration,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3/generation-store";
import { birthInputHash } from "@/lib/poju/decision-authority/server/profile-authority";
import type {
  FreezeRecord,
  ProfileRecord,
} from "@/lib/poju/decision-authority/types";
import {
  buildBatch2InputsFromDI2,
  profileIndicatesComputedZiwei,
} from "@/lib/poju/decision-intake/decision-report-batch2-adapter";
import {
  ensureDi2Batch2IdentityBinding,
  evaluateExistingDi2Batch2Binding,
  type Di2Batch2IdentityBinding,
} from "@/lib/poju/decision-intake/decision-report-batch2-identity";
import {
  isDecisionReportJobInput,
  type DecisionReportJobInput,
} from "@/lib/poju/decision-intake/decision-report-types";
import {
  assertDeliveryExecutionAuthority,
  DeliveryExecutionRevokedError,
} from "@/lib/poju/final-delivery-execution-authority";
import {
  isReportLockOwnedBy,
  updateOwnedReportLock,
  withOwnedReportLockLease,
  type ReportLockLeaseHandle,
  type ReportLockOwner,
} from "@/lib/poju/decision-intake/decision-report-lock";
import {
  commitXhighJobUnderExecutionFence,
  getXhighJob,
} from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import { buildZiweiFactPack, type ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import { coerceBirthInfo } from "@/lib/ziwei/lab-ziwei";

/** Durable Batch2 production pointer stamped on the DI2 job after Start. */
export type Di2Batch2ProductionState = {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  status: "started" | "reused";
  started_at: string;
  /** Last Start outcome for recovery readers. */
  last_dispatch: "orchestrate" | "recover" | "none";
};

/** Fence-CAS phases for Batch2 Start side effects (Unit C R1). */
export type Di2Batch2StartGatePhase =
  | "claimed"
  | "before_activate"
  | "before_create_job"
  | "dispatch_authorized"
  | "done";

export type Di2Batch2StartGate = {
  execution_generation: number;
  phase: Di2Batch2StartGatePhase;
  updated_at: string;
};

/** Test probe points — revoke fence here to prove side effects stop. */
export type Di2Batch2StartSideEffectGate =
  | "before_activate"
  | "before_create_job"
  | "before_dispatch";

type StartSideEffectProbe = (
  gate: Di2Batch2StartSideEffectGate,
  ctx: { job_id: string; execution_generation: number },
) => void | Promise<void>;

let __startSideEffectProbe: StartSideEffectProbe | null = null;

/**
 * @internal tests only — inject between lock refresh and the next side effect
 * (e.g. steal lock / supersede while Start still believes it holds authority).
 */
export type Di2Batch2StartLockRaceProbe = (ctx: {
  job_id: string;
  execution_generation: number;
  gate: Di2Batch2StartSideEffectGate | "before_claim";
}) => void | Promise<void>;

let __lockRaceProbe: Di2Batch2StartLockRaceProbe | null = null;

/** @internal tests only */
export function __setDi2Batch2StartSideEffectProbeForTests(
  fn: StartSideEffectProbe | null,
): void {
  __startSideEffectProbe = fn;
}

/** @internal tests only */
export function __setDi2Batch2StartLockRaceProbeForTests(
  fn: Di2Batch2StartLockRaceProbe | null,
): void {
  __lockRaceProbe = fn;
}

/** @internal tests only — reset between cases */
export const __di2Batch2StartSideEffectCountsForTests = {
  activate: 0,
  create_job: 0,
  orchestrate_send: 0,
  recover_send: 0,
};

/** @internal tests only */
export function __resetDi2Batch2StartSideEffectCountsForTests(): void {
  __di2Batch2StartSideEffectCountsForTests.activate = 0;
  __di2Batch2StartSideEffectCountsForTests.create_job = 0;
  __di2Batch2StartSideEffectCountsForTests.orchestrate_send = 0;
  __di2Batch2StartSideEffectCountsForTests.recover_send = 0;
}

export type Di2Batch2StartErrorCode =
  | "missing_job"
  | "wrong_phase"
  | "job_revoked"
  | "binding_failed"
  | "identity_mismatch"
  | "freeze_profile_mismatch"
  | "ziwei_trusted_pack_required"
  | "ziwei_birth_mismatch"
  | "ziwei_rebuild_failed"
  | "adapter_failed"
  | "generation_missing"
  | "generation_epoch_mismatch"
  | "batch2_job_identity_mismatch"
  | "kv_unavailable"
  | "inngest_unavailable"
  | "activate_failed"
  | "job_create_failed"
  | "dispatch_uncertain"
  | "cas_failed"
  | "session_lock_lost"
  | "session_lock_required";

export type Di2Batch2StartResult =
  | {
      ok: true;
      binding: Di2Batch2IdentityBinding;
      production: Di2Batch2ProductionState;
      reused: boolean;
      job: PojuXhighJob;
    }
  | { ok: false; code: Di2Batch2StartErrorCode; detail: string };

export type ResolveTrustedZiweiResult =
  | { ok: true; ziwei_fact_pack: ZiweiFactPack | null }
  | { ok: false; code: Di2Batch2StartErrorCode; detail: string };

/**
 * Trusted ZFP for Batch2: never accept a client-shaped pack.
 * - Ziwei not computed on Profile → null OK
 * - Ziwei computed → rebuild from birth whose hash matches Profile.source.birth_input_hash
 */
export function resolveTrustedZiweiFactPack(input: {
  profile: ProfileRecord;
  /** Raw birth from device; verified against Profile birth_input_hash. */
  birth_info?: unknown;
}): ResolveTrustedZiweiResult {
  const { profile } = input;
  if (!profileIndicatesComputedZiwei(profile)) {
    return { ok: true, ziwei_fact_pack: null };
  }

  if (input.birth_info == null) {
    return {
      ok: false,
      code: "ziwei_trusted_pack_required",
      detail:
        "Profile indicates computed Ziwei but no birth_info was provided for server-trusted ZFP rebuild",
    };
  }

  const birth = coerceBirthInfo(input.birth_info);
  if (!birth) {
    return {
      ok: false,
      code: "ziwei_birth_mismatch",
      detail: "birth_info could not be coerced for trusted ZFP rebuild",
    };
  }
  const { tst_meta: _drop, ...calcBirth } = birth;
  const hash = birthInputHash(calcBirth);
  const expected = profile.source?.birth_input_hash;
  if (!expected || hash !== expected) {
    return {
      ok: false,
      code: "ziwei_birth_mismatch",
      detail: "birth_info hash does not match Profile.source.birth_input_hash",
    };
  }

  try {
    const pack = buildZiweiFactPack(calcBirth, {
      asOf: profile.calculation_timestamp,
    });
    return { ok: true, ziwei_fact_pack: pack };
  } catch (err) {
    return {
      ok: false,
      code: "ziwei_rebuild_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function assertSourcesMatchJob(input: {
  job: PojuXhighJob;
  freeze: FreezeRecord;
  profile: ProfileRecord;
}): Di2Batch2StartResult | null {
  const { job, freeze, profile } = input;
  if (job.phase !== "decision_report") {
    return {
      ok: false,
      code: "wrong_phase",
      detail: `expected decision_report, got ${job.phase}`,
    };
  }
  if (!isDecisionReportJobInput(job.input)) {
    return {
      ok: false,
      code: "wrong_phase",
      detail: "job.input is not DecisionReportJobInput",
    };
  }
  const inp = job.input as DecisionReportJobInput;
  if (freeze.session_id !== job.session_id || freeze.freeze_id !== inp.freeze_id) {
    return {
      ok: false,
      code: "freeze_profile_mismatch",
      detail: "Freeze does not match DI2 job identity",
    };
  }
  if (freeze.context_hash !== inp.context_hash) {
    return {
      ok: false,
      code: "freeze_profile_mismatch",
      detail: "Freeze context_hash does not match job input",
    };
  }
  if (
    profile.session_id !== job.session_id ||
    profile.freeze_id !== inp.freeze_id ||
    profile.profile_hash !== inp.profile_hash
  ) {
    return {
      ok: false,
      code: "freeze_profile_mismatch",
      detail: "Profile does not match DI2 job identity",
    };
  }
  return null;
}

async function stampProductionState(
  job_id: string,
  execution_generation: number,
  production: Di2Batch2ProductionState,
): Promise<Di2Batch2StartResult | { ok: true; job: PojuXhighJob }> {
  const committed = await commitXhighJobUnderExecutionFence(
    job_id,
    execution_generation,
    (current) => {
      const prev = current.batch2_production_state;
      if (
        prev &&
        prev.report_id === production.report_id &&
        prev.generation_id === production.generation_id &&
        prev.generation_epoch === production.generation_epoch
      ) {
        return {
          ...current,
          batch2_production_state: {
            ...prev,
            status: "reused",
            last_dispatch: production.last_dispatch,
          },
        };
      }
      if (
        prev &&
        (prev.report_id !== production.report_id ||
          prev.generation_id !== production.generation_id)
      ) {
        // Leave conflicting state; caller Fail Closes after re-read.
        return current;
      }
      return { ...current, batch2_production_state: production };
    },
  );
  if (!committed.ok) {
    if (committed.reason === "revoked" || committed.reason === "missing") {
      return {
        ok: false,
        code: "job_revoked",
        detail: `stamp production ${committed.reason}`,
      };
    }
    const again = await getXhighJob(job_id);
    if (
      again?.batch2_production_state &&
      again.batch2_production_state.report_id === production.report_id &&
      again.batch2_production_state.generation_id === production.generation_id
    ) {
      return { ok: true, job: again };
    }
    return {
      ok: false,
      code: "cas_failed",
      detail: `stamp production ${committed.reason}`,
    };
  }
  const durable = await getXhighJob(job_id);
  if (!durable) {
    return { ok: false, code: "missing_job", detail: "job missing after stamp" };
  }
  const st = durable.batch2_production_state;
  if (
    !st ||
    st.report_id !== production.report_id ||
    st.generation_id !== production.generation_id
  ) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "production state conflict after stamp",
    };
  }
  return { ok: true, job: durable };
}

async function requireLiveExecutionFence(
  job_id: string,
  execution_generation: number,
): Promise<{ ok: true } | { ok: false; code: Di2Batch2StartErrorCode; detail: string }> {
  try {
    await assertDeliveryExecutionAuthority(job_id, execution_generation);
    return { ok: true };
  } catch (e) {
    if (e instanceof DeliveryExecutionRevokedError) {
      return {
        ok: false,
        code: "job_revoked",
        detail: e.message,
      };
    }
    return {
      ok: false,
      code: "cas_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Live Start leases keyed by the same lock_owner object reference. */
const __activeStartLeases = new WeakMap<ReportLockOwner, ReportLockLeaseHandle>();

function leaseLostResult(
  lease: ReportLockLeaseHandle | undefined,
): { ok: false; code: Di2Batch2StartErrorCode; detail: string } | null {
  if (!lease?.lost()) return null;
  return {
    ok: false,
    code: "session_lock_lost",
    detail: lease.lostDetail() || "session start lock lease lost",
  };
}

/**
 * R2/R3 mutual exclusion: DI2 Regenerate supersedes only under the same Session
 * Start lock. Refresh ownership + touched_at; Fail Closed if lock is gone,
 * lease renew failed, or no longer held by this start owner as holder "start".
 */
async function assertHeldStartLock(
  lock_owner: ReportLockOwner,
): Promise<{ ok: true } | { ok: false; code: Di2Batch2StartErrorCode; detail: string }> {
  const lost = leaseLostResult(__activeStartLeases.get(lock_owner));
  if (lost) return lost;
  try {
    const updated = await updateOwnedReportLock(lock_owner);
    if (!updated) {
      return {
        ok: false,
        code: "session_lock_lost",
        detail: "DI2 session start lock no longer owned — refusing Batch2 side effects",
      };
    }
    if (updated.holder !== "start") {
      return {
        ok: false,
        code: "session_lock_lost",
        detail: `session lock holder=${updated.holder} (expected start) — refusing Batch2 side effects`,
      };
    }
    if (!isReportLockOwnedBy(updated, lock_owner)) {
      return {
        ok: false,
        code: "session_lock_lost",
        detail: "session lock ownership mismatch",
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      code: "session_lock_lost",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * R3: await a long side effect while the Start lease renews in the background.
 * After the await, Fail Closed if renew lost the lock — do not continue dispatch.
 */
async function awaitUnderStartLease<T>(
  lock_owner: ReportLockOwner,
  work: () => Promise<T>,
): Promise<
  | { ok: true; value: T }
  | { ok: false; code: Di2Batch2StartErrorCode; detail: string }
> {
  const value = await work();
  const lost = leaseLostResult(__activeStartLeases.get(lock_owner));
  if (lost) return lost;
  const held = await assertHeldStartLock(lock_owner);
  if (!held.ok) return held;
  return { ok: true, value };
}

async function requireStartAuthority(input: {
  job_id: string;
  execution_generation: number;
  lock_owner: ReportLockOwner;
  gate: Di2Batch2StartSideEffectGate | "before_claim";
}): Promise<{ ok: true } | { ok: false; code: Di2Batch2StartErrorCode; detail: string }> {
  await __lockRaceProbe?.({
    job_id: input.job_id,
    execution_generation: input.execution_generation,
    gate: input.gate,
  });
  const lock = await assertHeldStartLock(input.lock_owner);
  if (!lock.ok) return lock;
  return requireLiveExecutionFence(input.job_id, input.execution_generation);
}

/**
 * Advance batch2_start_gate under DI2 execution-fence CAS.
 * Failure means this Start no longer holds authority — do not continue side effects.
 */
async function advanceStartGateUnderFence(input: {
  job_id: string;
  execution_generation: number;
  phase: Di2Batch2StartGatePhase;
}): Promise<{ ok: true } | { ok: false; code: Di2Batch2StartErrorCode; detail: string }> {
  const committed = await commitXhighJobUnderExecutionFence(
    input.job_id,
    input.execution_generation,
    (current) => ({
      ...current,
      batch2_start_gate: {
        execution_generation: input.execution_generation,
        phase: input.phase,
        updated_at: new Date().toISOString(),
      },
    }),
  );
  if (!committed.ok) {
    if (committed.reason === "revoked" || committed.reason === "missing") {
      return {
        ok: false,
        code: "job_revoked",
        detail: `start_gate ${input.phase}: ${committed.reason}`,
      };
    }
    if (committed.reason === "cas_conflict") {
      // Re-read: if fence still ours and gate already at/after phase, treat as ok;
      // otherwise Fail Closed — do not proceed with uncertain authority.
      const live = await requireLiveExecutionFence(
        input.job_id,
        input.execution_generation,
      );
      if (!live.ok) return live;
      return {
        ok: false,
        code: "cas_failed",
        detail: `start_gate ${input.phase}: cas_conflict_unresolved`,
      };
    }
    return {
      ok: false,
      code: "cas_failed",
      detail: `start_gate ${input.phase}: ${committed.reason}`,
    };
  }
  return { ok: true };
}

async function runSideEffectProbe(
  gate: Di2Batch2StartSideEffectGate,
  ctx: { job_id: string; execution_generation: number },
): Promise<void> {
  await __startSideEffectProbe?.(gate, ctx);
}

/**
 * Dispatch only after a fence-CAS "dispatch_authorized" ticket.
 * Losing the fence after job create must not send ORCHESTRATE/RECOVER.
 */
async function dispatchOrchestrateOrRecover(input: {
  job_id: string;
  execution_generation: number;
  lock_owner: ReportLockOwner;
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  locale: string;
  mode: "orchestrate" | "recover";
}): Promise<
  | { ok: true; last_dispatch: "orchestrate" | "recover" }
  | { ok: false; code: Di2Batch2StartErrorCode; detail: string }
> {
  await runSideEffectProbe("before_dispatch", {
    job_id: input.job_id,
    execution_generation: input.execution_generation,
  });

  const auth = await requireStartAuthority({
    job_id: input.job_id,
    execution_generation: input.execution_generation,
    lock_owner: input.lock_owner,
    gate: "before_dispatch",
  });
  if (!auth.ok) return auth;

  // Defense in depth: job fence gate before send (not a cross-KV atomic mutex).
  const ticket = await advanceStartGateUnderFence({
    job_id: input.job_id,
    execution_generation: input.execution_generation,
    phase: "dispatch_authorized",
  });
  if (!ticket.ok) return ticket;

  // Re-confirm session lock immediately before enqueue/send.
  const lockAgain = await assertHeldStartLock(input.lock_owner);
  if (!lockAgain.ok) return lockAgain;

  const { enqueueDispatchIntent, markIntentFailed, markIntentSent } = await import(
    "@/lib/llm/pro/delivery/decision-report-v2/batch3/dispatch-intent"
  );

  if (input.mode === "recover") {
    const recover = await awaitUnderStartLease(input.lock_owner, () =>
      sendReportBatch2Events([
        buildRecoverPayload({
          report_id: input.report_id,
          generation_id: input.generation_id,
          generation_epoch: input.generation_epoch,
          locale: input.locale,
        }),
      ]),
    );
    if (!recover.ok) return recover;
    __di2Batch2StartSideEffectCountsForTests.recover_send += 1;
    if (!recover.value.ok) {
      return {
        ok: false,
        code: "dispatch_uncertain",
        detail: `recover_send_failed:${recover.value.code}:${recover.value.detail}`,
      };
    }
    return { ok: true, last_dispatch: "recover" };
  }

  const payload = buildOrchestratePayload({
    report_id: input.report_id,
    generation_id: input.generation_id,
    locale: input.locale,
    generation_epoch: input.generation_epoch,
  });
  const intent = await enqueueDispatchIntent({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    event_name: payload.name,
    payload: { ...payload.data },
  });
  if (!intent.ok) {
    await updateJobStatus(input.report_id, input.generation_id, "failed").catch(
      () => undefined,
    );
    return {
      ok: false,
      code: "dispatch_uncertain",
      detail: intent.detail ?? intent.code,
    };
  }

  const send = await awaitUnderStartLease(input.lock_owner, () =>
    sendReportBatch2Events([payload]),
  );
  if (!send.ok) return send;
  __di2Batch2StartSideEffectCountsForTests.orchestrate_send += 1;
  if (!send.value.ok) {
    await markIntentFailed(intent.value, send.value.detail);
    // Re-check session lock + fence before RECOVER — revoked Start must not heal.
    const stillAuth = await requireStartAuthority({
      job_id: input.job_id,
      execution_generation: input.execution_generation,
      lock_owner: input.lock_owner,
      gate: "before_dispatch",
    });
    if (!stillAuth.ok) return stillAuth;
    const recoverTicket = await advanceStartGateUnderFence({
      job_id: input.job_id,
      execution_generation: input.execution_generation,
      phase: "dispatch_authorized",
    });
    if (!recoverTicket.ok) return recoverTicket;
    const lockForRecover = await assertHeldStartLock(input.lock_owner);
    if (!lockForRecover.ok) return lockForRecover;
    const recover = await awaitUnderStartLease(input.lock_owner, () =>
      sendReportBatch2Events([
        buildRecoverPayload({
          report_id: input.report_id,
          generation_id: input.generation_id,
          generation_epoch: input.generation_epoch,
          locale: input.locale,
        }),
      ]),
    );
    if (!recover.ok) return recover;
    __di2Batch2StartSideEffectCountsForTests.recover_send += 1;
    if (recover.value.ok) {
      return { ok: true, last_dispatch: "recover" };
    }
    return {
      ok: false,
      code: "dispatch_uncertain",
      detail:
        `orchestrate_failed:${send.value.code}:${send.value.detail};` +
        `recover_failed:${recover.value.code}:${recover.value.detail}`,
    };
  }
  await markIntentSent(intent.value);
  return { ok: true, last_dispatch: "orchestrate" };
}

/**
 * Start (or idempotently resume) Batch2 production for a DI2 decision_report job.
 * Call only after DI2 Start has authorized Freeze/Profile, fence, charge, and grant.
 */
export async function startDi2Batch2Production(input: {
  job_id: string;
  freeze: FreezeRecord;
  profile: ProfileRecord;
  /**
   * Caller must hold the DI2 Report Session Lock as holder "start" for the
   * entire critical Start→Batch2 window (mutual exclusion with Regenerate).
   */
  lock_owner: ReportLockOwner;
  /** Required when Profile.ziwei_status indicates computed Ziwei. */
  birth_info?: unknown;
  /**
   * Rejected if provided — clients must not submit ZFP objects.
   * Kept as a typed trap for tests / misuse detection.
   */
  client_ziwei_fact_pack?: unknown;
}): Promise<Di2Batch2StartResult> {
  if (input.client_ziwei_fact_pack != null) {
    return {
      ok: false,
      code: "ziwei_trusted_pack_required",
      detail: "client-submitted ziwei_fact_pack is rejected; server-trusted rebuild only",
    };
  }

  if (!input.lock_owner?.session_id || !input.lock_owner.lock_token) {
    return {
      ok: false,
      code: "session_lock_required",
      detail: "Batch2 Start requires DI2 session start lock owner",
    };
  }

  if (!isReportBatch2SharedStoreAvailable()) {
    return {
      ok: false,
      code: "kv_unavailable",
      detail: "Batch2 shared KV unavailable",
    };
  }
  if (!isReportBatch2InngestConfigured() && !getReportBatch2EventSenderForTests()) {
    return {
      ok: false,
      code: "inngest_unavailable",
      detail: "Batch2 Inngest unavailable and no test sender",
    };
  }

  const lock_owner = input.lock_owner;

  await __lockRaceProbe?.({
    job_id: input.job_id,
    execution_generation: 0,
    gate: "before_claim",
  });
  {
    const lockOnly = await assertHeldStartLock(lock_owner);
    if (!lockOnly.ok) return lockOnly;
  }

  // R3: renew Session Lock for the whole critical Start window (incl. network).
  return withOwnedReportLockLease(lock_owner, async (lease) => {
    __activeStartLeases.set(lock_owner, lease);
    try {
      if (lease.lost()) {
        return {
          ok: false as const,
          code: "session_lock_lost" as const,
          detail: lease.lostDetail() || "lock lost before Start body",
        };
      }
      return await runDi2Batch2ProductionUnderLease(input, lock_owner);
    } finally {
      __activeStartLeases.delete(lock_owner);
    }
  });
}

async function runDi2Batch2ProductionUnderLease(
  input: {
    job_id: string;
    freeze: FreezeRecord;
    profile: ProfileRecord;
    lock_owner: ReportLockOwner;
    birth_info?: unknown;
  },
  lock_owner: ReportLockOwner,
): Promise<Di2Batch2StartResult> {
  const job = await getXhighJob(input.job_id);
  if (!job) {
    return { ok: false, code: "missing_job", detail: `job_id=${input.job_id}` };
  }

  const sourceErr = assertSourcesMatchJob({
    job,
    freeze: input.freeze,
    profile: input.profile,
  });
  if (sourceErr) return sourceErr;

  if (
    typeof job.execution_generation !== "number" ||
    !Number.isFinite(job.execution_generation)
  ) {
    return {
      ok: false,
      code: "job_revoked",
      detail: "execution_generation missing",
    };
  }

  // Fence before binding — superseded jobs must not allocate / rewrite identity.
  {
    const live = await requireLiveExecutionFence(
      input.job_id,
      job.execution_generation,
    );
    if (!live.ok) return live;
  }

  const bound = await ensureDi2Batch2IdentityBinding({ job_id: input.job_id });
  if (!bound.ok) {
    return {
      ok: false,
      code: "binding_failed",
      detail: `${bound.code}: ${bound.detail}`,
    };
  }
  const bindingCheck = evaluateExistingDi2Batch2Binding(bound.job);
  if (!bindingCheck.ok) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: `${bindingCheck.code}: ${bindingCheck.detail}`,
    };
  }
  const binding = bindingCheck.binding;

  const reportInput = job.input as DecisionReportJobInput;
  if (binding.report_id !== reportInput.report_job_id.trim()) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "binding.report_id ≠ job report_job_id",
    };
  }

  const ziwei = resolveTrustedZiweiFactPack({
    profile: input.profile,
    birth_info: input.birth_info,
  });
  if (!ziwei.ok) return ziwei;

  const adapted = buildBatch2InputsFromDI2({
    identity: {
      session_id: job.session_id,
      freeze_id: reportInput.freeze_id,
      context_id: reportInput.context_id,
      context_version: reportInput.context_version,
      context_hash: reportInput.context_hash,
      profile_hash: reportInput.profile_hash,
      report_job_id: reportInput.report_job_id,
    },
    freeze: input.freeze,
    profile: input.profile,
    book_judgment_pack: null,
    ziwei_fact_pack: ziwei.ziwei_fact_pack,
    authorized_partner_profile: false,
  });
  if (!adapted.ok) {
    return {
      ok: false,
      code: "adapter_failed",
      detail: `${adapted.code}: ${adapted.detail}`,
    };
  }
  if (adapted.inputs.report_id !== binding.report_id) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "adapter report_id ≠ binding.report_id",
    };
  }

  const gen = await readGeneration(binding.report_id, binding.generation_id);
  if (!gen.ok) {
    return {
      ok: false,
      code: "generation_missing",
      detail: gen.detail ?? gen.code,
    };
  }
  if (!gen.value) {
    return {
      ok: false,
      code: "generation_missing",
      detail: "Unit B GenerationRecord missing — refusing to allocate a second identity",
    };
  }
  const generationRecord = gen.value;
  if (generationRecord.generation_epoch !== binding.batch3_generation_epoch) {
    return {
      ok: false,
      code: "generation_epoch_mismatch",
      detail:
        `live_epoch=${generationRecord.generation_epoch} binding_epoch=${binding.batch3_generation_epoch}`,
    };
  }

  const execution_generation = job.execution_generation;
  const locale = job.locale || reportInput.locale || "en";

  // Claim Start under session lock + fence BEFORE any Batch2/Batch3 side effect.
  const beforeClaim = await requireStartAuthority({
    job_id: input.job_id,
    execution_generation,
    lock_owner,
    gate: "before_claim",
  });
  if (!beforeClaim.ok) return beforeClaim;
  const claimed = await advanceStartGateUnderFence({
    job_id: input.job_id,
    execution_generation,
    phase: "claimed",
  });
  if (!claimed.ok) return claimed;

  // Idempotent path: Batch2 job already exists for this binding.
  const existing = await loadJobRawBlobs(binding.report_id, binding.generation_id);
  if (!existing.ok) {
    return {
      ok: false,
      code: "kv_unavailable",
      detail: existing.detail ?? existing.code,
    };
  }
  if (existing.value) {
    const meta = existing.value.meta;
    if (
      meta.report_id !== binding.report_id ||
      meta.generation_id !== binding.generation_id
    ) {
      return {
        ok: false,
        code: "batch2_job_identity_mismatch",
        detail: "existing Batch2 job identity does not match DI2 binding",
      };
    }
    if (
      typeof meta.generation_epoch === "number" &&
      meta.generation_epoch !== binding.batch3_generation_epoch
    ) {
      return {
        ok: false,
        code: "generation_epoch_mismatch",
        detail: "existing Batch2 job epoch ≠ binding epoch",
      };
    }

    let last_dispatch: Di2Batch2ProductionState["last_dispatch"] = "none";
    if (meta.status !== "completed") {
      const epoch =
        typeof meta.generation_epoch === "number"
          ? meta.generation_epoch
          : binding.batch3_generation_epoch;
      const dispatched = await dispatchOrchestrateOrRecover({
        job_id: input.job_id,
        execution_generation,
        lock_owner,
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: epoch,
        locale,
        mode: "recover",
      });
      if (!dispatched.ok) return dispatched;
      last_dispatch = dispatched.last_dispatch;
    }

    const production: Di2Batch2ProductionState = {
      report_id: binding.report_id,
      generation_id: binding.generation_id,
      generation_epoch: binding.batch3_generation_epoch,
      status: "reused",
      started_at:
        job.batch2_production_state?.started_at ?? new Date().toISOString(),
      last_dispatch,
    };
    const stamped = await stampProductionState(
      input.job_id,
      execution_generation,
      production,
    );
    if (!stamped.ok) return stamped;
    await advanceStartGateUnderFence({
      job_id: input.job_id,
      execution_generation,
      phase: "done",
    }).catch(() => undefined);
    return {
      ok: true,
      binding,
      production: stamped.job.batch2_production_state ?? production,
      reused: true,
      job: stamped.job,
    };
  }

  // Fresh Start under session lock: activate → createJob → dispatch → send.
  // Do NOT call allocateGeneration again (Unit B already created the record).
  await runSideEffectProbe("before_activate", {
    job_id: input.job_id,
    execution_generation,
  });
  const beforeActivate = await requireStartAuthority({
    job_id: input.job_id,
    execution_generation,
    lock_owner,
    gate: "before_activate",
  });
  if (!beforeActivate.ok) return beforeActivate;
  const activateGate = await advanceStartGateUnderFence({
    job_id: input.job_id,
    execution_generation,
    phase: "before_activate",
  });
  if (!activateGate.ok) return activateGate;

  const activated = await awaitUnderStartLease(lock_owner, () =>
    activateGeneration({
      record: generationRecord,
      job_id: binding.report_id,
    }),
  );
  if (!activated.ok) return activated;
  if (!activated.value.ok) {
    return {
      ok: false,
      code: "activate_failed",
      detail: activated.value.detail ?? activated.value.code,
    };
  }
  __di2Batch2StartSideEffectCountsForTests.activate += 1;

  await runSideEffectProbe("before_create_job", {
    job_id: input.job_id,
    execution_generation,
  });
  const beforeCreate = await requireStartAuthority({
    job_id: input.job_id,
    execution_generation,
    lock_owner,
    gate: "before_create_job",
  });
  if (!beforeCreate.ok) return beforeCreate;
  const createGate = await advanceStartGateUnderFence({
    job_id: input.job_id,
    execution_generation,
    phase: "before_create_job",
  });
  if (!createGate.ok) return createGate;

  const createdWrap = await awaitUnderStartLease(lock_owner, () =>
    createJobAndPersist({
      report_id: binding.report_id,
      generation_id: binding.generation_id,
      locale,
      inputs: adapted.inputs,
      status: "orchestrating",
      generation_epoch: binding.batch3_generation_epoch,
    }),
  );
  if (!createdWrap.ok) return createdWrap;
  const created = createdWrap.value;
  if (!created.ok) {
    // Race: another Start created the job — re-enter idempotent path (still gated).
    const raced = await loadJobRawBlobs(binding.report_id, binding.generation_id);
    if (raced.ok && raced.value) {
      const dispatched = await dispatchOrchestrateOrRecover({
        job_id: input.job_id,
        execution_generation,
        lock_owner,
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        locale,
        mode: "recover",
      });
      if (!dispatched.ok) return dispatched;
      const production: Di2Batch2ProductionState = {
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        status: "reused",
        started_at: new Date().toISOString(),
        last_dispatch: dispatched.last_dispatch,
      };
      const stamped = await stampProductionState(
        input.job_id,
        execution_generation,
        production,
      );
      if (!stamped.ok) return stamped;
      return {
        ok: true,
        binding,
        production: stamped.job.batch2_production_state ?? production,
        reused: true,
        job: stamped.job,
      };
    }
    return {
      ok: false,
      code: "job_create_failed",
      detail: created.detail ?? created.code,
    };
  }

  if (
    created.value.report_id !== binding.report_id ||
    created.value.generation_id !== binding.generation_id
  ) {
    return {
      ok: false,
      code: "batch2_job_identity_mismatch",
      detail: "created Batch2 job identity ≠ DI2 binding",
    };
  }
  __di2Batch2StartSideEffectCountsForTests.create_job += 1;

  const dispatched = await dispatchOrchestrateOrRecover({
    job_id: input.job_id,
    execution_generation,
    lock_owner,
    report_id: binding.report_id,
    generation_id: binding.generation_id,
    generation_epoch: binding.batch3_generation_epoch,
    locale,
    mode: "orchestrate",
  });
  if (!dispatched.ok) return dispatched;

  const production: Di2Batch2ProductionState = {
    report_id: binding.report_id,
    generation_id: binding.generation_id,
    generation_epoch: binding.batch3_generation_epoch,
    status: "started",
    started_at: new Date().toISOString(),
    last_dispatch: dispatched.last_dispatch,
  };
  const stamped = await stampProductionState(
    input.job_id,
    execution_generation,
    production,
  );
  if (!stamped.ok) return stamped;
  await advanceStartGateUnderFence({
    job_id: input.job_id,
    execution_generation,
    phase: "done",
  }).catch(() => undefined);

  return {
    ok: true,
    binding,
    production: stamped.job.batch2_production_state ?? production,
    reused: false,
    job: stamped.job,
  };
}
