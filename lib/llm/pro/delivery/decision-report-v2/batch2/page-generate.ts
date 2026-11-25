import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import { scareRedlineSnippet } from "@/lib/llm/compliance/audit-output";
import { hashCanonicalPayload } from "../orchestration";
import {
  PAGE_PRODUCTION_VERSIONS,
  PAGE_VALIDATOR_VERSIONS,
} from "../orchestration/page-registry";
import type { ReportPageId } from "../orchestration/types";
import {
  buildFace01RepairUserMessage,
  parseFace01JsonStrict,
  validateFace01ProductionOutput,
  type Face01ProductionContext,
} from "../page01/production";
import {
  buildFace02RepairUserMessage,
  parseFace02JsonStrict,
  validateFace02ProductionOutput,
  type Face02ProductionContext,
} from "../page02/production";
import {
  buildFace04RepairUserMessage,
  parseFace04JsonStrict,
  validateFace04ProductionOutput,
  type Face04ProductionContext,
} from "../page04/production";
import {
  buildFace05RepairUserMessage,
  parseFace05JsonStrict,
  validateFace05ProductionOutput,
  type Face05ProductionContext,
} from "../page05/production";
import {
  buildFace06RepairUserMessage,
  parseFace06JsonStrict,
  validateFace06ProductionOutput,
  type Face06ProductionContext,
} from "../page06/production";
import {
  buildFace07RepairUserMessage,
  parseFace07JsonStrict,
  validateFace07ProductionOutput,
  type Face07ProductionContext,
} from "../page07/production";
import {
  buildFace08RepairUserMessage,
  parseFace08JsonStrict,
  validateFace08ProductionOutput,
  type Face08ProductionContext,
} from "../page08/production";
import { REPORT_BATCH2_EVENTS } from "./events";
import {
  appendInvocationLog,
  loadJob,
  saveJob,
  setPageOutput,
  setRepairPending,
  updatePageState,
} from "./job-store";
import type { ReportBatch2JobRecord } from "./types";
import { getBatch2ModelInvoke } from "./model-invoke";
import {
  assertPageDepsReady,
  buildPageProductionPrep,
  computePageInputFingerprintForJob,
} from "./page-prep";
import type { ReportBatch2GenerateEventData, ReportBatch2WorkerResult } from "./types";

const IN_FLIGHT = new Set([
  "queued",
  "running",
  "validating",
  "repair_queued",
  "completed",
  "skipped_not_applicable",
  "insufficient_information",
  "failed",
  "cancelled",
]);

