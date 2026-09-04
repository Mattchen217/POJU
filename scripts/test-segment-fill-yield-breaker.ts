/**
 * Source + constant contracts for delivery fill soft-wall dead-loop breaker.
 * Run: pnpm exec tsx scripts/test-segment-fill-yield-breaker.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import {
  FILL_YIELD_BEFORE_NARRATIVE,
  SEGMENT_HEAVY_FILL_KEYS,
  SEGMENT_HEAVY_MIN_INVOKE_MS,
  SEGMENT_MIN_INVOKE_MS,
  SCHEMA_WAVE_PACK_MIN_REMAINING_MS,
  segmentAdmitMinMs,
  segmentFillThinkingEffort,
} from "../lib/llm/pro/delivery/run-segment-chain";
import { PAGE_SCHEMA_FILL_MAX_TOKENS } from "../lib/llm/pro/delivery/delivery-tasks";

assert.equal(FILL_YIELD_BEFORE_NARRATIVE, 2);
assert.equal(SEGMENT_MIN_INVOKE_MS, 55_000);
assert.equal(SEGMENT_HEAVY_MIN_INVOKE_MS, 120_000);
assert.equal(SCHEMA_WAVE_PACK_MIN_REMAINING_MS, 130_000);
assert.equal(segmentAdmitMinMs("direct_answer"), 40_000);
assert.equal(segmentAdmitMinMs("foundation"), 55_000);
assert.equal(segmentAdmitMinMs("risk_guard"), 120_000);
assert.equal(segmentAdmitMinMs("metaphysics_action"), 120_000);
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("risk_guard"));
assert.equal(segmentFillThinkingEffort("direct_answer"), "medium");
assert.equal(segmentFillThinkingEffort("foundation"), "medium");
assert.equal(segmentFillThinkingEffort("signals_close"), "medium");
assert.equal(segmentFillThinkingEffort("science_action"), "high");
assert.equal(segmentFillThinkingEffort("metaphysics_action"), "high");
assert.equal(segmentFillThinkingEffort("risk_guard"), "high");
assert.ok(PAGE_SCHEMA_FILL_MAX_TOKENS <= 12_000);
assert.ok(PAGE_SCHEMA_FILL_MAX_TOKENS >= 8_000);

const chainSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/run-segment-chain.ts"),
  "utf8",
);
assert.ok(chainSrc.includes("fill_yield_count"));
assert.ok(chainSrc.includes("forced_after_yields"));
assert.ok(chainSrc.includes("segmentFillThinkingEffort(key)"));
assert.ok(!chainSrc.includes('thinking_effort: SEGMENT_HEAVY_FILL_KEYS.has(key) ? "medium"'));
assert.ok(chainSrc.includes("remaining_ms"));
assert.ok(chainSrc.includes("DELIVERY_SEGMENT_MIN_INVOKE_MS"));

const runnerSrc = readFileSync(
  resolve(__dirname, "../lib/poju/final-delivery-stage-runner.ts"),
  "utf8",
);
assert.ok(runnerSrc.includes("segment transport exhausted — interrupt"));
assert.ok(!runnerSrc.includes("segment transport exhausted — handoff reset"));
assert.ok(runnerSrc.includes("fill soft-wall at phase=start"));
assert.ok(runnerSrc.includes("fill_yield_count"));
assert.ok(runnerSrc.includes("pack P1 bootstrap same invoke after finalize"));
assert.ok(runnerSrc.includes("return 55_000"));

const fillSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/fill-call.ts"),
  "utf8",
);
assert.ok(fillSrc.includes("thinking_effort?:"));
assert.ok(fillSrc.includes("input.thinking_effort ?? \"high\""));
assert.ok(fillSrc.includes("PAGE_SCHEMA_FILL_MAX_TOKENS"));
assert.ok(fillSrc.includes("finish_reason=length"));

const routerSrc = readFileSync(resolve(__dirname, "../lib/llm/router.ts"), "utf8");
assert.ok(routerSrc.includes("delivery finish_reason anomalous"));

const finalizeSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/finalize-call.ts"),
  "utf8",
);
assert.ok(finalizeSrc.includes("finish_reason=length"));

console.log("test-segment-fill-yield-breaker: ok");
