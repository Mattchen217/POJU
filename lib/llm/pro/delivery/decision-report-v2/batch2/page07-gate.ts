import { hashCanonicalPayload, missingRequiredUpstream } from "../orchestration";
import { evaluatePage07Applicability } from "../page07/applicability";
import {
  buildFace07ProductionContext,
  synthesizeFace07StatusPage,
  validateFace07ProductionOutput,
} from "../page07/production";
import { REPORT_BATCH2_EVENTS } from "./events";
import {
  appendInvocationLog,
  loadJob,
  saveJob,
  updatePageState,
} from "./job-store";
import type {
  ReportBatch2ApplicabilityEventData,
  ReportBatch2ApplicabilityResult,
} from "./types";

export async function runReportPage07ApplicabilityGate(input: {
  event: ReportBatch2ApplicabilityEventData;
  invocation_id: string;
  worker_id?: string;
}): Promise<ReportBatch2ApplicabilityResult> {
  const loaded = await loadJob(input.event.report_id, input.event.generation_id);
  if (!loaded.ok) {
    return { status: "failed", code: loaded.code, detail: loaded.detail };
  }
  if (!loaded.value) {
    return { status: "failed", code: "job_not_found", detail: "batch2 job missing" };
  }
  const job = loaded.value;

  const page_id = "07";
  const state = job.page_states.find((s) => s.page_id === page_id);
  if (state?.applicability_status) {
    return { status: "skipped" };
  }

  const missing = missingRequiredUpstream(page_id, job.page_states);
  if (missing.length) {
    return {
      status: "failed",
      code: "missing_required_upstream",
      detail: `missing upstream: ${missing.join(", ")}`,
    };
  }

  // Batch3 fencing before gate mutation (no LLM).
  let batch3Attempt: {
    task_key: string;
    attempt_id: string;
    validity_rev: number;
  } | null = null;
  const epoch = input.event.generation_epoch ?? job.generation_epoch;
  const input_fingerprint = hashCanonicalPayload({
    gate: "page07",
    upstream: input.event.upstream_output_fingerprints,
  });
  if (typeof epoch === "number") {
    const { assertGenerationActive } = await import("../batch3/generation-store");
    const fence = await assertGenerationActive({
      report_id: input.event.report_id,
      generation_id: input.event.generation_id,
      generation_epoch: epoch,
    });
    if (!fence.ok) {
      return { status: "failed", code: fence.code, detail: fence.detail };
    }
    const { fenceAndClaimPageTask } = await import("../batch3/worker-guard");
    const claimed = await fenceAndClaimPageTask({
      report_id: input.event.report_id,
      generation_id: input.event.generation_id,
      generation_epoch: epoch,
      page_id,
      task_type: "applicability",
      input_fingerprint,
      upstream_output_fingerprints: input.event.upstream_output_fingerprints,
      worker_id: input.worker_id ?? "report-page-applicability",
    });
    if (!claimed.ok) {
      if (claimed.code === "already_completed" || claimed.code === "already_claimed") {
        return { status: "skipped" };
      }
      return { status: "failed", code: claimed.code, detail: claimed.detail };
    }
    batch3Attempt = {
      task_key: claimed.value.task_key,
      attempt_id: claimed.value.attempt_id,
      validity_rev: claimed.value.validity_rev,
    };
  }

  /**
   * applicable → release Fence for subsequent generate Claim (different task_key).
   * Must not leave Fence claimed under the applicability task_key.
   */
  async function handoffForGenerate(): Promise<
    { ok: true } | { ok: false; code: string; detail: string }
  > {
    if (!batch3Attempt || typeof epoch !== "number") return { ok: true };
    const { releaseApplicabilityClaimForGenerate } = await import(
      "../batch3/claim-page-execution"
    );
    const released = await releaseApplicabilityClaimForGenerate({
      report_id: input.event.report_id,
      generation_id: input.event.generation_id,
      generation_epoch: epoch,
      page_id,
      task_key: batch3Attempt.task_key,
      attempt_id: batch3Attempt.attempt_id,
    });
    if (!released.ok) {
      return { ok: false, code: released.code, detail: released.detail };
    }
    return { ok: true };
  }

  /**
   * Terminal status pages must Authority-Commit like any formal page result.
   * commitPageResult writes Fence/Provenance/Authority + PageBlob under the claim.
   */
  async function authorityCommitTerminal(inputCommit: {
    page: unknown;
    output_fp: string;
    outcome: "skipped_not_applicable" | "insufficient_information";
    applicability_status: "not_applicable" | "insufficient_information";
  }): Promise<{ ok: true } | { ok: false; code: string; detail: string }> {
    if (!batch3Attempt || typeof epoch !== "number") {
      // Legacy path without Batch3 generation_epoch — keep Batch2-only write.
      const { setPageOutput } = await import("./job-store");
      setPageOutput(job, page_id, inputCommit.page, inputCommit.output_fp);
      updatePageState(job, page_id, {
        applicability_status: inputCommit.applicability_status,
        outcome: inputCommit.outcome,
        output_fingerprint: inputCommit.output_fp,
        input_fingerprint,
      });
      const saved = await saveJob(job);
      if (!saved.ok) {
        return { ok: false, code: saved.code, detail: saved.detail };
      }
      return { ok: true };
    }

    const { commitPageResult } = await import("../batch3/fenced-commit");
    const { reportPageDefinition } = await import("../orchestration");
    const def = reportPageDefinition(page_id);
    const committed = await commitPageResult({
      report_id: input.event.report_id,
      generation_id: input.event.generation_id,
      generation_epoch: epoch,
      page_id,
      attempt_id: batch3Attempt.attempt_id,
      task_key: batch3Attempt.task_key,
      output: inputCommit.page,
      output_fingerprint: inputCommit.output_fp,
      state_patch: {
        outcome: inputCommit.outcome,
        applicability_status: inputCommit.applicability_status,
        input_fingerprint,
        output_fingerprint: inputCommit.output_fp,
      },
      provenance: {
        report_id: input.event.report_id,
        generation_id: input.event.generation_id,
        generation_epoch: epoch,
        page_id,
        input_fingerprint,
        upstream_output_fingerprints: input.event.upstream_output_fingerprints,
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: inputCommit.output_fp,
        attempt_id: batch3Attempt.attempt_id,
        task_key: batch3Attempt.task_key,
        validity_rev: batch3Attempt.validity_rev,
      },
    });
    if (!committed.ok) {
      return { ok: false, code: committed.code, detail: committed.detail };
    }

    // Sync in-memory view only — blob already written by commitPageResult.
    // Do NOT updatePageState/setPageOutput here: that would dirty the page and
    // cause saveJob to rewrite the blob with a stale expected rev.
    job.page_outputs[page_id] = inputCommit.page;
    const idx = job.page_states.findIndex((s) => s.page_id === page_id);
    if (idx >= 0) {
      job.page_states[idx] = {
        ...job.page_states[idx],
        page_id,
        applicability_status: inputCommit.applicability_status,
        outcome: inputCommit.outcome,
        output_fingerprint: inputCommit.output_fp,
        input_fingerprint,
      };
    }
    // Persist invocation log / meta only.
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { ok: false, code: saved.code, detail: saved.detail };
    }
    return { ok: true };
  }

  const started_at = new Date().toISOString();
  const applicability = evaluatePage07Applicability(job.inputs.dc);

  appendInvocationLog(job, {
    page_id,
    event_name: REPORT_BATCH2_EVENTS.APPLICABILITY,
    worker_id: input.worker_id ?? "report-page-applicability",
    invocation_id: input.invocation_id,
    model_call_id: null,
    started_at,
    ended_at: new Date().toISOString(),
  });

  if (applicability.status === "applicable") {
    updatePageState(job, page_id, {
      applicability_status: "applicable",
      outcome: "pending",
    });
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    const handed = await handoffForGenerate();
    if (!handed.ok) {
      return { status: "failed", code: handed.code, detail: handed.detail };
    }
    return { status: "applicable", applicability_status: "applicable" };
  }

  if (applicability.status === "not_applicable") {
    const built = buildFace07ProductionContext({
      report_id: job.inputs.report_id,
      locale: job.locale,
      dc: job.inputs.dc,
      pack: job.inputs.pack,
      chart_fact_pack: job.inputs.chart_fact_pack ?? null,
      page01: job.page_outputs["01"],
      page02: job.page_outputs["02"],
      page04: job.page_outputs["04"],
      page05: job.page_outputs["05"],
      page06: job.page_outputs["06"],
      authorized_partner_profile: job.inputs.authorized_partner_profile,
    });
    const architecture =
      built.ok && built.ctx.architecture ? built.ctx.architecture : undefined;
    const synthesized = synthesizeFace07StatusPage({
      locale: job.locale,
      applicability,
      architecture,
    });
    let page: unknown = synthesized;
    if (built.ok) {
      const validated = validateFace07ProductionOutput({
        raw: synthesized,
        locale: job.locale,
        ctx: built.ctx,
      });
      if (validated.ok) {
        page = validated.page;
      }
    }
    const output_fp = hashCanonicalPayload(page);
    const committed = await authorityCommitTerminal({
      page,
      output_fp,
      outcome: "skipped_not_applicable",
      applicability_status: "not_applicable",
    });
    if (!committed.ok) {
      return { status: "failed", code: committed.code, detail: committed.detail };
    }
    return {
      status: "not_applicable",
      applicability_status: "not_applicable",
      outcome: "skipped_not_applicable",
    };
  }

  // insufficient_information — same Authority Commit rule as not_applicable.
  {
    const built = buildFace07ProductionContext({
      report_id: job.inputs.report_id,
      locale: job.locale,
      dc: job.inputs.dc,
      pack: job.inputs.pack,
      chart_fact_pack: job.inputs.chart_fact_pack ?? null,
      page01: job.page_outputs["01"],
      page02: job.page_outputs["02"],
      page04: job.page_outputs["04"],
      page05: job.page_outputs["05"],
      page06: job.page_outputs["06"],
      authorized_partner_profile: job.inputs.authorized_partner_profile,
    });
    const architecture =
      built.ok && built.ctx.architecture ? built.ctx.architecture : undefined;
    const synthesized = synthesizeFace07StatusPage({
      locale: job.locale,
      applicability,
      architecture,
    });
    let page: unknown = synthesized;
    if (built.ok) {
      const validated = validateFace07ProductionOutput({
        raw: synthesized,
        locale: job.locale,
        ctx: built.ctx,
      });
      if (validated.ok) {
        page = validated.page;
      }
    }
    const output_fp = hashCanonicalPayload(page);
    const committed = await authorityCommitTerminal({
      page,
      output_fp,
      outcome: "insufficient_information",
      applicability_status: "insufficient_information",
    });
    if (!committed.ok) {
      return { status: "failed", code: committed.code, detail: committed.detail };
    }
    return {
      status: "insufficient_information",
      applicability_status: "insufficient_information",
      outcome: "insufficient_information",
    };
  }
}
