import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import { scareRedlineSnippet } from "@/lib/llm/compliance/audit-output";
import { hashCanonicalPayload } from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import {
  parseFace01JsonStrict,
  validateFace01ProductionOutput,
  type Face01ProductionContext,
} from "../page01/production";
import {
  parseFace02JsonStrict,
  validateFace02ProductionOutput,
  type Face02ProductionContext,
} from "../page02/production";
import {
  parseFace04JsonStrict,
  validateFace04ProductionOutput,
  type Face04ProductionContext,
} from "../page04/production";
import {
  parseFace05JsonStrict,
  validateFace05ProductionOutput,
  type Face05ProductionContext,
} from "../page05/production";
import {
  parseFace06JsonStrict,
  validateFace06ProductionOutput,
  type Face06ProductionContext,
} from "../page06/production";
import {
  parseFace07JsonStrict,
  validateFace07ProductionOutput,
  type Face07ProductionContext,
} from "../page07/production";
import {
  parseFace08JsonStrict,
  validateFace08ProductionOutput,
  type Face08ProductionContext,
} from "../page08/production";
import { REPORT_BATCH2_EVENTS } from "./events";
import {
  appendInvocationLog,
  clearRepairPending,
  loadJob,
  saveJob,
  setPageOutput,
  updatePageState,
} from "./job-store";
import { getBatch2ModelInvoke } from "./model-invoke";
import { buildPageProductionPrep } from "./page-prep";
import { buildRepairUserMessage } from "./page-generate";
import type { ReportBatch2RepairEventData, ReportBatch2WorkerResult } from "./types";

export async function runReportPageRepairOnce(input: {
  event: ReportBatch2RepairEventData;
  invocation_id: string;
  worker_id?: string;
}): Promise<ReportBatch2WorkerResult> {
  const loaded = await loadJob(input.event.report_id, input.event.generation_id);
  if (!loaded.ok) {
    return { status: "failed", code: loaded.code, detail: loaded.detail };
  }
  if (!loaded.value) {
    return { status: "failed", code: "job_not_found", detail: "batch2 job missing" };
  }
  const job = loaded.value;

  const page_id = input.event.page_id;
  const pending = job.repair_pending[page_id];
  if (!pending) {
    return { status: "skipped" };
  }

  if (input.event.input_fingerprint.trim() !== pending.input_fingerprint.trim()) {
    updatePageState(job, page_id, { outcome: "failed" });
    clearRepairPending(job, page_id);
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return {
      status: "failed",
      code: "input_fingerprint_mismatch",
      detail: "repair event fingerprint mismatch",
    };
  }

  const prep = buildPageProductionPrep(job, page_id);
  const repairUser = buildRepairUserMessage(
    page_id,
    pending.user,
    pending.previous_raw,
    pending.issues,
  );

  updatePageState(job, page_id, { outcome: "running" });
  const runningSaved = await saveJob(job);
  if (!runningSaved.ok) {
    return { status: "failed", code: runningSaved.code, detail: runningSaved.detail };
  }

  // Batch3: fence + claim before repair model. Skip when legacy jobs lack epoch.
  let batch3Attempt: {
    task_key: string;
    attempt_id: string;
    validity_rev: number;
  } | null = null;
  let upstream: Record<string, string> = {};
  const epoch = input.event.generation_epoch ?? job.generation_epoch;
  if (typeof epoch === "number") {
    const { fenceAndClaimPageTask } = await import("../batch3/worker-guard");
    const { buildPageProductionPrep, upstreamFingerprintsForPage } =
      await import("./page-prep");
    const prep = buildPageProductionPrep(job, page_id);
    upstream = prep.build_fail
      ? {}
      : upstreamFingerprintsForPage(job, page_id, prep.ctx);
    const claimed = await fenceAndClaimPageTask({
      report_id: input.event.report_id,
      generation_id: input.event.generation_id,
      generation_epoch: epoch,
      page_id,
      task_type: "repair",
      input_fingerprint: pending.input_fingerprint,
      upstream_output_fingerprints: upstream,
      worker_id: input.worker_id ?? "report-page-repair",
    });
    if (!claimed.ok) {
      if (claimed.code === "already_completed" || claimed.code === "already_claimed") {
        return { status: "skipped" };
      }
      if (
        claimed.code === "stale_generation" ||
        claimed.code === "stale_page"
      ) {
        return { status: "failed", code: claimed.code, detail: claimed.detail };
      }
      return { status: "failed", code: claimed.code, detail: claimed.detail };
    }
    batch3Attempt = {
      task_key: claimed.value.task_key,
      attempt_id: claimed.value.attempt_id,
      validity_rev: claimed.value.validity_rev,
    };
  }

  const started_at = new Date().toISOString();
  const invoke = getBatch2ModelInvoke();
  let model_call_id: string | null = null;
  let rawText = "";

  async function failRepair(
    code: string,
    detail: string,
  ): Promise<ReportBatch2WorkerResult> {
    // Unit B: do not leave Repair Fence permanently claimed.
    if (batch3Attempt && typeof epoch === "number") {
      const { failAndReleasePageClaim } = await import(
        "../batch3/claim-page-execution"
      );
      await failAndReleasePageClaim({
        report_id: input.event.report_id,
        generation_id: input.event.generation_id,
        generation_epoch: epoch,
        page_id,
        task_key: batch3Attempt.task_key,
        attempt_id: batch3Attempt.attempt_id,
        detail: `${code}: ${detail}`,
      });
    }
    updatePageState(job, page_id, { outcome: "failed" });
    clearRepairPending(job, page_id);
    job.status = "failed";
    const saved = await saveJob(job);
    if (!saved.ok) {
      return { status: "failed", code: saved.code, detail: saved.detail };
    }
    return { status: "failed", code, detail };
  }

  try {
    const model = await invoke({
      page_id,
      system: pending.system,
      user: repairUser,
      invocation_id: input.invocation_id,
      call_kind: "repair",
    });
    model_call_id = model.model_call_id;
    rawText = model.content?.trim() ?? "";
  } catch (err) {
    appendInvocationLog(job, {
      page_id,
      event_name: REPORT_BATCH2_EVENTS.REPAIR,
      worker_id: input.worker_id ?? "report-page-repair",
      invocation_id: input.invocation_id,
      model_call_id,
      started_at,
      ended_at: new Date().toISOString(),
    });
    return failRepair(
      "model_invoke_error",
      err instanceof Error ? err.message : String(err),
    );
  }

  appendInvocationLog(job, {
    page_id,
    event_name: REPORT_BATCH2_EVENTS.REPAIR,
    worker_id: input.worker_id ?? "report-page-repair",
    invocation_id: input.invocation_id,
    model_call_id,
    started_at,
    ended_at: new Date().toISOString(),
  });

  clearRepairPending(job, page_id);

  if (scareRedlineSnippet(rawText)) {
    return failRepair(
      "scare_redline",
      "repair output failed compliance",
    );
  }

  const parsed = parseRepairJson(page_id, rawText);
  if (parsed == null) {
    return failRepair("repair_json_parse_failed", "repair JSON invalid");
  }

  const validated = validateRepairOutput(page_id, parsed, prep.ctx, job.locale);
  if (!validated.ok) {
    return failRepair(
      "repair_validation_failed",
      validated.reason ?? "validation failed after repair",
    );
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
        input_fingerprint: pending.input_fingerprint,
      },
      provenance: {
        report_id: input.event.report_id,
        generation_id: input.event.generation_id,
        generation_epoch: epoch,
        page_id,
        input_fingerprint: pending.input_fingerprint,
        upstream_output_fingerprints: upstream,
        page_contract_version: def.production_version,
        prompt_version: def.prompt_version,
        validator_version: def.validator_version,
        output_fingerprint: output_fp,
        attempt_id: batch3Attempt.attempt_id,
        task_key: batch3Attempt.task_key,
        validity_rev: batch3Attempt.validity_rev,
      },
    });
    if (!committed.ok) {
      return failRepair(committed.code, committed.detail);
    }
    // Job already mutated for invocation log / repair_pending clear — persist non-page fields.
    const savedMeta = await saveJob(job);
    if (!savedMeta.ok) {
      return { status: "failed", code: savedMeta.code, detail: savedMeta.detail };
    }
    return { status: "completed" };
  }

  setPageOutput(job, page_id, validated.page, output_fp);
  updatePageState(job, page_id, {
    outcome: "completed",
    output_fingerprint: output_fp,
    input_fingerprint: pending.input_fingerprint,
  });
  const doneSaved = await saveJob(job);
  if (!doneSaved.ok) {
    return { status: "failed", code: doneSaved.code, detail: doneSaved.detail };
  }
  return { status: "completed" };
}