export async function runReportPageGenerateOnce(input: {
  event: ReportBatch2GenerateEventData;
  invocation_id: string;
  worker_id?: string;
}): Promise<ReportBatch2WorkerResult> {
  const loaded = await loadJob(input.event.report_id, input.event.generation_id);
  if (!loaded.ok) {
    return { status: "failed", code: loaded.code, detail: loaded.detail };
  }
  const job = loaded.value;
  if (!job) {
    return { status: "failed", code: "job_not_found", detail: "batch2 job missing" };
  }

  const page_id = input.event.page_id;
  const state = job.page_states.find((s) => s.page_id === page_id);
  const outcome = state?.outcome ?? "pending";

  if (page_id === "07") {
    const app = state?.applicability_status;
    if (app !== "applicable") {
      return {
        status: "failed",
        code: "page07_not_applicable_for_generate",
        detail: `applicability_status=${app ?? "unset"}`,
      };
    }
  }

  if (IN_FLIGHT.has(outcome) && outcome !== "queued") {
    if (
      outcome === "completed" ||
      outcome === "skipped_not_applicable" ||
      outcome === "insufficient_information" ||
      outcome === "failed"
    ) {
      return { status: "skipped" };
    }
    if (outcome === "repair_queued") {
      return { status: "skipped" };
    }
  }

  const deps = assertPageDepsReady(job, page_id);
  if (!deps.ok) {
    updatePageState(job, page_id, { outcome: "failed" });
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return { status: "failed", code: deps.code, detail: deps.detail };
  }

  const prep = buildPageProductionPrep(job, page_id);
  if (prep.build_fail) {
    updatePageState(job, page_id, { outcome: "failed" });
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return {
      status: "failed",
      code: prep.build_fail.code,
      detail: prep.build_fail.detail,
    };
  }

  const fp = computePageInputFingerprintForJob(job, page_id, prep);
  if (!fp.ok) {
    updatePageState(job, page_id, { outcome: "failed" });
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return { status: "failed", code: fp.code, detail: fp.detail };
  }

  if (input.event.input_fingerprint.trim() !== fp.result.fingerprint) {
    updatePageState(job, page_id, { outcome: "failed" });
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return {
      status: "failed",
      code: "input_fingerprint_mismatch",
      detail: "event fingerprint does not match recomputed production fingerprint",
    };
  }

  if (prep.may_invoke_llm === false) {
    // Page02 may be DAG-ready in parallel with Page01, but architecture still
    // requires Page01 alignment for LLM. Defer (pending) so orchestrator can
    // re-dispatch after Page01 completes — do not permanently fail the page.
    if (page_id === "02" && !job.page_outputs["01"]) {
      updatePageState(job, page_id, { outcome: "pending" });
      const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
      return {
        status: "deferred",
        code: "awaiting_optional_page01",
        detail:
          "Page02 generation deferred until Page01 alignment is available",
      };
    }
    updatePageState(job, page_id, { outcome: "failed" });
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return {
      status: "failed",
      code: "may_invoke_llm_false",
      detail: "required inputs missing — generation blocked",
    };
  }

  updatePageState(job, page_id, {
    outcome: "running",
    input_fingerprint: fp.result.fingerprint,
  });
  job.status = "running";
  const runningSaved = await saveJob(job);
  if (!runningSaved.ok) {
    return { status: "failed", code: runningSaved.code, detail: runningSaved.detail };
  }

  // Batch3: fence + claim before model. Skip when legacy jobs lack epoch.
  let batch3Attempt: { task_key: string; attempt_id: string } | null = null;
  const epoch = input.event.generation_epoch ?? job.generation_epoch;
  if (typeof epoch === "number") {
    const { fenceAndClaimPageTask } = await import("../batch3/worker-guard");
    const claimed = await fenceAndClaimPageTask({
      report_id: input.event.report_id,
      generation_id: input.event.generation_id,
      generation_epoch: epoch,
      page_id,
      task_type: "generate",
      input_fingerprint: fp.result.fingerprint,
      upstream_output_fingerprints: input.event.upstream_output_fingerprints,
      worker_id: input.worker_id ?? "report-page-generate",
    });
    if (!claimed.ok) {
      if (claimed.code === "already_completed" || claimed.code === "already_claimed") {
        return { status: "skipped" };
      }
      if (claimed.code === "stale_generation") {
        return { status: "failed", code: claimed.code, detail: claimed.detail };
      }
      return { status: "failed", code: claimed.code, detail: claimed.detail };
    }
    batch3Attempt = {
      task_key: claimed.value.task_key,
      attempt_id: claimed.value.attempt_id,
    };
  }

  const started_at = new Date().toISOString();
  const invoke = getBatch2ModelInvoke();
  let model_call_id: string | null = null;
  let rawText = "";

  try {
    const model = await invoke({
      page_id,
      system: prep.system,
      user: prep.user,
      invocation_id: input.invocation_id,
      call_kind: "generate",
    });
    model_call_id = model.model_call_id;
    rawText = model.content?.trim() ?? "";
  } catch (err) {
    appendInvocationLog(job, {
      page_id,
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      worker_id: input.worker_id ?? "report-page-generate",
      invocation_id: input.invocation_id,
      model_call_id,
      started_at,
      ended_at: new Date().toISOString(),
    });
    updatePageState(job, page_id, { outcome: "failed" });
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return {
      status: "failed",
      code: "model_invoke_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  appendInvocationLog(job, {
    page_id,
    event_name: REPORT_BATCH2_EVENTS.GENERATE,
    worker_id: input.worker_id ?? "report-page-generate",
    invocation_id: input.invocation_id,
    model_call_id,
    started_at,
    ended_at: new Date().toISOString(),
  });

  if (scareRedlineSnippet(rawText)) {
    updatePageState(job, page_id, { outcome: "failed" });
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return { status: "failed", code: "scare_redline", detail: "model output failed compliance" };
  }

  const parsed = parsePageJson(page_id, rawText);
  if (parsed == null) {
    const repairQueued = await queueRepair(job, page_id, prep, rawText, fp.result.fingerprint, [
      { code: "json_parse_failed", detail: "strict parse failed" },
    ]);
    if (repairQueued) return repairQueued;
    return { status: "needs_repair" };
  }

  const validated = validatePageOutput(page_id, parsed, prep.ctx, job.locale);
  if (!validated.ok) {
    const repairQueued = await queueRepair(
      job,
      page_id,
      prep,
      rawText,
      fp.result.fingerprint,
      validated.issues,
    );
    if (repairQueued) return repairQueued;
    return { status: "needs_repair" };
  }

  const output_fp = hashCanonicalPayload(validated.page);
  if (batch3Attempt && typeof epoch === "number") {
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
      output: validated.page,
      output_fingerprint: output_fp,
      state_patch: {
        outcome: "completed",
        input_fingerprint: fp.result.fingerprint,
      },
      provenance: {
        report_id: input.event.report_id,
        generation_id: input.event.generation_id,
        generation_epoch: epoch,
        page_id,
        input_fingerprint: fp.result.fingerprint,
        upstream_output_fingerprints: input.event.upstream_output_fingerprints,
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: output_fp,
        attempt_id: batch3Attempt.attempt_id,
        task_key: batch3Attempt.task_key,
      },
    });
    if (!committed.ok) {
      return { status: "failed", code: committed.code, detail: committed.detail };
    }
    return { status: "completed" };
  }

  setPageOutput(job, page_id, validated.page, output_fp);
  updatePageState(job, page_id, {
    outcome: "completed",
    output_fingerprint: output_fp,
    input_fingerprint: fp.result.fingerprint,
  });
  const doneSaved = await saveJob(job);
  if (!doneSaved.ok) {
    return { status: "failed", code: doneSaved.code, detail: doneSaved.detail };
  }
  return { status: "completed" };
}

