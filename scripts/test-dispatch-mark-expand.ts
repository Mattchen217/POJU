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
const fillId = pageFillId("foundation");
dag.tasks[fillId] = {
  id: fillId,
  kind: "fill",
  key: "foundation",
  deps: [],
  status: "ok",
  attempts: 1,
  updated_at: Date.now(),
};

dag = expandDagAfterFill(dag, "foundation", 3);
assert.equal(dag.tasks[pageMarkChunkId("foundation", 0)]?.kind, "mark_chunk");
assert.equal(dag.tasks[pageMarkChunkId("foundation", 1)]?.kind, "mark_chunk");
assert.equal(dag.tasks[pageMarkChunkId("foundation", 2)]?.kind, "mark_chunk");
assert.equal(dag.tasks[pageMarkMergeId("foundation")]?.kind, "mark_merge");
assert.deepEqual(dag.tasks[pageMarkMergeId("foundation")]?.deps, [
  pageMarkChunkId("foundation", 0),
  pageMarkChunkId("foundation", 1),
  pageMarkChunkId("foundation", 2),
]);
assert.deepEqual(dag.tasks[pageReadyId("foundation")]?.deps, [
  pageMarkMergeId("foundation"),
]);

const ready = listReadyTaskIds(dag);
assert.ok(ready.includes(pageMarkChunkId("foundation", 0)));
assert.ok(ready.includes(pageMarkChunkId("foundation", 1)));
assert.ok(ready.includes(pageMarkChunkId("foundation", 2)));
assert.ok(!ready.includes(pageMarkMergeId("foundation")));

for (const i of [0, 1, 2]) {
  const id = pageMarkChunkId("foundation", i);
  dag.tasks[id] = { ...dag.tasks[id]!, status: "ok", updated_at: Date.now() };
}
assert.ok(listReadyTaskIds(dag).includes(pageMarkMergeId("foundation")));

// Idempotent: second expand must not wipe ok chunks
dag.tasks[pageMarkChunkId("foundation", 0)]!.result = {
  type: "mark_partial",
  partial: {},
  chunk_index: 0,
};
dag = expandDagAfterFill(dag, "foundation", 3);
assert.equal(dag.tasks[pageMarkChunkId("foundation", 0)]?.status, "ok");
assert.equal(dag.tasks[pageMarkChunkId("foundation", 0)]?.result?.type, "mark_partial");

// Zero chunks → merge deps on fill only
const rgFill = pageFillId("risk_guard");
dag.tasks[rgFill] = {
  id: rgFill,
  kind: "fill",
  key: "risk_guard",
  deps: [],
  status: "ok",
  attempts: 1,
  updated_at: Date.now(),
};
dag = expandDagAfterFill(dag, "risk_guard", 0);
assert.equal(dag.tasks[pageMarkChunkId("risk_guard", 0)], undefined);
assert.deepEqual(dag.tasks[pageMarkMergeId("risk_guard")]?.deps, [rgFill]);

const spine = buildInitialDeliveryDispatchDag("spine-contract");
for (const key of DELIVERY_SEGMENT_KEYS) {
  assert.deepEqual(spine.tasks[pageFinalizeId(key)]?.deps, [], `${key} spine has no sibling deps`);
}
assert.deepEqual(spine.tasks[pageFillId("direct_answer")]?.deps, [
  pageFinalizeId("direct_answer"),
]);
assert.deepEqual(spine.tasks[pageAssignId("foundation")]?.deps, [pageFinalizeId("foundation")]);
assert.deepEqual(spine.tasks[pageAssignId("science_action")]?.deps, [
  pageFinalizeId("science_action"),
]);
assert.deepEqual(spine.tasks[pageAssignId("metaphysics_action")]?.deps, [
  pageFinalizeId("metaphysics_action"),
]);
assert.deepEqual(spine.tasks[pageAssignId("risk_guard")]?.deps, [
  pageFinalizeId("risk_guard"),
  WAVE_B_GATE_ID,
]);
assert.equal(spine.tasks[pageAssignId("risk_guard")]?.status, "locked");
assert.deepEqual(spine.tasks[pageAssignId("signals_close")]?.deps, [
  pageFinalizeId("signals_close"),
  WAVE_B_GATE_ID,
]);
assert.equal(spine.tasks[pageAssignId("signals_close")]?.status, "locked");
assert.deepEqual(
  spine.tasks[FINALIZE_ASSEMBLE_ID]?.deps,
  DELIVERY_SEGMENT_KEYS.map((k) => pageFinalizeId(k)),
);
assert.ok(
  !spine.tasks[pageFillId("direct_answer")]?.deps.includes(FINALIZE_ASSEMBLE_ID),
  "P1 fill must not wait for the no-LLM assemble",
);

const onlyP1 = buildInitialDeliveryDispatchDag("only-p1-spine");
onlyP1.tasks[pageFinalizeId("direct_answer")] = {
  ...onlyP1.tasks[pageFinalizeId("direct_answer")]!,
  status: "ok",
};
const readyAfterP1 = listReadyTaskIds(onlyP1);
assert.ok(readyAfterP1.includes(pageFillId("direct_answer")), "P1 fill ready from its own spine");
assert.ok(
  !readyAfterP1.includes(pageAssignId("metaphysics_action")),
  "P4 assign waits for the P4 spine, not P1",
);
assert.ok(!readyAfterP1.includes(FINALIZE_ASSEMBLE_ID));

const onlyP4 = buildInitialDeliveryDispatchDag("only-p4-spine");
onlyP4.tasks[pageFinalizeId("metaphysics_action")] = {
  ...onlyP4.tasks[pageFinalizeId("metaphysics_action")]!,
  status: "ok",
};
const readyAfterP4 = listReadyTaskIds(onlyP4);
assert.ok(readyAfterP4.includes(pageAssignId("metaphysics_action")));
assert.ok(
  !readyAfterP4.includes(pageFillId("direct_answer")),
  "P1 fill does not become ready just because the P4 spine finished",
);

console.log("ok — dispatch mark expand contract");
