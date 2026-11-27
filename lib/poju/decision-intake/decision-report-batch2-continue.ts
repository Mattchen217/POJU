/**
 * Unit D / R1 — DI2 Continue / Recovery → Batch2/3 (recovery only).
 *
 * Resumes the persisted Batch2 Generation / Job for a DI2 decision_report job.
 * Does NOT: allocate identity, create Generation, send full ORCHESTRATE,
 * or fall back to the legacy DI2 eight-page runner.
 * Unit E: when Batch2/3 production is already complete, Continue resumes only
 * Final Delivery (DI2 Report Store) — never regenerates pages or reallocates.
 *
 * Reuses Unit B binding + Unit C Session Lock / lease (holder "start").
 * R1: recomputes di2ReportJobId / generation_id; verifies Freeze/Profile/Context
 * against authority (or test snapshot). Status must not use legacy DI2 lease
 * to interrupt Batch2-bound jobs. Status for bound jobs is Batch2-authoritative
 * (see decision-report-batch2-status / buildDecisionReportStatus).
 */

import {
  isReportBatch2SharedStoreAvailable,
  loadJobRawBlobs,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import {
  buildRecoverPayload,
  getReportBatch2EventSenderForTests,
  isReportBatch2InngestConfigured,
  sendReportBatch2Events,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/dispatch";
import {
  assertGenerationActive,
  readGeneration,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3/generation-store";
import {
  di2Batch2GenerationId,
  evaluateExistingDi2Batch2Binding,
  type Di2Batch2IdentityBinding,
} from "@/lib/poju/decision-intake/decision-report-batch2-identity";
import {
  di2ReportJobId,
  isDecisionReportJobInput,
  type DecisionReportJobInput,
} from "@/lib/poju/decision-intake/decision-report-types";
import { loadVerifiedFreezeRecord } from "@/lib/poju/decision-authority/server/freeze-authority";
import { loadVerifiedProfileRecord } from "@/lib/poju/decision-authority/server/profile-authority";
import type {
  FreezeRecord,
  ProfileRecord,
} from "@/lib/poju/decision-authority/types";
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
import { getXhighJob } from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import { attemptDi2Batch2FinalDelivery } from "./decision-report-batch2-final-delivery";

export type Di2Batch2ContinueOutcome =
  | "observing"
  | "recovered"
  | "ready_for_delivery"
  | "delivered"
  | "job_running";

export type Di2Batch2ContinueErrorCode =
  | "missing_job"
  | "wrong_phase"
  | "binding_missing"
  | "binding_invalid"
  | "identity_mismatch"
  | "identity_unverified"
  | "job_revoked"
  | "generation_missing"
  | "generation_stale"
  | "generation_epoch_mismatch"
  | "batch2_job_missing"
  | "batch2_job_unrecoverable"
  | "kv_unavailable"
  | "inngest_unavailable"
  | "session_lock_required"
  | "session_lock_lost"
  | "dispatch_uncertain"
  | "cas_failed"
  | "final_delivery_denied"
  | "final_delivery_unconfirmed"
  | "final_delivery_failed";

export type Di2Batch2ContinueResult =
  | {
      ok: true;
      outcome: Di2Batch2ContinueOutcome;
      binding: Di2Batch2IdentityBinding;
      job: PojuXhighJob;
      batch2_status: string | null;
      recover_sent: boolean;
    }
  | { ok: false; code: Di2Batch2ContinueErrorCode; detail: string };

/** @internal tests only */
export const __di2Batch2ContinueSideEffectCountsForTests = {
  recover_send: 0,
  orchestrate_send: 0,
  allocate_generation: 0,
  ensure_binding: 0,
  create_job: 0,
  activate_generation: 0,
  old_runner_dispatch: 0,
};

/** @internal tests only */
export function __resetDi2Batch2ContinueSideEffectCountsForTests(): void {
  __di2Batch2ContinueSideEffectCountsForTests.recover_send = 0;
  __di2Batch2ContinueSideEffectCountsForTests.orchestrate_send = 0;
  __di2Batch2ContinueSideEffectCountsForTests.allocate_generation = 0;
  __di2Batch2ContinueSideEffectCountsForTests.ensure_binding = 0;
  __di2Batch2ContinueSideEffectCountsForTests.create_job = 0;
  __di2Batch2ContinueSideEffectCountsForTests.activate_generation = 0;
  __di2Batch2ContinueSideEffectCountsForTests.old_runner_dispatch = 0;
}

type ContinueLeaseProbe = (ctx: {
  job_id: string;
  phase: "before_recover" | "after_lock_assert";
}) => void | Promise<void>;

let __continueLeaseProbe: ContinueLeaseProbe | null = null;

/** @internal tests only */
export function __setDi2Batch2ContinueLeaseProbeForTests(
  fn: ContinueLeaseProbe | null,
): void {
  __continueLeaseProbe = fn;
}

const __activeContinueLeases = new WeakMap<ReportLockOwner, ReportLockLeaseHandle>();

function leaseLost(
  lock_owner: ReportLockOwner,
): { ok: false; code: Di2Batch2ContinueErrorCode; detail: string } | null {
  const lease = __activeContinueLeases.get(lock_owner);
  if (!lease?.lost()) return null;
  return {
    ok: false,
    code: "session_lock_lost",
    detail: lease.lostDetail() || "continue lease lost",
  };
}

async function assertHeldStartLock(
  lock_owner: ReportLockOwner,
): Promise<{ ok: true } | { ok: false; code: Di2Batch2ContinueErrorCode; detail: string }> {
  const lost = leaseLost(lock_owner);
  if (lost) return lost;
  try {
    const updated = await updateOwnedReportLock(lock_owner);
    if (!updated) {
      return {
        ok: false,
        code: "session_lock_lost",
        detail: "session start lock no longer owned — refusing Continue side effects",
      };
    }
    if (updated.holder !== "start") {
      return {
        ok: false,
        code: "session_lock_lost",
        detail: `session lock holder=${updated.holder} (expected start)`,
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

async function requireContinueAuthority(input: {
  job_id: string;
  execution_generation: number;
  lock_owner: ReportLockOwner;
}): Promise<{ ok: true } | { ok: false; code: Di2Batch2ContinueErrorCode; detail: string }> {
  const lost = leaseLost(input.lock_owner);
  if (lost) return lost;
  const held = await assertHeldStartLock(input.lock_owner);
  if (!held.ok) return held;
  const lost2 = leaseLost(input.lock_owner);
  if (lost2) return lost2;
  try {
    await assertDeliveryExecutionAuthority(input.job_id, input.execution_generation);
    return { ok: true };
  } catch (e) {
    if (e instanceof DeliveryExecutionRevokedError) {
      return { ok: false, code: "job_revoked", detail: e.message };
    }
    return {
      ok: false,
      code: "cas_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * @internal tests only — inject Freeze/Profile authority snapshot so Continue
 * identity checks can run without sealing a full ledger Freeze in MemoryKv.
 */
let __authoritySnapshotForTests: {
  freeze: Pick<
    FreezeRecord,
    | "session_id"
    | "freeze_id"
    | "context_id"
    | "context_version"
    | "context_hash"
    | "profile_hash"
  >;
  profile: Pick<
    ProfileRecord,
    "session_id" | "freeze_id" | "profile_id" | "profile_hash"
  >;
} | null = null;

/** @internal tests only */
export function __setDi2Batch2ContinueAuthoritySnapshotForTests(
  snapshot: typeof __authoritySnapshotForTests,
): void {
  __authoritySnapshotForTests = snapshot;
}

/** @internal tests only — Final Delivery reuses Continue's MemoryKv authority snapshot. */
export function __peekDi2Batch2ContinueAuthoritySnapshotForTests(): typeof __authoritySnapshotForTests {
  return __authoritySnapshotForTests;
}

/**
 * Validate binding against the live DI2 job input.
 * Recomputes di2ReportJobId / generation_id — does not treat string equality alone
 * as proof. Does not allocate or rewrite binding.
 */
export function validateDi2Batch2ContinueIdentity(input: {
  job: PojuXhighJob;
  binding: Di2Batch2IdentityBinding;
}): { ok: true } | { ok: false; code: Di2Batch2ContinueErrorCode; detail: string } {
  const { job, binding } = input;
  if (job.phase !== "decision_report" || !isDecisionReportJobInput(job.input)) {
    return { ok: false, code: "wrong_phase", detail: "not a decision_report job" };
  }
  const reportInput = job.input as DecisionReportJobInput;
  if (
    typeof job.execution_generation !== "number" ||
    !Number.isFinite(job.execution_generation)
  ) {
    return { ok: false, code: "job_revoked", detail: "execution_generation missing" };
  }
  if (job.session_id !== reportInput.session_id) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "job.session_id ≠ input.session_id",
    };
  }
  if (!reportInput.freeze_id?.trim()) {
    return { ok: false, code: "identity_mismatch", detail: "freeze_id missing on job input" };
  }
  if (!reportInput.context_id?.trim() || !reportInput.context_hash?.trim()) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "context identity missing on job input",
    };
  }
  if (
    typeof reportInput.context_version !== "number" ||
    !Number.isFinite(reportInput.context_version)
  ) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "context_version missing on job input",
    };
  }
  if (!reportInput.profile_id?.trim() || !reportInput.profile_hash?.trim()) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "profile identity missing on job input",
    };
  }

  // Recompute stable report identity from authorized job fields (Unit B formula).
  const expectedReportJobId = di2ReportJobId({
    session_id: reportInput.session_id,
    freeze_id: reportInput.freeze_id,
    profile_hash: reportInput.profile_hash,
    execution_generation: job.execution_generation,
    report_schema_version: reportInput.report_schema_version,
  });
  if (reportInput.report_job_id.trim() !== expectedReportJobId) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail:
        `report_job_id does not match recomputed di2ReportJobId ` +
        `(stored=${reportInput.report_job_id.trim()} expected=${expectedReportJobId})`,
    };
  }
  if (binding.report_id !== expectedReportJobId) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "binding.report_id ≠ recomputed di2ReportJobId",
    };
  }
  if (binding.di2_execution_generation !== job.execution_generation) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "binding.di2_execution_generation ≠ job.execution_generation",
    };
  }
  const expectedGid = di2Batch2GenerationId(expectedReportJobId);
  if (binding.generation_id !== expectedGid) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: `binding.generation_id ≠ recomputed ${expectedGid}`,
    };
  }
  if (
    job.batch2_production_state &&
    (job.batch2_production_state.report_id !== binding.report_id ||
      job.batch2_production_state.generation_id !== binding.generation_id)
  ) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "batch2_production_state identity ≠ binding",
    };
  }
  return { ok: true };
}

