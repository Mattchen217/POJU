/**
 * Shared pre-model / post-model guards for Batch2 Workers.
 * Page claim is atomic Task+Fence via claimPageExecution.
 */

import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";
import { claimPageExecution } from "./claim-page-execution";
import { assertGenerationActive } from "./generation-store";
import { ensurePageFence, reopenStaleFenceIfReady } from "./page-fence";
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

  // Reopen stale fence when deps ready (idempotent if already open).
  const reopened = await reopenStaleFenceIfReady({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
  });
  if (!reopened.ok && reopened.code !== "stale_page") {
    // dependency_not_ready / conflict: fall through to ensure/claim which will refuse stale
    if (
      reopened.code !== "dependency_not_ready" &&
      reopened.code !== "not_found"
    ) {
      return reopened;
    }
  }

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

  return claimPageExecution({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    task_type: input.task_type,
    input_fingerprint: input.input_fingerprint,
    upstream_output_fingerprints: input.upstream_output_fingerprints,
    worker_id: input.worker_id,
  });
}
