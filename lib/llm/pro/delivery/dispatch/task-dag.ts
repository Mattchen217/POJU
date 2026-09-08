/**
 * Build / expand the Phase-4 dispatch DAG after finalize.
 */

import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { chunkPaths } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import type { DeepEvidenceAssignment } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import {
  DELIVERY_DISPATCH_WRITE_CHUNK_SIZE,
  type DeliveryDispatchDag,
  type DeliveryDispatchTask,
} from "./types";

const WAVE_A_DEEP: readonly DeliverySegmentKey[] = [
  "foundation",
  "science_action",
  "metaphysics_action",
];

const WAVE_B_DEEP: readonly DeliverySegmentKey[] = ["risk_guard", "signals_close"];

function task(
  partial: Omit<DeliveryDispatchTask, "attempts" | "updated_at" | "status"> & {
    status?: DeliveryDispatchTask["status"];
  },
): DeliveryDispatchTask {
  return {
    ...partial,
    status: partial.status ?? "pending",
    attempts: 0,
    updated_at: Date.now(),
  };
}

export function pageAssignId(key: DeliverySegmentKey): string {
  return `p.${key}.assign`;
}

export function pageWriteChunkId(key: DeliverySegmentKey, i: number): string {
  return `p.${key}.write.c${i}`;
}

export function pageWriteMergeId(key: DeliverySegmentKey): string {
  return `p.${key}.write.merge`;
}

export function pageFillId(key: DeliverySegmentKey): string {
  return `p.${key}.fill`;
}

export function pageMarkId(key: DeliverySegmentKey): string {
  return `p.${key}.mark`;
}

export function pageReadyId(key: DeliverySegmentKey): string {
  return `p.${key}.ready`;
}

export const WAVE_B_GATE_ID = "wave_b.gate";
export const ASSEMBLE_ID = "assemble";

/**
 * Initial DAG after finalize checkpoint exists.
 * Wave B pages start locked until wave_b.gate unlocks them.
 * Write chunk tasks are spawned when assign completes (unknown unit count at plan time).
 */
export function buildInitialDeliveryDispatchDag(job_id: string): DeliveryDispatchDag {
  const now = Date.now();
  const tasks: Record<string, DeliveryDispatchTask> = {};

  // P1: fill → ready (no deep / mark)
  tasks[pageFillId("direct_answer")] = task({
    id: pageFillId("direct_answer"),
    kind: "p1_fill",
    key: "direct_answer",
    deps: [],
  });
  tasks[pageReadyId("direct_answer")] = task({
    id: pageReadyId("direct_answer"),
    kind: "ready",
    key: "direct_answer",
    deps: [pageFillId("direct_answer")],
  });

  for (const key of WAVE_A_DEEP) {
    addDeepPageSkeleton(tasks, key, /* locked */ false);
  }

  tasks[WAVE_B_GATE_ID] = task({
    id: WAVE_B_GATE_ID,
    kind: "wave_b_gate",
    // P5/P6 need P4 自我调频 means in ActionBrief — wait P1+P3+P4 ready.
    deps: [
      pageReadyId("direct_answer"),
      pageReadyId("science_action"),
      pageReadyId("metaphysics_action"),
    ],
  });

  for (const key of WAVE_B_DEEP) {
    addDeepPageSkeleton(tasks, key, /* locked */ true);
  }

  const readyDeps = DELIVERY_SEGMENT_KEYS.map((k) => pageReadyId(k));
  tasks[ASSEMBLE_ID] = task({
    id: ASSEMBLE_ID,
    kind: "assemble",
    deps: readyDeps,
    status: "pending",
  });

  return {
    job_id,
    version: 1,
    created_at: now,
    updated_at: now,
    tasks,
  };
}

function addDeepPageSkeleton(
  tasks: Record<string, DeliveryDispatchTask>,
  key: DeliverySegmentKey,
  locked: boolean,
): void {
  const status = locked ? "locked" : "pending";
  // assign only until units known — write/fill/mark/ready added in expandAfterAssign
  // OR we add placeholder fill/mark/ready deps that get rewired.
  // Simpler: create assign; on assign ok expand writes+merge+fill+mark+ready.
  tasks[pageAssignId(key)] = task({
    id: pageAssignId(key),
    kind: "assign",
    key,
    deps: locked ? [WAVE_B_GATE_ID] : [],
    status,
  });
}

