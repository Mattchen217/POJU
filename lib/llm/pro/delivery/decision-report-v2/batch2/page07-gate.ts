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
  getJob,
  saveJob,
  setPageOutput,
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
  const job = getJob(input.event.report_id, input.event.generation_id);
  if (!job) {
    return { status: "failed", code: "job_not_found", detail: "batch2 job missing" };
  }

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
    saveJob(job);
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
    setPageOutput(job, page_id, page, output_fp);
    updatePageState(job, page_id, {
      applicability_status: "not_applicable",
      outcome: "skipped_not_applicable",
      output_fingerprint: output_fp,
    });
    saveJob(job);
    return {
      status: "not_applicable",
      applicability_status: "not_applicable",
      outcome: "skipped_not_applicable",
    };
  }

  updatePageState(job, page_id, {
    applicability_status: "insufficient_information",
    outcome: "insufficient_information",
  });
  saveJob(job);
  return {
    status: "insufficient_information",
    applicability_status: "insufficient_information",
    outcome: "insufficient_information",
  };
}