/**
 * Build / expand the Phase-4 dispatch DAG.
 * Spine groups are independent (no sibling deps). Page work waits only on its own spine.
 */

import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import {
  canonicalDispatchStem,
  canonicalFaceId,
  equateDispatchTaskId,
  shelfKeysForPage,
} from "@/lib/llm/pro/delivery/decision-page-bridge";
import { chunkPaths } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import type { DeepEvidenceAssignment } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import {
  DELIVERY_DISPATCH_WRITE_CHUNK_SIZE,
  type DeliveryDispatchDag,
  type DeliveryDispatchTask,
} from "./types";

const WAVE_A_DEEP: readonly DeliverySegmentKey[] = [
  "situation_analysis",
  "personal_decision_patterns",
  "bottleneck_analysis",
  "strategic_options",
  "recommended_strategy",
  "execution_guidance",
  "self_regulation",
];

/** Internals of shelf face 08. The reader sees one 08, not two papers. */
const WAVE_B_DEEP: readonly DeliverySegmentKey[] = ["validation_risk", "validation_close"];

/** Dispatch keys that fill one shelf face. 07 and 03 have no generator key. */
export function shelfFaceDispatchKeys(pageId: DecisionPageId): readonly string[] {
  return shelfKeysForPage(pageId);
}

function task(
  partial: Omit<DeliveryDispatchTask, "attempts" | "updated_at" | "status"> & {
    status?: DeliveryDispatchTask["status"];
  },
): DeliveryDispatchTask {
  const face = partial.key ? canonicalFaceId(partial.key) ?? undefined : undefined;
  return {
    ...partial,
    face,
    status: partial.status ?? "pending",
    attempts: 0,
    updated_at: Date.now(),
  };
}

export function pageFinalizeId(key: DeliverySegmentKey): string {
  return `finalize.${canonicalDispatchStem(key)}`;
}

export const FINALIZE_ASSEMBLE_ID = "finalize.assemble";

export function pageAssignId(key: DeliverySegmentKey): string {
  return `p.${canonicalDispatchStem(key)}.assign`;
}

export function pageWriteChunkId(key: DeliverySegmentKey, i: number): string {
  return `p.${canonicalDispatchStem(key)}.write.c${i}`;
}

export function pageWriteMergeId(key: DeliverySegmentKey): string {
  return `p.${canonicalDispatchStem(key)}.write.merge`;
}

export function pageFillId(key: DeliverySegmentKey): string {
  return `p.${canonicalDispatchStem(key)}.fill`;
}

export function pageMarkId(key: DeliverySegmentKey): string {
  return `p.${canonicalDispatchStem(key)}.mark`;
}

export function pageMarkChunkId(key: DeliverySegmentKey, i: number): string {
  return `p.${canonicalDispatchStem(key)}.mark.c${i}`;
}

export function pageMarkMergeId(key: DeliverySegmentKey): string {
  return `p.${canonicalDispatchStem(key)}.mark.merge`;
}

export function pageReadyId(key: DeliverySegmentKey): string {
  return `p.${canonicalDispatchStem(key)}.ready`;
}

export { equateDispatchTaskId };

/** Stored jobs may still name tasks with v1 keys. Read them as face ids. */
export function equateDeliveryDispatchDag(dag: DeliveryDispatchDag): DeliveryDispatchDag {
  let changed = false;
  const tasks: Record<string, DeliveryDispatchTask> = {};
  for (const [id, item] of Object.entries(dag.tasks)) {
    const nextId = equateDispatchTaskId(id);
    const deps = item.deps.map((dep) => equateDispatchTaskId(dep));
    const face = item.face ?? (item.key ? canonicalFaceId(item.key) ?? undefined : undefined);
    if (nextId !== id || item.id !== nextId || deps.some((dep, index) => dep !== item.deps[index])) {
      changed = true;
    }
    if (face !== item.face) changed = true;
    tasks[nextId] = { ...item, id: nextId, deps, face };
  }
  if (!changed) return dag;
  return { ...dag, tasks, updated_at: Date.now() };
}

export const WAVE_B_GATE_ID = "wave_b.gate";
export const ASSEMBLE_ID = "assemble";

/**
 * Initial DAG. Six finalize spines have empty deps and publish together (staggered).
 * Wave B pages start locked until wave_b.gate unlocks them.
 * Write chunk tasks are spawned when assign completes (unknown unit count at plan time).
 */
