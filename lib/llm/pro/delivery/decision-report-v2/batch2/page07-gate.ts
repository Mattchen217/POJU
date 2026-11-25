import { hashCanonicalPayload, missingRequiredUpstream } from "../orchestration";
import { evaluatePage07Applicability } from "../page07/applicability";
import {
  buildFace07ProductionContext,
  synthesizeFace07StatusPage,
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

type BuiltTerminalPage =
  | { ok: true; page: unknown; output_fp: string }
  | { ok: false; code: string; detail: string };

/** Test-only: force context build / status validation outcomes. */
let page07StatusBuildHookForTests:
  | null
  | (() => BuiltTerminalPage | null) = null;

export function setPage07StatusBuildHookForTests(
  hook: (() => BuiltTerminalPage | null) | null,
): void {
  page07StatusBuildHookForTests = hook;
}

/** Test-only: make the next handoff call fail once (or always while set). */
let page07HandoffFailHookForTests:
  | null
  | (() => { ok: false; code: string; detail: string } | null) = null;

export function setPage07HandoffFailHookForTests(
  hook: (() => { ok: false; code: string; detail: string } | null) | null,
): void {
  page07HandoffFailHookForTests = hook;
}

/**
 * Status-page validation (equivalent gate for system-synthesized terminals).
 * validateFace07ProductionOutput is LLM-path oriented and intentionally rejects
 * insufficient_information contexts — do not use it as a fail-open fallback.
 */
function validateFace07StatusPage(input: {
  page: unknown;
  expected_status: "not_applicable" | "insufficient_information";
}): BuiltTerminalPage {
  if (!input.page || typeof input.page !== "object") {
    return {
      ok: false,
      code: "page07_status_validation_failed",
      detail: "status page is not an object",
    };
  }
  const page = input.page as Record<string, unknown>;
  if (page.page !== "07" || page.face !== "07") {
    return {
      ok: false,
      code: "page07_status_validation_failed",
      detail: "status page missing page/face=07",
    };
  }
  if (page.schema_version !== "face07-v2") {
    return {
      ok: false,
      code: "page07_status_validation_failed",
      detail: `unexpected schema_version=${String(page.schema_version)}`,
    };
  }
  if (page.applicability_status !== input.expected_status) {
    return {
      ok: false,
      code: "page07_status_validation_failed",
      detail: `applicability_status=${String(page.applicability_status)} expected ${input.expected_status}`,
    };
  }
  const expectedGen =
    input.expected_status === "not_applicable"
      ? "skipped_not_applicable"
      : "insufficient_information";
  if (page.generation_status !== expectedGen) {
    return {
      ok: false,
      code: "page07_status_validation_failed",
      detail: `generation_status=${String(page.generation_status)} expected ${expectedGen}`,
    };
  }
  if (typeof page.applicability_reason !== "string" || !page.applicability_reason.trim()) {
    return {
      ok: false,
      code: "page07_status_validation_failed",
      detail: "missing applicability_reason",
    };
  }
  return {
    ok: true,
    page: input.page,
    output_fp: hashCanonicalPayload(input.page),
  };
}

/**
 * Build + validate a Page07 status page. Fail closed — never Commit unvalidated
 * synthesized content.
 */
function buildValidatedStatusPage(input: {
  job: import("./types").ReportBatch2JobRecord;
  applicability: ReturnType<typeof evaluatePage07Applicability>;
  expected_status: "not_applicable" | "insufficient_information";
}): BuiltTerminalPage {
  if (page07StatusBuildHookForTests) {
    const forced = page07StatusBuildHookForTests();
    if (forced) return forced;
  }
  const built = buildFace07ProductionContext({
    report_id: input.job.inputs.report_id,
    locale: input.job.locale,
    dc: input.job.inputs.dc,
    pack: input.job.inputs.pack,
    chart_fact_pack: input.job.inputs.chart_fact_pack ?? null,
    page01: input.job.page_outputs["01"],
    page02: input.job.page_outputs["02"],
    page04: input.job.page_outputs["04"],
    page05: input.job.page_outputs["05"],
    page06: input.job.page_outputs["06"],
    authorized_partner_profile: input.job.inputs.authorized_partner_profile,
  });
  if (!built.ok) {
    return {
      ok: false,
      code: "page07_context_build_failed",
      detail: `buildFace07ProductionContext failed: ${built.reason}`,
    };
  }
  const synthesized = synthesizeFace07StatusPage({
    locale: input.job.locale,
    applicability: input.applicability,
    architecture: built.ctx.architecture,
  });
  // Status pages use a dedicated structural gate (same rules both terminals).
  // LLM-path validateFace07ProductionOutput intentionally rejects
  // insufficient_information contexts — not used for system status pages.
  return validateFace07StatusPage({
    page: synthesized,
    expected_status: input.expected_status,
  });
}

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
  const epoch = input.event.generation_epoch ?? job.generation_epoch;
  const input_fingerprint = hashCanonicalPayload({
    gate: "page07",
    upstream: input.event.upstream_output_fingerprints,
  });

  /**
   * Resume applicability → generate handoff when judgment already saved as
   * applicable but Fence was never released (crash / handoff failure).
   */
  async function resumeApplicableHandoffIfNeeded(): Promise<
    ReportBatch2ApplicabilityResult | null
  > {
    if (state?.applicability_status !== "applicable") return null;
    // Terminal generate already ran / page finished — safe skip.
    if (
      state.outcome &&
      state.outcome !== "pending" &&
      state.outcome !== "repair_queued"
    ) {
      return { status: "skipped" };
    }
    if (typeof epoch !== "number") {
      return { status: "skipped" };
    }
    const { readPageFence } = await import("../batch3/page-fence");
    const { readTask } = await import("../batch3/task-store");
    const { releaseApplicabilityClaimForGenerate } = await import(
      "../batch3/claim-page-execution"
    );
    const fence = await readPageFence(
      input.event.report_id,
      input.event.generation_id,
      page_id,
    );
    if (!fence.ok) {
      return { status: "failed", code: fence.code, detail: fence.detail };
    }
    if (!fence.value || fence.value.status === "open") {
      // Handoff already done (or never claimed) — Generate can proceed.
      return { status: "skipped" };
    }
    if (
      fence.value.status === "committed" ||
      fence.value.status === "stale"
    ) {
      return { status: "skipped" };
    }
    if (fence.value.status !== "claimed" || !fence.value.task_key || !fence.value.attempt_id) {
      return { status: "skipped" };
    }
    const task = await readTask(
      input.event.report_id,
      input.event.generation_id,
      fence.value.task_key,
    );
    if (!task.ok) {
      return { status: "failed", code: task.code, detail: task.detail };
    }
    // Another task_type (e.g. generate) already owns the fence — do not steal.
    if (task.value && task.value.task_type !== "applicability") {
      return { status: "skipped" };
    }
    const released = await releaseApplicabilityClaimForGenerate({
      report_id: input.event.report_id,
      generation_id: input.event.generation_id,
      generation_epoch: epoch,
      page_id,
      task_key: fence.value.task_key,
      attempt_id: fence.value.attempt_id,
    });
    if (!released.ok) {
      return {
        status: "failed",
        code: released.code,
        detail: released.detail,
      };
    }
    return { status: "applicable", applicability_status: "applicable" };
  }

  // Terminal applicability results already committed — skip.
  if (
    state?.applicability_status === "not_applicable" ||
    state?.applicability_status === "insufficient_information"
  ) {
    return { status: "skipped" };
  }

  // applicable judgment may still need handoff completion.
  if (state?.applicability_status === "applicable") {
    const resumed = await resumeApplicableHandoffIfNeeded();
    if (resumed) return resumed;
    return { status: "skipped" };
  }

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

  async function handoffForGenerate(): Promise<
    { ok: true } | { ok: false; code: string; detail: string }
  > {
    if (!batch3Attempt || typeof epoch !== "number") return { ok: true };
    if (page07HandoffFailHookForTests) {
      const forced = page07HandoffFailHookForTests();
      if (forced) return forced;
    }
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

  async function authorityCommitTerminal(inputCommit: {
    page: unknown;
    output_fp: string;
    outcome: "skipped_not_applicable" | "insufficient_information";
    applicability_status: "not_applicable" | "insufficient_information";
  }): Promise<{ ok: true } | { ok: false; code: string; detail: string }> {
    if (!batch3Attempt || typeof epoch !== "number") {
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
    const built = buildValidatedStatusPage({
      job,
      applicability,
      expected_status: "not_applicable",
    });
    if (!built.ok) {
      return { status: "failed", code: built.code, detail: built.detail };
    }
    const committed = await authorityCommitTerminal({
      page: built.page,
      output_fp: built.output_fp,
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

  // insufficient_information — same validate-then-commit rule.
  {
    const built = buildValidatedStatusPage({
      job,
      applicability,
      expected_status: "insufficient_information",
    });
    if (!built.ok) {
      return { status: "failed", code: built.code, detail: built.detail };
    }
    const committed = await authorityCommitTerminal({
      page: built.page,
      output_fp: built.output_fp,
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