async function queueRepair(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  prep: ReturnType<typeof buildPageProductionPrep>,
  previous_raw: string,
  input_fingerprint: string,
  issues: unknown[],
): Promise<ReportBatch2WorkerResult | null> {
  setRepairPending(job, page_id, {
    page_id,
    system: prep.system,
    user: prep.user,
    previous_raw,
    issues,
    input_fingerprint,
    locale: job.locale,
    validator_version: PAGE_VALIDATOR_VERSIONS[page_id],
    production_version: PAGE_PRODUCTION_VERSIONS[page_id],
    prompt_version: prep.prompt_version,
  });
  updatePageState(job, page_id, { outcome: "repair_queued" });
  const saved = await saveJob(job);
  if (!saved.ok) {
    return { status: "failed", code: saved.code, detail: saved.detail };
  }
  return null;
}

function parsePageJson(page_id: ReportPageId, rawText: string): unknown | null {
  const strict = strictParser(page_id)(rawText);
  if (strict != null) return strict;
  try {
    return extractJson(rawText);
  } catch {
    return null;
  }
}

function strictParser(page_id: ReportPageId): (raw: string) => unknown | null {
  const map: Record<ReportPageId, (raw: string) => unknown | null> = {
    "01": parseFace01JsonStrict,
    "02": parseFace02JsonStrict,
    "04": parseFace04JsonStrict,
    "05": parseFace05JsonStrict,
    "06": parseFace06JsonStrict,
    "07": parseFace07JsonStrict,
    "08": parseFace08JsonStrict,
  };
  return map[page_id];
}

function validatePageOutput(
  page_id: ReportPageId,
  raw: unknown,
  ctx: unknown,
  locale: string,
):
  | { ok: true; page: unknown }
  | { ok: false; issues: unknown[] } {
  switch (page_id) {
    case "01":
      return validateFace01ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face01ProductionContext,
      });
    case "02":
      return validateFace02ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face02ProductionContext,
      });
    case "04":
      return validateFace04ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face04ProductionContext,
      });
    case "05":
      return validateFace05ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face05ProductionContext,
      });
    case "06":
      return validateFace06ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face06ProductionContext,
      });
    case "07":
      return validateFace07ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face07ProductionContext,
      });
    case "08":
      return validateFace08ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face08ProductionContext,
      });
    default:
      return { ok: false, issues: [{ code: "invalid_page", detail: page_id }] };
  }
}

export function buildRepairUserMessage(
  page_id: ReportPageId,
  previousUser: string,
  previousRaw: string,
  issues: unknown[],
): string {
  const sliceIssues = issues.slice(0, 12);
  switch (page_id) {
    case "01":
      return buildFace01RepairUserMessage({
        previousUser,
        previousRaw,
        issues: sliceIssues as Parameters<typeof buildFace01RepairUserMessage>[0]["issues"],
      });
    case "02":
      return buildFace02RepairUserMessage({
        previousUser,
        previousRaw,
        issues: sliceIssues as Parameters<typeof buildFace02RepairUserMessage>[0]["issues"],
      });
    case "04":
      return buildFace04RepairUserMessage({
        previousUser,
        previousRaw,
        issues: sliceIssues as Parameters<typeof buildFace04RepairUserMessage>[0]["issues"],
      });
    case "05":
      return buildFace05RepairUserMessage({
        previousUser,
        previousRaw,
        issues: sliceIssues as Parameters<typeof buildFace05RepairUserMessage>[0]["issues"],
      });
    case "06":
      return buildFace06RepairUserMessage({
        previousUser,
        previousRaw,
        issues: sliceIssues as Parameters<typeof buildFace06RepairUserMessage>[0]["issues"],
      });
    case "07":
      return buildFace07RepairUserMessage({
        previousUser,
        previousRaw,
        issues: sliceIssues as Parameters<typeof buildFace07RepairUserMessage>[0]["issues"],
      });
    case "08":
      return buildFace08RepairUserMessage({
        previousUser,
        previousRaw,
        issues: sliceIssues as Parameters<typeof buildFace08RepairUserMessage>[0]["issues"],
      });
    default:
      return previousUser;
  }
}