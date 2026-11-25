/**
 * Frozen CascadeOperation — multi-page invalidation with recoverable steps.
 * Targets frozen at create; Recovery continues without recomputing the set.
 */

import type { ReportPageId } from "../orchestration/types";
import { REPORT_PAGE_REGISTRY } from "../orchestration";
import { casSet, kvGet, trackBatch3Key } from "./kv-cas";
import { readPageFence } from "./page-fence";
import type {
  Batch3Result,
  CascadeOperation,
  CascadePageTarget,
} from "./types";

export function cascadeOpKey(
  report_id: string,
  generation_id: string,
  operation_id: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:cascade:${operation_id}`;
}

export function cascadeActiveKey(
  report_id: string,
  generation_id: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:cascade:active`;
}

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

/** BFS walk for required + optionally-consumed dependents (frozen order). */
export async function planCascadePageIds(input: {
  report_id: string;
  generation_id: string;
  source_page_id: ReportPageId;
  shouldIncludeOptional: (
    dep: ReportPageId,
    upstream: ReportPageId,
  ) => Promise<Batch3Result<boolean>>;
}): Promise<Batch3Result<ReportPageId[]>> {
  const visited = new Set<ReportPageId>();
  const order: ReportPageId[] = [];
  const queue: ReportPageId[] = [input.source_page_id];

  while (queue.length) {
    const page_id = queue.shift()!;
    if (visited.has(page_id)) continue;
    visited.add(page_id);
    order.push(page_id);

    for (const dep of requiredDependentsOf(page_id)) {
      if (!visited.has(dep)) queue.push(dep);
    }
    for (const dep of optionalDependentsOf(page_id)) {
      if (visited.has(dep)) continue;
      const inc = await input.shouldIncludeOptional(dep, page_id);
      if (!inc.ok) return inc;
      if (inc.value) queue.push(dep);
    }
  }
  return { ok: true, value: order };
}

export async function buildFrozenCascadeTargets(input: {
  report_id: string;
  generation_id: string;
  page_ids: ReportPageId[];
}): Promise<Batch3Result<CascadePageTarget[]>> {
  const targets: CascadePageTarget[] = [];
  for (const page_id of input.page_ids) {
    const fence = await readPageFence(
      input.report_id,
      input.generation_id,
      page_id,
    );
    if (!fence.ok) return fence;
    const expected_old_rev = fence.value?.validity_rev ?? 0;
    targets.push({
      page_id,
      expected_old_rev,
      target_rev: expected_old_rev + 1,
      status: "pending",
      done: false,
    });
  }
  return { ok: true, value: targets };
}

export async function saveCascadeOperation(
  op: CascadeOperation,
  expectedJson: string | null,
): Promise<Batch3Result<CascadeOperation>> {
  const key = cascadeOpKey(op.report_id, op.generation_id, op.operation_id);
  const aKey = cascadeActiveKey(op.report_id, op.generation_id);
  trackBatch3Key(key);
  trackBatch3Key(aKey);
  const saved = await casSet(key, expectedJson, op);
  if (!saved.ok) return saved;

  const aCur = await kvGet<string>(aKey);
  if (!aCur.ok) return aCur;
  const aExpected =
    aCur.value == null ? null : JSON.stringify(aCur.value);
  if (
    op.status === "running" ||
    op.status === "failed_recoverable"
  ) {
    const aSaved = await casSet(aKey, aExpected, op.operation_id);
    if (!aSaved.ok && aSaved.code === "conflict") {
      // Active pointer race: re-read; if already ours, ok
      const again = await kvGet<string>(aKey);
      if (!again.ok) return again;
      if (again.value !== op.operation_id) {
        return {
          ok: false,
          code: "conflict",
          detail: `cascade active pointer held by ${again.value}`,
        };
      }
    } else if (!aSaved.ok) {
      return aSaved;
    }
  } else if (op.status === "completed") {
    if (aCur.value === op.operation_id) {
      // Keep pointer for inspection; no-op write
      await casSet(aKey, aExpected, op.operation_id);
    }
  }
  return { ok: true, value: op };
}

export async function readCascadeOperation(
  report_id: string,
  generation_id: string,
  operation_id: string,
): Promise<Batch3Result<CascadeOperation | null>> {
  return kvGet<CascadeOperation>(
    cascadeOpKey(report_id, generation_id, operation_id),
  );
}

export async function readActiveCascadeOperation(
  report_id: string,
  generation_id: string,
): Promise<Batch3Result<CascadeOperation | null>> {
  const aKey = cascadeActiveKey(report_id, generation_id);
  trackBatch3Key(aKey);
  const id = await kvGet<string>(aKey);
  if (!id.ok) return id;
  if (!id.value) return { ok: true, value: null };
  return readCascadeOperation(report_id, generation_id, id.value);
}

/** Finalization must refuse while cascade is running or failed_recoverable. */
export async function assertNoBlockingCascade(input: {
  report_id: string;
  generation_id: string;
}): Promise<Batch3Result<void>> {
  const active = await readActiveCascadeOperation(
    input.report_id,
    input.generation_id,
  );
  if (!active.ok) return active;
  if (!active.value) return { ok: true, value: undefined };
  if (
    active.value.status === "running" ||
    active.value.status === "failed_recoverable"
  ) {
    return {
      ok: false,
      code: "cascade_incomplete",
      detail: `finalization refused: cascade ${active.value.operation_id} status=${active.value.status}`,
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Idempotent: fence at target_rev + stale ⇒ done for this op.
 * Unrelated stale fences (wrong rev) are NOT treated as complete.
 */
export async function isCascadeTargetSatisfied(input: {
  report_id: string;
  generation_id: string;
  target: CascadePageTarget;
}): Promise<Batch3Result<boolean>> {
  const fence = await readPageFence(
    input.report_id,
    input.generation_id,
    input.target.page_id,
  );
  if (!fence.ok) return fence;
  if (!fence.value) return { ok: true, value: false };
  return {
    ok: true,
    value:
      fence.value.status === "stale" &&
      fence.value.validity_rev === input.target.target_rev,
  };
}
