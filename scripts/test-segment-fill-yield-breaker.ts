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
} from "../lib/llm/pro/delivery/run-segment-chain";

assert.equal(FILL_YIELD_BEFORE_NARRATIVE, 2);
assert.equal(SEGMENT_MIN_INVOKE_MS, 55_000);
assert.equal(SEGMENT_HEAVY_MIN_INVOKE_MS, 150_000);
assert.equal(SCHEMA_WAVE_PACK_MIN_REMAINING_MS, 180_000);
assert.equal(segmentAdmitMinMs("direct_answer"), 40_000);
assert.equal(segmentAdmitMinMs("foundation"), 55_000);
assert.equal(segmentAdmitMinMs("risk_guard"), 150_000);
assert.equal(segmentAdmitMinMs("metaphysics_action"), 150_000);
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("risk_guard"));

const chainSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/run-segment-chain.ts"),
  "utf8",
);
assert.ok(chainSrc.includes("fill_yield_count"));
assert.ok(chainSrc.includes("forced_after_yields"));
assert.ok(chainSrc.includes('thinking_effort: "high"'));
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

const fillSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/fill-call.ts"),
  "utf8",
);
assert.ok(fillSrc.includes("thinking_effort?:"));
assert.ok(fillSrc.includes("input.thinking_effort ?? \"high\""));

console.log("test-segment-fill-yield-breaker: ok");
