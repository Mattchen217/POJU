/**
 * v3 shelf tail. Content papers can consume the whole 120m wall.
 * Segment checkpoints are written only when book.assemble persists, so a
 * status poll at that moment sees shelf 0 and hard-stops the job before
 * the local assemble/finalize invokes run.
 *
 * Grace applies only when the cursor is already on book.assemble (or the
 * last evidence step is done and the next invoke will assemble). More LLM
 * pages do not get this extension. Past the grace, the wall still trips.
 */

import { loadDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import { LAB_STEP_DEFS_V3 } from "@/lib/llm/pro/delivery/lab/types-v3";
import {
  activeDeliveryJobMaxWallMs,
  PRODUCTION_V3_TAIL_GRACE_MS,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { productionDeliveryUsesV3 } from "@/lib/llm/pro/delivery/pipeline-v3/flag";

export function productionV3LabId(job_id: string): string {
  return `prodv3_${job_id}`;
}

export function isV3ShelfTailStage(stage: string | null | undefined): boolean {
  return stage === "segments" || stage === "assemble" || stage === "finalize";
}

type LabTailView = {
  pipeline?: string | null;
  cursor_index?: number;
  steps?: Record<string, { status?: string } | undefined> | null;
};

export function v3CursorAwaitingShelfAssemble(lab: LabTailView): boolean {
  if (lab.pipeline === "legacy") return false;
  const steps = lab.steps ?? {};
  if (steps["book.assemble"]?.status === "approved") return true;
  const asmIdx = LAB_STEP_DEFS_V3.findIndex((d) => d.step_key === "book.assemble");
  if (asmIdx < 0) return false;
  if (typeof lab.cursor_index === "number" && lab.cursor_index >= asmIdx) return true;
  const prev = LAB_STEP_DEFS_V3[asmIdx - 1];
  const prevStatus = prev ? steps[prev.step_key]?.status : undefined;
  return prevStatus === "approved" || prevStatus === "done";
}

export function deliveryWallFuseDecision(input: {
  created_at: number;
  now_ms: number;
  shelfTailReady: boolean;
  env?: NodeJS.ProcessEnv;
}): { tripped: boolean; limit_ms: number } {
  const wall = activeDeliveryJobMaxWallMs(input.env);
  const grace =
    input.shelfTailReady && productionDeliveryUsesV3(input.env)
      ? PRODUCTION_V3_TAIL_GRACE_MS
      : 0;
  const limit_ms = wall + grace;
  if (!Number.isFinite(input.created_at)) return { tripped: false, limit_ms: wall };
  return { tripped: input.now_ms - input.created_at > limit_ms, limit_ms };
}

export async function resolveDeliveryWallFuse(input: {
  job_id: string;
  created_at: number;
  stage: string | null | undefined;
  now_ms?: number;
}): Promise<{ tripped: boolean; limit_ms: number }> {
  const now_ms = input.now_ms ?? Date.now();
  const wall = activeDeliveryJobMaxWallMs();
  if (!Number.isFinite(input.created_at) || now_ms - input.created_at <= wall) {
    return { tripped: false, limit_ms: wall };
  }
  let shelfTailReady = false;
  if (productionDeliveryUsesV3() && isV3ShelfTailStage(input.stage)) {
    const lab = await loadDeliveryLab(productionV3LabId(input.job_id)).catch(() => null);
    shelfTailReady = Boolean(lab && v3CursorAwaitingShelfAssemble(lab));
  }
  return deliveryWallFuseDecision({
    created_at: input.created_at,
    now_ms,
    shelfTailReady,
  });
}