/**
 * Verify Freeze / Profile / Context against durable authority records (or a
 * test-injected snapshot). Presence on the job alone is not consistency.
 */
export async function verifyDi2Batch2ContinueAuthorityIdentity(input: {
  job: PojuXhighJob;
  binding: Di2Batch2IdentityBinding;
}): Promise<{ ok: true } | { ok: false; code: Di2Batch2ContinueErrorCode; detail: string }> {
  const base = validateDi2Batch2ContinueIdentity(input);
  if (!base.ok) return base;
  const reportInput = input.job.input as DecisionReportJobInput;

  let freeze: {
    session_id: string;
    freeze_id: string;
    context_id: string;
    context_version: number;
    context_hash: string;
    profile_hash: string | null;
  };
  let profile: {
    session_id: string;
    freeze_id: string;
    profile_id: string;
    profile_hash: string;
  };

  if (__authoritySnapshotForTests) {
    const snapProfile = __authoritySnapshotForTests.profile;
    if (!snapProfile.profile_id?.trim() || !snapProfile.profile_hash?.trim()) {
      return {
        ok: false,
        code: "identity_unverified",
        detail: "authority snapshot profile_id/profile_hash missing",
      };
    }
    freeze = {
      ...__authoritySnapshotForTests.freeze,
      profile_hash: __authoritySnapshotForTests.freeze.profile_hash ?? null,
    };
    profile = {
      session_id: snapProfile.session_id,
      freeze_id: snapProfile.freeze_id,
      profile_id: snapProfile.profile_id,
      profile_hash: snapProfile.profile_hash,
    };
  } else {
    try {
      const fr = await loadVerifiedFreezeRecord(
        reportInput.session_id,
        reportInput.freeze_id,
      );
      freeze = {
        session_id: fr.session_id,
        freeze_id: fr.freeze_id,
        context_id: fr.context_id,
        context_version: fr.context_version,
        context_hash: fr.context_hash,
        profile_hash: fr.profile_hash,
      };
      const pr = await loadVerifiedProfileRecord({
        session_id: reportInput.session_id,
        freeze: fr,
        profile_hash: reportInput.profile_hash,
      });
      if (!pr.profile_id?.trim() || !pr.profile_hash?.trim()) {
        return {
          ok: false,
          code: "identity_unverified",
          detail: "Profile authority missing profile_id/profile_hash",
        };
      }
      profile = {
        session_id: pr.session_id,
        freeze_id: pr.freeze_id,
        profile_id: pr.profile_id,
        profile_hash: pr.profile_hash,
      };
    } catch (e) {
      return {
        ok: false,
        code: "identity_unverified",
        detail:
          e instanceof Error
            ? e.message
            : "Freeze/Profile authority could not be verified for Continue",
      };
    }
  }

  if (freeze.session_id !== reportInput.session_id || freeze.freeze_id !== reportInput.freeze_id) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "Freeze authority session/freeze_id ≠ job input",
    };
  }
  if (
    freeze.context_id !== reportInput.context_id ||
    freeze.context_version !== reportInput.context_version ||
    freeze.context_hash !== reportInput.context_hash
  ) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "Freeze authority context identity ≠ job input",
    };
  }
  if (freeze.profile_hash && freeze.profile_hash !== reportInput.profile_hash) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "Freeze sealed profile_hash ≠ job input profile_hash",
    };
  }
  if (
    profile.session_id !== reportInput.session_id ||
    profile.freeze_id !== reportInput.freeze_id ||
    profile.profile_id !== reportInput.profile_id ||
    profile.profile_hash !== reportInput.profile_hash
  ) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "Profile authority identity ≠ job input",
    };
  }
  void input.binding;
  return { ok: true };
}