function parseRepairJson(page_id: ReportPageId, rawText: string): unknown | null {
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

function validateRepairOutput(
  page_id: ReportPageId,
  raw: unknown,
  ctx: unknown,
  locale: string,
):
  | { ok: true; page: unknown }
  | { ok: false; reason: string } {
  switch (page_id) {
    case "01": {
      const r = validateFace01ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face01ProductionContext,
      });
      return r.ok ? { ok: true, page: r.page } : { ok: false, reason: r.reason };
    }
    case "02": {
      const r = validateFace02ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face02ProductionContext,
      });
      return r.ok ? { ok: true, page: r.page } : { ok: false, reason: r.reason };
    }
    case "04": {
      const r = validateFace04ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face04ProductionContext,
      });
      return r.ok ? { ok: true, page: r.page } : { ok: false, reason: r.reason };
    }
    case "05": {
      const r = validateFace05ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face05ProductionContext,
      });
      return r.ok ? { ok: true, page: r.page } : { ok: false, reason: r.reason };
    }
    case "06": {
      const r = validateFace06ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face06ProductionContext,
      });
      return r.ok ? { ok: true, page: r.page } : { ok: false, reason: r.reason };
    }
    case "07": {
      const r = validateFace07ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face07ProductionContext,
      });
      return r.ok ? { ok: true, page: r.page } : { ok: false, reason: r.reason };
    }
    case "08": {
      const r = validateFace08ProductionOutput({
        raw,
        locale,
        ctx: ctx as Face08ProductionContext,
      });
      return r.ok ? { ok: true, page: r.page } : { ok: false, reason: r.reason };
    }
    default:
      return { ok: false, reason: "invalid_page" };
  }
}