/**
 * After assign succeeds: create write chunks + merge + fill + mark + ready.
 */
export function expandDagAfterAssign(
  dag: DeliveryDispatchDag,
  key: DeliverySegmentKey,
  assignment: DeepEvidenceAssignment,
): DeliveryDispatchDag {
  const chunks = chunkPaths(assignment.units, DELIVERY_DISPATCH_WRITE_CHUNK_SIZE);
  const tasks = { ...dag.tasks };
  const assignId = pageAssignId(key);
  const writeIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const id = pageWriteChunkId(key, i);
    writeIds.push(id);
    if (!tasks[id]) {
      tasks[id] = task({
        id,
        kind: "write_chunk",
        key,
        chunk_index: i,
        deps: [assignId],
      });
    }
  }

  const mergeId = pageWriteMergeId(key);
  tasks[mergeId] = task({
    id: mergeId,
    kind: "write_merge",
    key,
    deps: writeIds.length ? writeIds : [assignId],
  });

  const fillId = pageFillId(key);
  tasks[fillId] = task({
    id: fillId,
    kind: "fill",
    key,
    deps: [mergeId],
  });

  const isTransition = DELIVERY_TRANSITION_KEYS.has(key);
  if (!isTransition) {
    const markId = pageMarkId(key);
    tasks[markId] = task({
      id: markId,
      kind: "mark",
      key,
      deps: [fillId],
    });
    tasks[pageReadyId(key)] = task({
      id: pageReadyId(key),
      kind: "ready",
      key,
      deps: [markId],
    });
  } else {
    tasks[pageReadyId(key)] = task({
      id: pageReadyId(key),
      kind: "ready",
      key,
      deps: [fillId],
    });
  }

  return { ...dag, tasks, updated_at: Date.now() };
}

/** Unlock Wave B assign tasks after gate. */
export function unlockWaveB(dag: DeliveryDispatchDag): DeliveryDispatchDag {
  const tasks = { ...dag.tasks };
  const unlocked: DeliverySegmentKey[] = [];
  for (const key of WAVE_B_DEEP) {
    const id = pageAssignId(key);
    const t = tasks[id];
    if (t && t.status === "locked") {
      tasks[id] = { ...t, status: "pending", updated_at: Date.now() };
      unlocked.push(key);
    }
  }
  return { ...dag, tasks, updated_at: Date.now() };
}

export function listReadyTaskIds(dag: DeliveryDispatchDag): string[] {
  const out: string[] = [];
  for (const t of Object.values(dag.tasks)) {
    if (t.status !== "pending") continue;
    const depsOk = t.deps.every((d) => dag.tasks[d]?.status === "ok");
    if (depsOk) out.push(t.id);
  }
  // Prefer content pages before assemble; stable sort by id
  out.sort((a, b) => {
    const rank = (id: string) => {
      if (id === ASSEMBLE_ID) return 90;
      if (id === WAVE_B_GATE_ID) return 50;
      if (id.includes(".ready")) return 40;
      if (id.includes(".mark")) return 30;
      if (id.includes(".fill")) return 20;
      if (id.includes(".write")) return 15;
      if (id.includes(".assign")) return 10;
      return 0;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return out;
}

export function listInflightTaskIds(dag: DeliveryDispatchDag): string[] {
  return Object.values(dag.tasks)
    .filter((t) => t.status === "running")
    .map((t) => t.id);
}

export function allTasksTerminal(dag: DeliveryDispatchDag): boolean {
  return Object.values(dag.tasks).every(
    (t) => t.status === "ok" || t.status === "failed" || t.status === "locked",
  );
}

export function dagHasFailed(dag: DeliveryDispatchDag): boolean {
  return Object.values(dag.tasks).some((t) => t.status === "failed");
}

export function assembleIsOk(dag: DeliveryDispatchDag): boolean {
  return dag.tasks[ASSEMBLE_ID]?.status === "ok";
}