export function buildInitialDeliveryDispatchDag(job_id: string): DeliveryDispatchDag {
  const now = Date.now();
  const tasks: Record<string, DeliveryDispatchTask> = {};

  for (const key of DELIVERY_SEGMENT_KEYS) {
    const id = pageFinalizeId(key);
    tasks[id] = task({
      id,
      kind: "finalize_group",
      key,
      deps: [],
    });
  }
  tasks[FINALIZE_ASSEMBLE_ID] = task({
    id: FINALIZE_ASSEMBLE_ID,
    kind: "finalize_assemble",
    deps: DELIVERY_SEGMENT_KEYS.map((k) => pageFinalizeId(k)),
  });

  // P1: fill → ready (no deep / mark). Fill waits only on its own spine.
  tasks[pageFillId("decision_brief")] = task({
    id: pageFillId("decision_brief"),
    kind: "p1_fill",
    key: "decision_brief",
    deps: [pageFinalizeId("decision_brief")],
  });
  tasks[pageReadyId("decision_brief")] = task({
    id: pageReadyId("decision_brief"),
    kind: "ready",
    key: "decision_brief",
    deps: [pageFillId("decision_brief")],
  });

  for (const key of WAVE_A_DEEP) {
    addDeepPageSkeleton(tasks, key, /* locked */ false);
  }

  tasks[WAVE_B_GATE_ID] = task({
    id: WAVE_B_GATE_ID,
    kind: "wave_b_gate",
    // P5/P6 need P4 东方谋略 means in ActionBrief — wait P1+P3+P4 ready.
    deps: [
      pageReadyId("decision_brief"),
      pageReadyId("execution_guidance"),
      pageReadyId("self_regulation"),
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
  const spine = pageFinalizeId(key);
  const deps: string[] = locked ? [spine, WAVE_B_GATE_ID] : [spine];
  if (!locked && (key === "strategic_options" || key === "recommended_strategy")) {
    deps.push(pageReadyId("decision_brief"));
  }
  if (!locked && key === "execution_guidance") {
    deps.push(pageReadyId("decision_brief"));
    deps.push(pageReadyId("recommended_strategy"));
  }
  if (!locked && key === "self_regulation") {
    deps.push(pageReadyId("decision_brief"));
    deps.push(pageReadyId("execution_guidance"));
  }
  tasks[pageAssignId(key)] = task({
    id: pageAssignId(key),
    kind: "assign",
    key,
    deps,
    status,
  });
}

/**
 * After assign succeeds: create write chunks + merge + fill.
 * Mark fan-out is deferred to expandDagAfterFill (arg count known after evidence).
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
  if (isTransition) {
    tasks[pageReadyId(key)] = task({
      id: pageReadyId(key),
      kind: "ready",
      key,
      deps: [fillId],
    });
  }
  // Non-transition: mark.cN + mark.merge + ready created in expandDagAfterFill
  // (arg count known only after evidence tree exists).

  return { ...dag, tasks, updated_at: Date.now() };
}

/**
 * After fill succeeds: fan-out mark arg-chunks (stagger-parallel) + merge + ready.
 * `mark_chunk_count` 0 → skip LLM mark, ready depends on fill.
 */
export function expandDagAfterFill(
  dag: DeliveryDispatchDag,
  key: DeliverySegmentKey,
  mark_chunk_count: number,
): DeliveryDispatchDag {
  if (DELIVERY_TRANSITION_KEYS.has(key)) {
    return dag;
  }
  const tasks = { ...dag.tasks };
  const fillId = pageFillId(key);
  const markIds: string[] = [];
  const n = Math.max(0, Math.floor(mark_chunk_count));

  for (let i = 0; i < n; i++) {
    const id = pageMarkChunkId(key, i);
    markIds.push(id);
    if (!tasks[id]) {
      tasks[id] = task({
        id,
        kind: "mark_chunk",
        key,
        chunk_index: i,
        deps: [fillId],
      });
    }
    // Do not reset existing mark_chunk (ok/running/pending) — fill re-entry must not
    // wipe parallel chunk results (rule 11: no quality luck-retry via DAG reset).
  }

  const mergeId = pageMarkMergeId(key);
  if (!tasks[mergeId]) {
    tasks[mergeId] = task({
      id: mergeId,
      kind: "mark_merge",
      key,
      deps: markIds.length ? markIds : [fillId],
    });
  } else if (tasks[mergeId]!.status !== "ok") {
    tasks[mergeId] = {
      ...tasks[mergeId]!,
      kind: "mark_merge",
      deps: markIds.length ? markIds : [fillId],
      updated_at: Date.now(),
    };
  }

  if (!tasks[pageReadyId(key)] || tasks[pageReadyId(key)]!.status !== "ok") {
    tasks[pageReadyId(key)] = task({
      id: pageReadyId(key),
      kind: "ready",
      key,
      deps: [mergeId],
    });
  } else {
    // Keep ready ok; only ensure deps point at merge for graph integrity.
    tasks[pageReadyId(key)] = {
      ...tasks[pageReadyId(key)]!,
      deps: [mergeId],
      updated_at: Date.now(),
    };
  }

  // Drop legacy single-mark node if present (older DAGs).
  const legacyMark = pageMarkId(key);
  if (tasks[legacyMark]?.kind === "mark") {
    delete tasks[legacyMark];
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
      if (id === FINALIZE_ASSEMBLE_ID) return 12;
      if (id.startsWith("finalize.")) return 5;
      if (id === WAVE_B_GATE_ID) return 50;
      if (id.includes(".ready")) return 40;
      if (id.includes(".mark.merge")) return 35;
      if (id.includes(".mark.c")) return 30;
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