async function sendRecoverUnderLease(input: {
  lock_owner: ReportLockOwner;
  job_id: string;
  execution_generation: number;
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  locale: string;
}): Promise<{ ok: true } | { ok: false; code: Di2Batch2ContinueErrorCode; detail: string }> {
  const pre = await requireContinueAuthority({
    job_id: input.job_id,
    execution_generation: input.execution_generation,
    lock_owner: input.lock_owner,
  });
  if (!pre.ok) return pre;

  await __continueLeaseProbe?.({
    job_id: input.job_id,
    phase: "after_lock_assert",
  });

  const afterProbe = await requireContinueAuthority({
    job_id: input.job_id,
    execution_generation: input.execution_generation,
    lock_owner: input.lock_owner,
  });
  if (!afterProbe.ok) return afterProbe;

  await __continueLeaseProbe?.({
    job_id: input.job_id,
    phase: "before_recover",
  });

  const beforeSend = await requireContinueAuthority({
    job_id: input.job_id,
    execution_generation: input.execution_generation,
    lock_owner: input.lock_owner,
  });
  if (!beforeSend.ok) return beforeSend;

  const send = await sendReportBatch2Events([
    buildRecoverPayload({
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: input.generation_epoch,
      locale: input.locale,
    }),
  ]);
  __di2Batch2ContinueSideEffectCountsForTests.recover_send += 1;

  const afterSend = await requireContinueAuthority({
    job_id: input.job_id,
    execution_generation: input.execution_generation,
    lock_owner: input.lock_owner,
  });
  if (!afterSend.ok) {
    // In-flight RECOVER cannot be recalled; Fail Closed for further side effects.
    return afterSend;
  }
  if (!send.ok) {
    return {
      ok: false,
      code: "dispatch_uncertain",
      detail: `recover_send_failed:${send.code}:${send.detail}`,
    };
  }
  return { ok: true };
}

