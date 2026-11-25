/**
 * DAG-based invalidation — reuses Batch1 registry; does not auto-regenerate.
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
import { markProvenanceStale, readPageProvenance } from "./provenance";
import type { Batch3Result } from "./types";

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

async function clearPageValidity(
  job: NonNullable<Awaited<ReturnType<typeof getJob>>>,
  page_id: ReportPageId,
  reason: string,
  report_id: string,
  generation_id: string,
): Promise<Batch3Result<void>> {
  const marked = await markProvenanceStale({
    report_id,
    generation_id,
    page_id,
    reason,
  });
  if (!marked.ok) return marked;

  updatePageState(job, page_id, {
    outcome: "pending",
    output_fingerprint: undefined,
    applicability_status: page_id === "07" ? null : undefined,
  });
  delete job.page_outputs[page_id];
  return { ok: true, value: undefined };
}

/**
 * Mark source page + DAG dependents as stale.
 * Optional consumers (Page02←01) invalidate only when provenance consumed that upstream.
 * Does not auto-dispatch regenerate.
 */
export async function invalidateFromPage(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  source_page_id: ReportPageId;
  reason: string;
}): Promise<Batch3Result<{ invalidated: ReportPageId[] }>> {
  void input.generation_epoch;
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

    const cleared = await clearPageValidity(
      job,
      page_id,
      `${input.reason} (from ${input.source_page_id})`,
      input.report_id,
      input.generation_id,
    );
    if (!cleared.ok) return cleared;

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
