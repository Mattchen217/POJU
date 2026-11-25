/**
 * DAG-based invalidation — reuses Batch1 registry; bumps page fence rev so
 * late commits cannot restore invalidated pages.
 */

import {
  getJob,
  saveJob,
  updatePageState,
} from "../batch2/job-store";
import {
  REPORT_PAGE_IDS,
  REPORT_PAGE_REGISTRY,
} from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import { assertGenerationActive } from "./generation-store";
import {
  isMemoryAtomicAvailable,
  kvGet,
  runMemoryAtomic,
  trackBatch3Key,
} from "./kv-cas";
import { pageFenceKey } from "./page-fence";
import { readPageProvenance } from "./provenance";
import type { Batch3Result, PageFence, PageProvenance, TaskRecord } from "./types";

function requiredDependentsOf(page_id: ReportPageId): ReportPageId[] {
  const out: ReportPageId[] = [];
  for (const def of REPORT_PAGE_REGISTRY) {
    if ((def.required_upstream as readonly string[]).includes(page_id)) {
      out.push(def.page_id);
    }
  }
  return out;
}

function optionalDependentsOf(page_id: ReportPageId): ReportPageId[] {
  const out: ReportPageId[] = [];
  for (const def of REPORT_PAGE_REGISTRY) {
    if ((def.optional_upstream as readonly string[]).includes(page_id)) {
      out.push(def.page_id);
    }
  }
  return out;
}

function provKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:prov:${page_id}`;
}

function taskKeyPath(
  report_id: string,
  generation_id: string,
  task_key: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:task:${task_key}`;
}

/**
 * Atomically bump page fence validity_rev, mark stale, invalidate provenance,
 * and stale the bound task attempt.
 */
export async function invalidatePageAuthority(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  reason: string;
}): Promise<Batch3Result<{ validity_rev: number }>> {
  const fKey = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  const pKey = provKey(input.report_id, input.generation_id, input.page_id);
  trackBatch3Key(fKey);
  trackBatch3Key(pKey);

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const now = new Date().toISOString();
      const cur = ops.getJson(fKey) as PageFence | null;
      const nextRev = (cur?.validity_rev ?? 0) + 1;
      const fence: PageFence = {
        report_id: input.report_id.trim(),
        generation_id: input.generation_id.trim(),
        generation_epoch: input.generation_epoch,
        page_id: input.page_id,
        validity_rev: nextRev,
        status: "stale",
        attempt_id: null,
        task_key: cur?.task_key ?? null,
        input_fingerprint: null,
        upstream_output_fingerprints: null,
        output_fingerprint: null,
        updated_at: now,
      };
      ops.setJson(fKey, fence);

      const prov = ops.getJson(pKey) as PageProvenance | null;
      if (prov) {
        ops.setJson(pKey, {
          ...prov,
          stale: true,
          stale_reason: input.reason,
          validity_rev: nextRev,
        });
        if (prov.task_key) {
          const tKey = taskKeyPath(
            input.report_id,
            input.generation_id,
            prov.task_key,
          );
          trackBatch3Key(tKey);
          const task = ops.getJson(tKey) as TaskRecord | null;
          if (task && task.status !== "superseded") {
            ops.setJson(tKey, {
              ...task,
              status: "stale",
              lease_expires_at: null,
              updated_at: now,
              failure_detail: input.reason,
              validity_rev: nextRev,
            });
          }
        }
      } else if (cur?.task_key) {
        const tKey = taskKeyPath(
          input.report_id,
          input.generation_id,
          cur.task_key,
        );
        trackBatch3Key(tKey);
        const task = ops.getJson(tKey) as TaskRecord | null;
        if (task) {
          ops.setJson(tKey, {
            ...task,
            status: "stale",
            lease_expires_at: null,
            updated_at: now,
            failure_detail: input.reason,
            validity_rev: nextRev,
          });
        }
      }

      return { validity_rev: nextRev };
    });
    if (!ran.ok) return ran;
    return { ok: true, value: ran.value };
  }

  // Redis: sequential CAS with fail-closed on fence bump (best-effort task stale).
  const cur = await kvGet<PageFence>(fKey);
  if (!cur.ok) return cur;
  const now = new Date().toISOString();
  const nextRev = (cur.value?.validity_rev ?? 0) + 1;
  const fence: PageFence = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    validity_rev: nextRev,
    status: "stale",
    attempt_id: null,
    task_key: cur.value?.task_key ?? null,
    input_fingerprint: null,
    upstream_output_fingerprints: null,
    output_fingerprint: null,
    updated_at: now,
  };
  const { casSet } = await import("./kv-cas");
  const saved = await casSet(
    fKey,
    cur.value == null ? null : JSON.stringify(cur.value),
    fence,
  );
  if (!saved.ok) return saved;

  const prov = await readPageProvenance(
    input.report_id,
    input.generation_id,
    input.page_id,
  );
  if (!prov.ok) return prov;
  if (prov.value) {
    await casSet(pKey, JSON.stringify(prov.value), {
      ...prov.value,
      stale: true,
      stale_reason: input.reason,
      validity_rev: nextRev,
    });
    if (prov.value.task_key) {
      const tKey = taskKeyPath(
        input.report_id,
        input.generation_id,
        prov.value.task_key,
      );
      const task = await kvGet<TaskRecord>(tKey);
      if (task.ok && task.value) {
        await casSet(tKey, JSON.stringify(task.value), {
          ...task.value,
          status: "stale",
          lease_expires_at: null,
          updated_at: now,
          failure_detail: input.reason,
          validity_rev: nextRev,
        });
      }
    }
  }

  return { ok: true, value: { validity_rev: nextRev } };
}