/**
 * Continue / Recovery for a DI2 decision_report job that already has Unit B binding.
 * Caller must hold DI2 Report Session Lock as holder "start".
 */
export async function continueDi2Batch2Production(input: {
  job_id: string;
  lock_owner: ReportLockOwner;
}): Promise<Di2Batch2ContinueResult> {
  if (!input.lock_owner?.session_id || !input.lock_owner.lock_token) {
    return {
      ok: false,
      code: "session_lock_required",
      detail: "Batch2 Continue requires DI2 session start lock owner",
    };
  }
  if (!isReportBatch2SharedStoreAvailable()) {
    return { ok: false, code: "kv_unavailable", detail: "Batch2 shared KV unavailable" };
  }
  if (!isReportBatch2InngestConfigured() && !getReportBatch2EventSenderForTests()) {
    return {
      ok: false,
      code: "inngest_unavailable",
      detail: "Batch2 Inngest unavailable and no test sender",
    };
  }

  const lock_owner = input.lock_owner;
  const held0 = await assertHeldStartLock(lock_owner);
  if (!held0.ok) return held0;

  return withOwnedReportLockLease(lock_owner, async (lease) => {
    __activeContinueLeases.set(lock_owner, lease);
    try {
      if (lease.lost()) {
        return {
          ok: false as const,
          code: "session_lock_lost" as const,
          detail: lease.lostDetail() || "lock lost before Continue body",
        };
      }
      return await runContinueUnderLease(input.job_id, lock_owner);
    } finally {
      __activeContinueLeases.delete(lock_owner);
    }
  });
}

