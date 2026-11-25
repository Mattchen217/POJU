/**
 * Per-page validity fence — monotonic validity_rev gates commits vs invalidation.
 */

import type { ReportPageId, ReportUpstreamOutputFingerprints } from "../orchestration/types";
import {
  casSet,
  isBatch3SharedStoreAvailable,
  kvGet,
  kvUnavailable,
  trackBatch3Key,
} from "./kv-cas";
import type { Batch3Result, PageFence } from "./types";

export function pageFenceKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:fence:${page_id}`;
}

export async function readPageFence(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): Promise<Batch3Result<PageFence | null>> {
  return kvGet<PageFence>(pageFenceKey(report_id, generation_id, page_id));
}

/** Ensure an open fence exists; returns current fence (rev unchanged if present). */
export async function ensurePageFence(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
}): Promise<Batch3Result<PageFence>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const key = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  trackBatch3Key(key);
  const cur = await kvGet<PageFence>(key);
  if (!cur.ok) return cur;
  if (cur.value) return { ok: true, value: cur.value };

  const fence: PageFence = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    validity_rev: 0,
    status: "open",
    attempt_id: null,
    task_key: null,
    input_fingerprint: null,
    upstream_output_fingerprints: null,
    output_fingerprint: null,
    updated_at: new Date().toISOString(),
  };
  const created = await casSet(key, null, fence);
  if (!created.ok) {
    if (created.code === "conflict") {
      const again = await kvGet<PageFence>(key);
      if (!again.ok) return again;
      if (again.value) return { ok: true, value: again.value };
    }
    return created;
  }
  return { ok: true, value: fence };
}

export function fingerprintsMatch(
  expected: ReportUpstreamOutputFingerprints | null | undefined,
  actual: ReportUpstreamOutputFingerprints | null | undefined,
): boolean {
  const a = expected ?? {};
  const b = actual ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a as Record<string, string>)[k] !== (b as Record<string, string>)[k]) {
      return false;
    }
  }
  return true;
}
