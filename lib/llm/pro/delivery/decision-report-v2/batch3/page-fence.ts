/**
 * Per-page validity fence — monotonic validity_rev gates commits vs invalidation.
 * reopen: stale → open at current rev only (never resets rev; never revives old attempt).
 */

import { reportPageDefinition } from "../orchestration";
import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";
import { batch3NowIso } from "./clock";
import {
  finalizationClaimKey,
  inspectFinalizationLock,
} from "./finalization-lock";
import { canTransitionFence } from "./generation-transitions";
import {
  casSet,
  isBatch3SharedStoreAvailable,
  isMemoryAtomicAvailable,
  kvGet,
  kvUnavailable,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
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
    updated_at: batch3NowIso(),
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

/**
 * If fence is stale and all required upstream fences are committed,
 * atomically reopen at the **current** validity_rev (clears attempt ownership).
 * Concurrent invalidation that bumps rev first wins — reopen then fails.
 */
export async function reopenStaleFenceIfReady(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
}): Promise<Batch3Result<PageFence>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const fKey = pageFenceKey(
    input.report_id,
    input.generation_id,
    input.page_id,
  );
  const cKey = finalizationClaimKey(input.report_id, input.generation_id);
  trackBatch3Key(fKey);
  trackBatch3Key(cKey);

  const cur = await kvGet<PageFence>(fKey);
  if (!cur.ok) return cur;
  if (!cur.value) {
    return { ok: false, code: "not_found", detail: "fence missing for reopen" };
  }
  if (cur.value.status === "open" || cur.value.status === "claimed") {
    return { ok: true, value: cur.value };
  }
  if (cur.value.status === "committed") {
    return { ok: true, value: cur.value };
  }
  if (cur.value.status !== "stale") {
    return {
      ok: false,
      code: "conflict",
      detail: `cannot reopen fence status=${cur.value.status}`,
    };
  }

  // Required upstreams must be committed at their current revs.
  const def = reportPageDefinition(input.page_id);
  for (const up of def.required_upstream) {
    const upFence = await readPageFence(
      input.report_id,
      input.generation_id,
      up,
    );
    if (!upFence.ok) return upFence;
    if (!upFence.value || upFence.value.status !== "committed") {
      return {
        ok: false,
        code: "deps_unmet",
        detail: `required upstream ${up} not committed for reopen`,
      };
    }
  }

  const expectedRev = cur.value.validity_rev;
  const now = batch3NowIso();

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const lock = inspectFinalizationLock(ops.getJson(cKey));
      if (lock.kind === "locked" || lock.kind === "unusable") {
        return {
          ok: false as const,
          code: "finalization_locked" as const,
          detail: "reopen refused: finalization locks page content",
        };
      }
      const fence = ops.getJson(fKey) as PageFence | null;
      if (!fence) {
        return {
          ok: false as const,
          code: "not_found" as const,
          detail: "fence missing",
        };
      }
      if (fence.status !== "stale") {
        if (fence.status === "open") {
          return { ok: true as const, fence };
        }
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: `reopen race: status=${fence.status}`,
        };
      }
      if (fence.validity_rev !== expectedRev) {
        return {
          ok: false as const,
          code: "stale_page" as const,
          detail: "reopen refused: validity_rev advanced (invalidation won)",
        };
      }
      if (!canTransitionFence("stale", "open")) {
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: "illegal fence transition",
        };
      }
      const next: PageFence = {
        ...fence,
        status: "open",
        attempt_id: null,
        task_key: null,
        input_fingerprint: null,
        upstream_output_fingerprints: null,
        output_fingerprint: null,
        updated_at: now,
      };
      ops.setJson(fKey, next, ttlSeconds());
      return { ok: true as const, fence: next };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return { ok: true, value: ran.value.fence };
  }

  // Redis: CAS reopen with expected rev snapshot.
  const next: PageFence = {
    ...cur.value,
    status: "open",
    attempt_id: null,
    task_key: null,
    input_fingerprint: null,
    upstream_output_fingerprints: null,
    output_fingerprint: null,
    updated_at: now,
  };
  const saved = await casSet(fKey, JSON.stringify(cur.value), next);
  if (!saved.ok) {
    if (saved.code === "conflict") {
      return {
        ok: false,
        code: "stale_page",
        detail: "reopen CAS conflict (invalidation or concurrent reopen)",
      };
    }
    return saved;
  }
  return { ok: true, value: next };
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