/**
 * Mark source page + DAG dependents as stale.
 * Optional consumers (Page02←01) invalidate only when provenance consumed that upstream.
 */
export async function invalidateFromPage(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  source_page_id: ReportPageId;
  reason: string;
}): Promise<Batch3Result<{ invalidated: ReportPageId[] }>> {
  const fence = await assertGenerationActive({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
  });
  if (!fence.ok) return fence;

  const job = await getJob(input.report_id, input.generation_id);
  if (!job) {
    return { ok: false, code: "not_found", detail: "job missing for invalidation" };
  }

  const visited = new Set<ReportPageId>();
  const queue: ReportPageId[] = [input.source_page_id];

  while (queue.length) {
    const page_id = queue.shift()!;
    if (visited.has(page_id)) continue;
    visited.add(page_id);

    const auth = await invalidatePageAuthority({
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: input.generation_epoch,
      page_id,
      reason: `${input.reason} (from ${input.source_page_id})`,
    });
    if (!auth.ok) return auth;

    updatePageState(job, page_id, {
      outcome: "pending",
      output_fingerprint: undefined,
      applicability_status: page_id === "07" ? null : undefined,
    });
    delete job.page_outputs[page_id];

    for (const dep of requiredDependentsOf(page_id)) {
      if (!visited.has(dep)) queue.push(dep);
    }

    for (const dep of optionalDependentsOf(page_id)) {
      if (visited.has(dep)) continue;
      const prov = await readPageProvenance(
        input.report_id,
        input.generation_id,
        dep,
      );
      if (!prov.ok) return prov;
      const consumed = prov.value?.upstream_output_fingerprints?.[page_id];
      if (consumed) {
        queue.push(dep);
      }
    }
  }

  const saved = await saveJob(job);
  if (!saved.ok) {
    return {
      ok: false,
      code: saved.code === "kv_unavailable" ? "kv_unavailable" : "kv_write_failed",
      detail: saved.detail,
    };
  }

  return { ok: true, value: { invalidated: [...visited] } };
}

export function allReportPageIds(): readonly ReportPageId[] {
  return REPORT_PAGE_IDS;
}