/**
 * Unit E — Batch2/3 production complete: attempt DI2 Final Delivery only.
 * Incomplete Authority pages stay at ready_for_delivery (not DI2 completed).
 */
async function finalizeReadyForDelivery(input: {
  binding: Di2Batch2IdentityBinding;
  job: PojuXhighJob;
  batch2_status: string;
}): Promise<Di2Batch2ContinueResult> {
  const contSnap = __authoritySnapshotForTests;
  const delivered = await attemptDi2Batch2FinalDelivery(input.job, {
    authority_snapshot: contSnap
      ? {
          freeze: {
            session_id: contSnap.freeze.session_id,
            freeze_id: contSnap.freeze.freeze_id,
            context_id: contSnap.freeze.context_id,
            context_version: contSnap.freeze.context_version,
            context_hash: contSnap.freeze.context_hash,
            decision_question: null,
          },
          profile: {
            session_id: contSnap.profile.session_id,
            freeze_id: contSnap.profile.freeze_id,
            profile_id: contSnap.profile.profile_id,
            profile_hash: contSnap.profile.profile_hash,
          },
        }
      : undefined,
  });
  if (delivered.ok) {
    return {
      ok: true,
      outcome: "delivered",
      binding: input.binding,
      job: delivered.job,
      batch2_status: input.batch2_status,
      recover_sent: false,
    };
  }
  if (delivered.delivery_denied) {
    return {
      ok: false,
      code: "final_delivery_denied",
      detail: delivered.detail,
    };
  }
  if (delivered.unconfirmed) {
    return {
      ok: false,
      code: "final_delivery_unconfirmed",
      detail: delivered.detail,
    };
  }
  // Not yet Authority-complete (or other fail-closed page/identity issues):
  // remain ready_for_delivery without claiming DI2 Store success.
  if (
    delivered.code === "page_incomplete" ||
    delivered.code === "authority_invalid" ||
    delivered.code === "authority_unavailable" ||
    delivered.code === "batch2_job_missing" ||
    delivered.code === "page_map_failed" ||
    delivered.code === "page_fingerprint_mismatch"
  ) {
    return {
      ok: true,
      outcome: "ready_for_delivery",
      binding: input.binding,
      job: input.job,
      batch2_status: input.batch2_status,
      recover_sent: false,
    };
  }
  return {
    ok: false,
    code: "final_delivery_failed",
    detail: `${delivered.code}: ${delivered.detail}`,
  };
}

