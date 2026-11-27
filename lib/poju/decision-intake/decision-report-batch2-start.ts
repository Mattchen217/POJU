/**
 * Unit C — DI2 Start → Batch2 production engine (Start only).
 *
 * After DI2 authorization / job / fence / charge, kicks Batch2 via the same
 * bootstrap sequence as startReportBatch2Production, but:
 * - Reuses Unit B binding (no second allocateGeneration when gen exists)
 * - Builds inputs via Unit A adapter from verified Freeze/Profile
 * - Resolves ZiweiFactPack only from server-trusted birth recompute
 * - Never falls back to the legacy DI2 eight-page runner
 * - Never accepts client-submitted ZFP objects
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
  | "cas_failed";

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

async function dispatchOrchestrateOrRecover(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  locale: string;
  mode: "orchestrate" | "recover";
}): Promise<
  | { ok: true; last_dispatch: "orchestrate" | "recover" }
  | { ok: false; code: Di2Batch2StartErrorCode; detail: string }
> {
  const { enqueueDispatchIntent, markIntentFailed, markIntentSent } = await import(
    "@/lib/llm/pro/delivery/decision-report-v2/batch3/dispatch-intent"
  );

  if (input.mode === "recover") {
    const recover = await sendReportBatch2Events([
      buildRecoverPayload({
        report_id: input.report_id,
        generation_id: input.generation_id,
        generation_epoch: input.generation_epoch,
        locale: input.locale,
      }),
    ]);
    if (!recover.ok) {
      return {
        ok: false,
        code: "dispatch_uncertain",
        detail: `recover_send_failed:${recover.code}:${recover.detail}`,
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

  const send = await sendReportBatch2Events([payload]);
  if (!send.ok) {
    await markIntentFailed(intent.value, send.detail);
    const recover = await sendReportBatch2Events([
      buildRecoverPayload({
        report_id: input.report_id,
        generation_id: input.generation_id,
        generation_epoch: input.generation_epoch,
        locale: input.locale,
      }),
    ]);
    if (recover.ok) {
      // Durable job + recover triggered — do not mint a second generation.
      return { ok: true, last_dispatch: "recover" };
    }
    return {
      ok: false,
      code: "dispatch_uncertain",
      detail:
        `orchestrate_failed:${send.code}:${send.detail};` +
        `recover_failed:${recover.code}:${recover.detail}`,
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
  if (gen.value.generation_epoch !== binding.batch3_generation_epoch) {
    return {
      ok: false,
      code: "generation_epoch_mismatch",
      detail:
        `live_epoch=${gen.value.generation_epoch} binding_epoch=${binding.batch3_generation_epoch}`,
    };
  }

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
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: epoch,
        locale: job.locale || reportInput.locale || "en",
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
      job.execution_generation,
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

  // Fresh Start: activate pre-bound generation → create job → orchestrate.
  // Do NOT call allocateGeneration again (Unit B already created the record).
  const activated = await activateGeneration({
    record: gen.value,
    job_id: binding.report_id,
  });
  if (!activated.ok) {
    return {
      ok: false,
      code: "activate_failed",
      detail: activated.detail ?? activated.code,
    };
  }

  const created = await createJobAndPersist({
    report_id: binding.report_id,
    generation_id: binding.generation_id,
    locale: job.locale || reportInput.locale || "en",
    inputs: adapted.inputs,
    status: "orchestrating",
    generation_epoch: binding.batch3_generation_epoch,
  });
  if (!created.ok) {
    // Race: another Start created the job — re-enter idempotent path.
    const raced = await loadJobRawBlobs(binding.report_id, binding.generation_id);
    if (raced.ok && raced.value) {
      const dispatched = await dispatchOrchestrateOrRecover({
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        locale: job.locale || reportInput.locale || "en",
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
        job.execution_generation,
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

  const dispatched = await dispatchOrchestrateOrRecover({
    report_id: binding.report_id,
    generation_id: binding.generation_id,
    generation_epoch: binding.batch3_generation_epoch,
    locale: job.locale || reportInput.locale || "en",
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
    job.execution_generation,
    production,
  );
  if (!stamped.ok) return stamped;

  return {
    ok: true,
    binding,
    production: stamped.job.batch2_production_state ?? production,
    reused: false,
    job: stamped.job,
  };
}
