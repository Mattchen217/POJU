/**
 * Phase 4 delivery — stage checkpoint keys in KV.
 * Each stage finishes in its own function invocation; next stage reads these.
 */

import { kv, KV_TTL } from "@/lib/kv/client";
import type { DeliveryArgumentTree, DeliveryComputed } from "@/lib/llm/pro/delivery/delivery-schema";

export const DELIVERY_PIPELINE_STAGES = [
  "finalize",
  "narrative",
  "evidence",
  "mark",
  "assemble",
] as const;

export type DeliveryPipelineStage = (typeof DELIVERY_PIPELINE_STAGES)[number];

export type DeliveryStageCheckpoint =
  | { stage: "finalize"; value: DeliveryComputed; tokens_used: number; model: string }
  | { stage: "narrative"; value: DeliveryArgumentTree; tokens_used: number }
  | { stage: "evidence"; value: DeliveryArgumentTree; tokens_used: number }
  | { stage: "mark"; value: DeliveryArgumentTree; tokens_used: number; narrative: DeliveryArgumentTree }
  | {
      stage: "assemble";
      full_text: string;
      tokens_used: number;
      model: string;
      timings: Record<string, number | undefined>;
    };

export function deliveryStageKey(job_id: string, stage: DeliveryPipelineStage): string {
  return `poju-xhigh:job:${job_id}:stage:${stage}`;
}

export function nextDeliveryStage(
  current: DeliveryPipelineStage | null,
): DeliveryPipelineStage | null {
  if (current == null) return "finalize";
  const i = DELIVERY_PIPELINE_STAGES.indexOf(current);
  if (i < 0 || i >= DELIVERY_PIPELINE_STAGES.length - 1) return null;
  return DELIVERY_PIPELINE_STAGES[i + 1]!;
}

export async function saveDeliveryStageCheckpoint(
  job_id: string,
  checkpoint: DeliveryStageCheckpoint,
): Promise<void> {
  await kv.set(deliveryStageKey(job_id, checkpoint.stage), checkpoint, {
    ex: KV_TTL.POJU_XHIGH_JOB,
  });
}

export async function loadDeliveryStageCheckpoint<S extends DeliveryPipelineStage>(
  job_id: string,
  stage: S,
): Promise<Extract<DeliveryStageCheckpoint, { stage: S }> | null> {
  const data = await kv.get<DeliveryStageCheckpoint>(deliveryStageKey(job_id, stage));
  if (!data || data.stage !== stage) return null;
  return data as Extract<DeliveryStageCheckpoint, { stage: S }>;
}

/** Highest completed stage for this job (or null if none). */
export async function findLatestCompletedDeliveryStage(
  job_id: string,
): Promise<DeliveryPipelineStage | null> {
  let latest: DeliveryPipelineStage | null = null;
  for (const s of DELIVERY_PIPELINE_STAGES) {
    const cp = await loadDeliveryStageCheckpoint(job_id, s);
    if (cp) latest = s;
    else break;
  }
  return latest;
}
