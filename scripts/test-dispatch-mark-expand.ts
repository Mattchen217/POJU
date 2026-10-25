/**
 * Contract: fill → expandDagAfterFill fans mark.cN + mark.merge + ready.
 * Run: pnpm exec tsx scripts/test-dispatch-mark-expand.ts
 */
import assert from "node:assert/strict";
import {
  buildInitialDeliveryDispatchDag,
  expandDagAfterFill,
  FINALIZE_ASSEMBLE_ID,
  pageAssignId,
  pageFillId,
  pageFinalizeId,
  pageMarkChunkId,
  pageMarkMergeId,
  pageReadyId,
  listReadyTaskIds,
  WAVE_B_GATE_ID,
} from "@/lib/llm/pro/delivery/dispatch/task-dag";
import { DELIVERY_SEGMENT_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";

const job = "test-mark-expand";
let dag = buildInitialDeliveryDispatchDag(job);

// Seed fill as ok so mark.c* become ready after expand.
const fillId = pageFillId("situation_analysis");
dag.tasks[fillId] = {
  id: fillId,
  kind: "fill",
  key: "situation_analysis",
  deps: [],
  status: "ok",
  attempts: 1,
  updated_at: Date.now(),
};

dag = expandDagAfterFill(dag, "situation_analysis", 3);
assert.equal(dag.tasks[pageMarkChunkId("situation_analysis", 0)]?.kind, "mark_chunk");
assert.equal(dag.tasks[pageMarkChunkId("situation_analysis", 1)]?.kind, "mark_chunk");
assert.equal(dag.tasks[pageMarkChunkId("situation_analysis", 2)]?.kind, "mark_chunk");
assert.equal(dag.tasks[pageMarkMergeId("situation_analysis")]?.kind, "mark_merge");
assert.deepEqual(dag.tasks[pageMarkMergeId("situation_analysis")]?.deps, [
  pageMarkChunkId("situation_analysis", 0),
  pageMarkChunkId("situation_analysis", 1),
  pageMarkChunkId("situation_analysis", 2),
]);
assert.deepEqual(dag.tasks[pageReadyId("situation_analysis")]?.deps, [
  pageMarkMergeId("situation_analysis"),
]);

const ready = listReadyTaskIds(dag);
assert.ok(ready.includes(pageMarkChunkId("situation_analysis", 0)));
assert.ok(ready.includes(pageMarkChunkId("situation_analysis", 1)));
assert.ok(ready.includes(pageMarkChunkId("situation_analysis", 2)));
assert.ok(!ready.includes(pageMarkMergeId("situation_analysis")));

for (const i of [0, 1, 2]) {
  const id = pageMarkChunkId("situation_analysis", i);
  dag.tasks[id] = { ...dag.tasks[id]!, status: "ok", updated_at: Date.now() };
}
assert.ok(listReadyTaskIds(dag).includes(pageMarkMergeId("situation_analysis")));

// Idempotent: second expand must not wipe ok chunks
dag.tasks[pageMarkChunkId("situation_analysis", 0)]!.result = {
  type: "mark_partial",
  partial: {},
  chunk_index: 0,
};
dag = expandDagAfterFill(dag, "situation_analysis", 3);
assert.equal(dag.tasks[pageMarkChunkId("situation_analysis", 0)]?.status, "ok");
assert.equal(dag.tasks[pageMarkChunkId("situation_analysis", 0)]?.result?.type, "mark_partial");

// Zero chunks → merge deps on fill only
const rgFill = pageFillId("validation_risk");
dag.tasks[rgFill] = {
  id: rgFill,
  kind: "fill",
  key: "validation_risk",
  deps: [],
  status: "ok",
  attempts: 1,
  updated_at: Date.now(),
};
dag = expandDagAfterFill(dag, "validation_risk", 0);
assert.equal(dag.tasks[pageMarkChunkId("validation_risk", 0)], undefined);
assert.deepEqual(dag.tasks[pageMarkMergeId("validation_risk")]?.deps, [rgFill]);

const spine = buildInitialDeliveryDispatchDag("spine-contract");
for (const key of DELIVERY_SEGMENT_KEYS) {
  assert.deepEqual(spine.tasks[pageFinalizeId(key)]?.deps, [], `${key} spine has no sibling deps`);
}
assert.deepEqual(spine.tasks[pageFillId("decision_brief")]?.deps, [
  pageFinalizeId("decision_brief"),
]);
assert.deepEqual(spine.tasks[pageAssignId("situation_analysis")]?.deps, [pageFinalizeId("situation_analysis")]);
assert.deepEqual(spine.tasks[pageAssignId("execution_guidance")]?.deps, [
  pageFinalizeId("execution_guidance"),
]);
assert.deepEqual(spine.tasks[pageAssignId("self_regulation")]?.deps, [
  pageFinalizeId("self_regulation"),
]);
assert.deepEqual(spine.tasks[pageAssignId("validation_risk")]?.deps, [
  pageFinalizeId("validation_risk"),
  WAVE_B_GATE_ID,
]);
assert.equal(spine.tasks[pageAssignId("validation_risk")]?.status, "locked");
assert.deepEqual(spine.tasks[pageAssignId("validation_close")]?.deps, [
  pageFinalizeId("validation_close"),
  WAVE_B_GATE_ID,
]);
assert.equal(spine.tasks[pageAssignId("validation_close")]?.status, "locked");
assert.deepEqual(
  spine.tasks[FINALIZE_ASSEMBLE_ID]?.deps,
  DELIVERY_SEGMENT_KEYS.map((k) => pageFinalizeId(k)),
);
assert.ok(
  !spine.tasks[pageFillId("decision_brief")]?.deps.includes(FINALIZE_ASSEMBLE_ID),
  "P1 fill must not wait for the no-LLM assemble",
);

const onlyP1 = buildInitialDeliveryDispatchDag("only-p1-spine");
onlyP1.tasks[pageFinalizeId("decision_brief")] = {
  ...onlyP1.tasks[pageFinalizeId("decision_brief")]!,
  status: "ok",
};
const readyAfterP1 = listReadyTaskIds(onlyP1);
assert.ok(readyAfterP1.includes(pageFillId("decision_brief")), "P1 fill ready from its own spine");
assert.ok(
  !readyAfterP1.includes(pageAssignId("self_regulation")),
  "P4 assign waits for the P4 spine, not P1",
);
assert.ok(!readyAfterP1.includes(FINALIZE_ASSEMBLE_ID));

const onlyP4 = buildInitialDeliveryDispatchDag("only-p4-spine");
onlyP4.tasks[pageFinalizeId("self_regulation")] = {
  ...onlyP4.tasks[pageFinalizeId("self_regulation")]!,
  status: "ok",
};
const readyAfterP4 = listReadyTaskIds(onlyP4);
assert.ok(readyAfterP4.includes(pageAssignId("self_regulation")));
assert.ok(
  !readyAfterP4.includes(pageFillId("decision_brief")),
  "P1 fill does not become ready just because the P4 spine finished",
);

console.log("ok — dispatch mark expand contract");
