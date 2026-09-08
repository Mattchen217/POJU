/**
 * Dispatch scheduler — list ready DAG tasks, stagger-publish workers, exit.
 */

import { logDeliveryStep } from "@/lib/llm/pro/delivery/delivery-step-log";
import {
  assembleIsOk,
  dagHasFailed,
  listInflightTaskIds,
  listReadyTaskIds,
} from "./task-dag";
import {
  loadDeliveryDispatchDag,
  patchDispatchTask,
  saveDeliveryDispatchDag,
} from "./task-store";
import {
  DELIVERY_DISPATCH_MAX_INFLIGHT,
  DELIVERY_DISPATCH_STAGGER_MS,
  type DeliveryDispatchDag,
} from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ScheduleTickResult =
  | { status: "published"; task_ids: string[] }
  | { status: "idle_waiting" }
  | { status: "segments_merged" }
  | { status: "failed"; reason: string }
  | { status: "noop"; reason: string };

/**
 * One scheduler tick: publish up to max in-flight ready tasks (staggered).
 * Does not run LLM work.
 */
export async function runDeliveryDispatchSchedulerTick(input: {
  job_id: string;
  publishTask: (task_id: string) => Promise<"published" | "failed">;
  max_inflight?: number;
  stagger_ms?: number;
}): Promise<ScheduleTickResult> {
  const job_id = input.job_id;
  const dag = await loadDeliveryDispatchDag(job_id);
  if (!dag) {
    return { status: "noop", reason: "missing_dag" };
  }

  if (assembleIsOk(dag)) {
    return { status: "segments_merged" };
  }

  if (dagHasFailed(dag)) {
    const failed = Object.values(dag.tasks).find((t) => t.status === "failed");
    return {
      status: "failed",
      reason: failed?.error ?? `task_failed:${failed?.id ?? "?"}`,
    };
  }

  const maxInflight = input.max_inflight ?? DELIVERY_DISPATCH_MAX_INFLIGHT;
  const stagger = input.stagger_ms ?? DELIVERY_DISPATCH_STAGGER_MS;
  const inflight = listInflightTaskIds(dag);
  const slots = Math.max(0, maxInflight - inflight.length);
  if (slots === 0) {
    return { status: "idle_waiting" };
  }

  const ready = listReadyTaskIds(dag).slice(0, slots);
  if (ready.length === 0) {
    if (inflight.length > 0) return { status: "idle_waiting" };
    // Deadlock check — pending but deps not ok, and nothing running
    const pending = Object.values(dag.tasks).filter((t) => t.status === "pending");
    if (pending.length === 0) {
      // only locked (wave B) left without gate?
      const locked = Object.values(dag.tasks).filter((t) => t.status === "locked");
      if (locked.length > 0) {
        return { status: "failed", reason: "dispatch_deadlock_locked" };
      }
      return { status: "noop", reason: "nothing_pending" };
    }
    return { status: "idle_waiting" };
  }

  const published: string[] = [];
  for (let i = 0; i < ready.length; i++) {
    const task_id = ready[i]!;
    // Claim before publish so parallel scheduler ticks cannot double-book.
    const claimed = await patchDispatchTask(job_id, task_id, { status: "running" });
    const claimedTask = claimed?.tasks[task_id];
    if (!claimedTask || claimedTask.status !== "running") continue;

    const pub = await input.publishTask(task_id);
    if (pub !== "published") {
      await patchDispatchTask(job_id, task_id, { status: "pending" });
      console.warn("[delivery/dispatch] publish failed — rolled back", { job_id, task_id });
      continue;
    }
    published.push(task_id);
    if (i + 1 < ready.length && stagger > 0) {
      await sleep(stagger);
    }
  }

  if (published.length === 0) {
    return { status: "failed", reason: "publish_all_failed" };
  }

  logDeliveryStep({
    job_id,
    level: "ok",
    step: "dispatch schedule",
    detail: published.join(","),
    tags: `n=${published.length}`,
  });
  console.info("[delivery/dispatch] scheduled", { job_id, tasks: published });
  return { status: "published", task_ids: published };
}

export async function ensureDeliveryDispatchDag(
  job_id: string,
  build: () => DeliveryDispatchDag,
): Promise<DeliveryDispatchDag> {
  const existing = await loadDeliveryDispatchDag(job_id);
  if (existing) return existing;
  const dag = build();
  await saveDeliveryDispatchDag(dag);
  return dag;
}
