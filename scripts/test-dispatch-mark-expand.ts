/**
 * Contract: fill → expandDagAfterFill fans mark.cN + mark.merge + ready.
 * Run: pnpm exec tsx scripts/test-dispatch-mark-expand.ts
 */
import assert from "node:assert/strict";
import {
  buildInitialDeliveryDispatchDag,
  expandDagAfterFill,
  pageFillId,
  pageMarkChunkId,
  pageMarkMergeId,
  pageReadyId,
  listReadyTaskIds,
} from "@/lib/llm/pro/delivery/dispatch/task-dag";

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

console.log("ok — dispatch mark expand contract");
