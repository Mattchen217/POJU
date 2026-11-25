/**
 * Commit page results only after post-model fencing + attempt ownership checks.
 */

import {
  getJob,
  saveJob,
  setPageOutput,
  updatePageState,
} from "../batch2/job-store";
import type { ReportPageId, ReportPageRuntimeState } from "../orchestration/types";
import { assertGenerationActive } from "./generation-store";
import { writePageProvenance } from "./provenance";
import { completeTask, readTask } from "./task-store";
import type { Batch3Result, PageProvenance } from "./types";

export async function commitPageResult(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  attempt_id: string;
  task_key: string;
  output: unknown;
  output_fingerprint: string;
  state_patch: Partial<ReportPageRuntimeState>;
  provenance: Omit<PageProvenance, "stale" | "stale_reason" | "completed_at"> & {
    completed_at?: string;
  };
}): Promise<Batch3Result<{ provenance: PageProvenance }>> {
  // Post-model fencing — must re-check at commit time.
  const fence = await assertGenerationActive({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
  });
  if (!fence.ok) return fence;

  const task = await readTask(
    input.report_id,
    input.generation_id,
    input.task_key,
  );
  if (!task.ok) return task;
  if (!task.value) {
    return { ok: false, code: "not_found", detail: "task missing at commit" };
  }
  if (task.value.attempt_id !== input.attempt_id) {
    return {
      ok: false,
      code: "stale_attempt",
      detail: `commit attempt ${input.attempt_id} != live ${task.value.attempt_id}`,
    };
  }
  if (task.value.status === "completed") {
    return { ok: false, code: "already_completed", detail: "task already completed" };
  }
  if (task.value.status !== "running" && task.value.status !== "repair_pending") {
    return {
      ok: false,
      code: "conflict",
      detail: `cannot commit from status=${task.value.status}`,
    };
  }

  const job = await getJob(input.report_id, input.generation_id);
  if (!job) {
    return { ok: false, code: "not_found", detail: "batch2 job missing at commit" };
  }

  setPageOutput(job, input.page_id, input.output, input.output_fingerprint);
  updatePageState(job, input.page_id, {
    ...input.state_patch,
    outcome: input.state_patch.outcome ?? "completed",
    output_fingerprint: input.output_fingerprint,
  });
  const saved = await saveJob(job);
  if (!saved.ok) {
    return {
      ok: false,
      code: saved.code === "kv_unavailable" ? "kv_unavailable" : "kv_write_failed",
      detail: saved.detail,
    };
  }

  const provenance: PageProvenance = {
    ...input.provenance,
    completed_at: input.provenance.completed_at ?? new Date().toISOString(),
    stale: false,
    stale_reason: null,
  };
  const prov = await writePageProvenance(provenance);
  if (!prov.ok) return prov;

  const done = await completeTask({
    report_id: input.report_id,
    generation_id: input.generation_id,
    task_key: input.task_key,
    attempt_id: input.attempt_id,
  });
  if (!done.ok) return done;

  return { ok: true, value: { provenance } };
}
