/**
 * Phase 4 delivery — stage + per-task checkpoint keys in KV.
 * Coarse stages (finalize→…→assemble) each get a fresh Vercel 300s via /continue.
 * Fan-out stages run DeliveryTasks in waves (task KV); mark uses 1 task/continue.
 */

import { kv, KV_TTL } from "@/lib/kv/client";
import type { DeliveryArgumentTree, DeliveryComputed } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_TASKS } from "@/lib/llm/pro/delivery/delivery-tasks";

/** Longer than Vercel maxDuration(300s) so a hard-killed invoke cannot overlap the next hop. */
export const DELIVERY_CONTINUE_LEASE_MS = 330_000;

export type DeliveryContinueLease = {
  token: string;
  stage: string;
  started_at: number;
  expires_at: number;
};

export function deliveryContinueLeaseKey(job_id: string): string {
  return `poju-xhigh:job:${job_id}:continue-lease`;
}

export async function loadDeliveryContinueLease(
  job_id: string,
): Promise<DeliveryContinueLease | null> {
  const lease = await kv.get<DeliveryContinueLease>(deliveryContinueLeaseKey(job_id));
  if (!lease || typeof lease.expires_at !== "number") return null;
  if (lease.expires_at <= Date.now()) return null;
  return lease;
}

/**
 * Single-flight for /continue (+ inline fallback). Returns false if another
 * invocation still holds a non-expired lease.
 */
export async function tryAcquireDeliveryContinueLease(
  job_id: string,
  stage: string,
  leaseMs: number = DELIVERY_CONTINUE_LEASE_MS,
): Promise<{ ok: true; token: string } | { ok: false; lease: DeliveryContinueLease }> {
  const key = deliveryContinueLeaseKey(job_id);
  const existing = await kv.get<DeliveryContinueLease>(key);
  const now = Date.now();
  if (
    existing &&
    typeof existing.expires_at === "number" &&
    existing.expires_at > now &&
    typeof existing.token === "string"
  ) {
    return { ok: false, lease: existing };
  }
  const token = `${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const lease: DeliveryContinueLease = {
    token,
    stage,
    started_at: now,
    expires_at: now + leaseMs,
  };
  await kv.set(key, lease, { ex: Math.ceil(leaseMs / 1000) + 60 });
  return { ok: true, token };
}

export async function refreshDeliveryContinueLease(
  job_id: string,
  token: string,
  leaseMs: number = DELIVERY_CONTINUE_LEASE_MS,
): Promise<void> {
  const key = deliveryContinueLeaseKey(job_id);
  const existing = await kv.get<DeliveryContinueLease>(key);
  if (!existing || existing.token !== token) return;
  const now = Date.now();
  await kv.set(
    key,
    { ...existing, expires_at: now + leaseMs },
    { ex: Math.ceil(leaseMs / 1000) + 60 },
  );
}

export async function releaseDeliveryContinueLease(
  job_id: string,
  token: string,
): Promise<void> {
  const key = deliveryContinueLeaseKey(job_id);
  const existing = await kv.get<DeliveryContinueLease>(key);
  if (!existing || existing.token !== token) return;
  await kv.del(key);
}

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

/** All DELIVERY_TASKs without a task checkpoint (stable order). */
export async function listIncompleteDeliveryTasks(
  job_id: string,
  stage: DeliveryFanoutStage,
): Promise<Array<(typeof DELIVERY_TASKS)[number]>> {
  const out: Array<(typeof DELIVERY_TASKS)[number]> = [];
  for (const t of DELIVERY_TASKS) {
    const cp = await loadDeliveryTaskCheckpoint(job_id, stage, t.name);
    if (!cp) out.push(t);
  }
  return out;
}

/** First DELIVERY_TASK without a task checkpoint (or null if all done). */
export async function findNextIncompleteDeliveryTask(
  job_id: string,
  stage: DeliveryFanoutStage,
): Promise<(typeof DELIVERY_TASKS)[number] | null> {
  const all = await listIncompleteDeliveryTasks(job_id, stage);
  return all[0] ?? null;
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