async function runContinueUnderLease(
  job_id: string,
  lock_owner: ReportLockOwner,
): Promise<Di2Batch2ContinueResult> {
  const job = await getXhighJob(job_id);
  if (!job) {
    return { ok: false, code: "missing_job", detail: `job_id=${job_id}` };
  }
  if (job.phase !== "decision_report" || !isDecisionReportJobInput(job.input)) {
    return { ok: false, code: "wrong_phase", detail: "not a decision_report job" };
  }

  // Read-only binding check — never ensureDi2Batch2IdentityBinding (no allocate).
  const bindingEval = evaluateExistingDi2Batch2Binding(job);
  if (!bindingEval.ok) {
    if (
      bindingEval.code === "missing_job" ||
      bindingEval.detail.includes("not set") ||
      bindingEval.detail.includes("no batch2_identity_binding")
    ) {
      return {
        ok: false,
        code: "binding_missing",
        detail: bindingEval.detail,
      };
    }
    return {
      ok: false,
      code: "binding_invalid",
      detail: `${bindingEval.code}: ${bindingEval.detail}`,
    };
  }
  const binding = bindingEval.binding;

  const idCheck = await verifyDi2Batch2ContinueAuthorityIdentity({ job, binding });
  if (!idCheck.ok) return idCheck;

  if (
    typeof job.execution_generation !== "number" ||
    !Number.isFinite(job.execution_generation)
  ) {
    return { ok: false, code: "job_revoked", detail: "execution_generation missing" };
  }

  const auth = await requireContinueAuthority({
    job_id,
    execution_generation: job.execution_generation,
    lock_owner,
  });
  if (!auth.ok) return auth;

  const gen = await readGeneration(binding.report_id, binding.generation_id);
  if (!gen.ok) {
    return {
      ok: false,
      code: "kv_unavailable",
      detail: gen.detail ?? gen.code,
    };
  }
  if (!gen.value) {
    return {
      ok: false,
      code: "generation_missing",
      detail: "Batch3 GenerationRecord missing — Continue refuses to allocate",
    };
  }
  if (gen.value.generation_epoch !== binding.batch3_generation_epoch) {
    return {
      ok: false,
      code: "generation_epoch_mismatch",
      detail:
        `live_epoch=${gen.value.generation_epoch} binding_epoch=${binding.batch3_generation_epoch}`,
    };
  }

  if (
    gen.value.status === "completed" ||
    gen.value.status === "finalizing" ||
    gen.value.status === "delivery_failed"
  ) {
    // Unit E: resume Final Delivery only — never regenerate pages / allocate Generation.
    return finalizeReadyForDelivery({ binding, job, batch2_status: gen.value.status });
  }

  if (
    gen.value.status === "superseded" ||
    gen.value.status === "failed" ||
    gen.value.status === "cancelled"
  ) {
    return {
      ok: false,
      code: "generation_stale",
      detail: `generation status=${gen.value.status} — refuse Continue on non-active Generation`,
    };
  }

  if (gen.value.status !== "active") {
    return {
      ok: false,
      code: "generation_stale",
      detail: `generation status=${gen.value.status} — refuse Continue`,
    };
  }

  const fence = await assertGenerationActive({
    report_id: binding.report_id,
    generation_id: binding.generation_id,
    generation_epoch: binding.batch3_generation_epoch,
  });
  if (!fence.ok) {
    return {
      ok: false,
      code: "generation_stale",
      detail: fence.detail ?? fence.code,
    };
  }

  const blobs = await loadJobRawBlobs(binding.report_id, binding.generation_id);
  if (!blobs.ok) {
    return {
      ok: false,
      code: "kv_unavailable",
      detail: blobs.detail ?? blobs.code,
    };
  }
  if (!blobs.value) {
    return {
      ok: false,
      code: "batch2_job_missing",
      detail: "Batch2 Job missing — Continue refuses to create a replacement",
    };
  }

  const meta = blobs.value.meta;
  if (
    meta.report_id !== binding.report_id ||
    meta.generation_id !== binding.generation_id
  ) {
    return {
      ok: false,
      code: "identity_mismatch",
      detail: "Batch2 job identity ≠ binding",
    };
  }
  if (
    typeof meta.generation_epoch === "number" &&
    meta.generation_epoch !== binding.batch3_generation_epoch
  ) {
    return {
      ok: false,
      code: "generation_epoch_mismatch",
      detail: "Batch2 job epoch ≠ binding epoch",
    };
  }

  if (meta.status === "completed") {
    return finalizeReadyForDelivery({ binding, job, batch2_status: meta.status });
  }

  if (meta.status === "failed") {
    return {
      ok: false,
      code: "batch2_job_unrecoverable",
      detail: `Batch2 job status=${meta.status}`,
    };
  }

  const reportInput = job.input as DecisionReportJobInput;
  const locale = job.locale || reportInput.locale || "en";
  const epoch =
    typeof meta.generation_epoch === "number"
      ? meta.generation_epoch
      : binding.batch3_generation_epoch;

  // Continue never sends ORCHESTRATE — only RECOVER for incomplete production.
  const recovered = await sendRecoverUnderLease({
    lock_owner,
    job_id,
    execution_generation: job.execution_generation,
    report_id: binding.report_id,
    generation_id: binding.generation_id,
    generation_epoch: epoch,
    locale,
  });
  if (!recovered.ok) return recovered;

  const live = await getXhighJob(job_id);
  return {
    ok: true,
    outcome: "recovered",
    binding,
    job: live ?? job,
    batch2_status: meta.status,
    recover_sent: true,
  };
}
