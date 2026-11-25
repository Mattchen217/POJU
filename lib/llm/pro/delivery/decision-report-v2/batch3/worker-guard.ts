/**
 * Shared pre-model / post-model guards for Batch2 Workers.
 */

import { reportPageDefinition } from "../orchestration";
import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";
import { assertGenerationActive } from "./generation-store";
import { ensurePageFence } from "./page-fence";
import { computeTaskKey } from "./task-identity";
import { claimTask, ensureQueuedTask } from "./task-store";
import type { Batch3Result, TaskRecord, TaskType } from "./types";

export async function fenceAndClaimPageTask(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  task_type: TaskType;
  input_fingerprint: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  worker_id: string;
}): Promise<
  Batch3Result<{
    task: TaskRecord;
    task_key: string;
    attempt_id: string;
    validity_rev: number;
  }>
> {
  const fence = await assertGenerationActive({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
  });
  if (!fence.ok) return fence;

  const pageFence = await ensurePageFence({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
  });
  if (!pageFence.ok) return pageFence;
  if (pageFence.value.status === "stale") {
    return {
      ok: false,
      code: "stale_page",
      detail: `page ${input.page_id} fence stale rev=${pageFence.value.validity_rev}`,
    };
  }

  const def = reportPageDefinition(input.page_id);
  const task_key = computeTaskKey({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    input_fingerprint: input.input_fingerprint,
    upstream_output_fingerprints: input.upstream_output_fingerprints,
    page_contract_version: def.production_version,
    prompt_version: def.prompt_version,
    validator_version: def.validator_version,
    task_type: input.task_type,
  });

  const queued = await ensureQueuedTask({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    task_type: input.task_type,
    task_key,
    input_fingerprint: input.input_fingerprint,
    upstream_output_fingerprints: input.upstream_output_fingerprints,
    page_contract_version: def.production_version,
    prompt_version: def.prompt_version,
    validator_version: def.validator_version,
  });
  if (!queued.ok) return queued;

  const claimed = await claimTask({
    report_id: input.report_id,
    generation_id: input.generation_id,
    task_key,
    worker_id: input.worker_id,
    validity_rev: pageFence.value.validity_rev,
  });
  if (!claimed.ok) return claimed;
  if (!claimed.value.attempt_id) {
    return { ok: false, code: "conflict", detail: "claim missing attempt_id" };
  }

  return {
    ok: true,
    value: {
      task: claimed.value,
      task_key,
      attempt_id: claimed.value.attempt_id,
      validity_rev: claimed.value.validity_rev,
    },
  };
}
