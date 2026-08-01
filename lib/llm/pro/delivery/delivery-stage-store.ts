/**
 * Phase 4 delivery — stage + per-task checkpoint keys in KV.
 * Coarse stages (finalize→…→assemble) each get a fresh Vercel 300s via /continue.
 * Heavy stages further fan out one DELIVERY_TASK per continue (task KV), so mark /
 * narrative / evidence never Promise.all 9× LLM inside one invocation.
 */

import { kv, KV_TTL } from "@/lib/kv/client";
import type { DeliveryArgumentTree, DeliveryComputed } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_TASKS } from "@/lib/llm/pro/delivery/delivery-tasks";

export const DELIVERY_PIPELINE_STAGES = [
  "finalize",
  "narrative",
  "evidence",
  "mark",
  "assemble",
] as const;

export type DeliveryPipelineStage = (typeof DELIVERY_PIPELINE_STAGES)[number];

/** Stages that run one DeliveryTask per continue invocation. */
export const DELIVERY_FANOUT_STAGES = [
  "finalize",
  "narrative",
  "evidence",
  "mark",
] as const;

export type DeliveryFanoutStage = (typeof DELIVERY_FANOUT_STAGES)[number];

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

export type DeliveryTaskCheckpoint = {
  stage: DeliveryFanoutStage;
  task: string;
  value: DeliveryArgumentTree | Partial<DeliveryComputed>;
  tokens_used: number;
  model?: string;
};

export function deliveryStageKey(job_id: string, stage: DeliveryPipelineStage): string {
  return `poju-xhigh:job:${job_id}:stage:${stage}`;
}

export function deliveryTaskKey(
  job_id: string,
  stage: DeliveryFanoutStage,
  task: string,
): string {
  return `poju-xhigh:job:${job_id}:stage:${stage}:task:${task}`;
}

export function isDeliveryFanoutStage(stage: DeliveryPipelineStage): stage is DeliveryFanoutStage {
  return (DELIVERY_FANOUT_STAGES as readonly string[]).includes(stage);
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

export async function saveDeliveryTaskCheckpoint(
  job_id: string,
  checkpoint: DeliveryTaskCheckpoint,
): Promise<void> {
  await kv.set(deliveryTaskKey(job_id, checkpoint.stage, checkpoint.task), checkpoint, {
    ex: KV_TTL.POJU_XHIGH_JOB,
  });
}

export async function loadDeliveryTaskCheckpoint(
  job_id: string,
  stage: DeliveryFanoutStage,
  task: string,
): Promise<DeliveryTaskCheckpoint | null> {
  const data = await kv.get<DeliveryTaskCheckpoint>(deliveryTaskKey(job_id, stage, task));
  if (!data || data.stage !== stage || data.task !== task) return null;
  return data;
}

/** First DELIVERY_TASK without a task checkpoint (or null if all done). */
export async function findNextIncompleteDeliveryTask(
  job_id: string,
  stage: DeliveryFanoutStage,
): Promise<(typeof DELIVERY_TASKS)[number] | null> {
  for (const t of DELIVERY_TASKS) {
    const cp = await loadDeliveryTaskCheckpoint(job_id, stage, t.name);
    if (!cp) return t;
  }
  return null;
}

export async function loadAllDeliveryTaskCheckpoints(
  job_id: string,
  stage: DeliveryFanoutStage,
): Promise<DeliveryTaskCheckpoint[]> {
  const out: DeliveryTaskCheckpoint[] = [];
  for (const t of DELIVERY_TASKS) {
    const cp = await loadDeliveryTaskCheckpoint(job_id, stage, t.name);
    if (cp) out.push(cp);
  }
  return out;
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
