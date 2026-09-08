/**
 * KV persistence for the Phase-4 dispatch DAG.
 */

import { kv, KV_TTL } from "@/lib/kv/client";
import type { DeliveryDispatchDag, DeliveryDispatchTask } from "./types";

export function deliveryDispatchDagKey(job_id: string): string {
  return `poju-xhigh:job:${job_id}:dispatch:dag`;
}

export function deliveryDispatchTaskLeaseKey(job_id: string, task_id: string): string {
  return `poju-xhigh:job:${job_id}:dispatch:lease:${task_id}`;
}

export async function loadDeliveryDispatchDag(
  job_id: string,
): Promise<DeliveryDispatchDag | null> {
  const raw = await kv.get<DeliveryDispatchDag>(deliveryDispatchDagKey(job_id));
  if (!raw || typeof raw !== "object") return null;
  if (raw.version !== 1 || !raw.tasks) return null;
  return raw;
}

export async function saveDeliveryDispatchDag(dag: DeliveryDispatchDag): Promise<void> {
  const next = { ...dag, updated_at: Date.now() };
  await kv.set(deliveryDispatchDagKey(dag.job_id), next, {
    ex: KV_TTL.POJU_XHIGH_JOB,
  });
}

/** NX lease so two workers cannot run the same task. TTL covers one 300s invoke + skew. */
export async function tryAcquireDispatchTaskLease(
  job_id: string,
  task_id: string,
  ttlSec = 330,
): Promise<boolean> {
  const result = await kv.set(
    deliveryDispatchTaskLeaseKey(job_id, task_id),
    { task_id, at: Date.now() },
    { nx: true, ex: ttlSec },
  );
  return result === "OK";
}

export async function releaseDispatchTaskLease(
  job_id: string,
  task_id: string,
): Promise<void> {
  await kv.del(deliveryDispatchTaskLeaseKey(job_id, task_id));
}

export async function patchDispatchTask(
  job_id: string,
  task_id: string,
  patch: Partial<DeliveryDispatchTask>,
): Promise<DeliveryDispatchDag | null> {
  const dag = await loadDeliveryDispatchDag(job_id);
  if (!dag) return null;
  const prev = dag.tasks[task_id];
  if (!prev) return dag;
  const next: DeliveryDispatchDag = {
    ...dag,
    updated_at: Date.now(),
    tasks: {
      ...dag.tasks,
      [task_id]: { ...prev, ...patch, updated_at: Date.now() },
    },
  };
  await saveDeliveryDispatchDag(next);
  return next;
}
