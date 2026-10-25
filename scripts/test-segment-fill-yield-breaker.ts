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

assert.equal(FILL_YIELD_BEFORE_NARRATIVE, 1);
assert.equal(SEGMENT_MIN_INVOKE_MS, 55_000);
assert.equal(SEGMENT_HEAVY_MIN_INVOKE_MS, 270_000);
assert.equal(SCHEMA_WAVE_PACK_MIN_REMAINING_MS, 130_000);
assert.equal(segmentAdmitMinMs("decision_brief"), 40_000);
assert.equal(segmentAdmitMinMs("decision_brief", "evidence_done"), 270_000);
assert.equal(segmentAdmitMinMs("situation_analysis"), 270_000);
assert.equal(segmentAdmitMinMs("situation_analysis", "start"), 270_000);
assert.equal(segmentAdmitMinMs("situation_analysis", "deep_assigned"), 270_000);
assert.equal(segmentAdmitMinMs("situation_analysis", "evidence_done"), 270_000);
assert.equal(segmentAdmitMinMs("situation_analysis", "narrative_done"), 90_000);
assert.equal(segmentAdmitMinMs("validation_risk"), 270_000);
assert.equal(segmentAdmitMinMs("self_regulation"), 270_000);
assert.equal(segmentAdmitMinMs("validation_risk", "deep_assigned"), 270_000);
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("validation_risk"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("decision_brief"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("situation_analysis"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("execution_guidance"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("self_regulation"));
assert.equal(segmentFillThinkingEffort("decision_brief"), "high");
assert.equal(segmentFillThinkingEffort("situation_analysis"), "high");
assert.equal(segmentFillThinkingEffort("validation_close"), "high");
assert.equal(segmentFillThinkingEffort("execution_guidance"), "high");
assert.equal(segmentFillThinkingEffort("self_regulation"), "high");
assert.equal(segmentFillThinkingEffort("validation_risk"), "high");
assert.ok(PAGE_SCHEMA_FILL_MAX_TOKENS <= 20_000);
assert.ok(PAGE_SCHEMA_FILL_MAX_TOKENS >= 12_000);

const chainSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/run-segment-chain.ts"),
  "utf8",
);
assert.ok(chainSrc.includes("fill_yield_count"));
assert.ok(chainSrc.includes("forced_after_yields"));
assert.ok(chainSrc.includes("segmentFillThinkingEffort(key)"));
assert.ok(chainSrc.includes("runDeepEvidenceWritesFromAssignment"));
assert.ok(chainSrc.includes("needs_more_writes"));
assert.ok(chainSrc.includes("deep_assigned"));
assert.ok(chainSrc.includes("defer_rewrite"));
assert.ok(!chainSrc.includes("runDeepEvidenceCall("));
assert.ok(chainSrc.includes("SEGMENT_FILL_MIN_INVOKE_MS"));
assert.ok(chainSrc.includes("SEGMENT_MARK_MIN_INVOKE_MS"));
assert.ok(chainSrc.includes("refuse_narrative_fallback"));
assert.ok(chainSrc.includes("missing_page_schema_refuse_ready"));
assert.ok(chainSrc.includes("refuse narrative fallback (page_schema required)"));
assert.ok(!chainSrc.includes("compress_fill_to_narrative_fallback"));
assert.ok(!chainSrc.includes("runNarrativeTask"));
assert.ok(chainSrc.includes("SEGMENT_HEAVY_MIN_INVOKE_MS"));
assert.ok(chainSrc.includes('fill_mode: hasPlan ? "compress" : "full"'));
assert.ok(!chainSrc.includes('thinking_effort: SEGMENT_HEAVY_FILL_KEYS.has(key) ? "medium"'));
assert.ok(chainSrc.includes("remaining_ms"));
assert.ok(chainSrc.includes("DELIVERY_SEGMENT_MIN_INVOKE_MS"));
assert.ok(chainSrc.includes("p4_refuse_narrative_fallback") || chainSrc.includes("refuse_narrative_fallback"));
// legacy string may remain in comments only — force refuse path
assert.ok(chainSrc.includes("isDeliverySoftWallRetryableFail"));
assert.ok(chainSrc.includes("yield before refuse") || chainSrc.includes("clock-fail — yield before refuse"));

const runnerSrc = readFileSync(
  resolve(__dirname, "../lib/poju/final-delivery-stage-runner.ts"),
  "utf8",
);
assert.ok(runnerSrc.includes("segment transport exhausted — interrupt"));
assert.ok(!runnerSrc.includes("segment transport exhausted — handoff reset"));
assert.ok(runnerSrc.includes("failed-admit soft-wall"));
assert.ok(runnerSrc.includes("fill_yield_count"));
assert.ok(!runnerSrc.includes("pack P1 bootstrap same invoke after finalize"));
assert.ok(runnerSrc.includes("Intentionally no same-invoke pack of segments/P1"));
assert.ok(runnerSrc.includes("return 55_000"));
assert.ok(runnerSrc.includes("soft_hop_count"));
assert.ok(runnerSrc.includes("fail with pages — interrupt (no auto handoff)"));
assert.ok(!runnerSrc.includes("resumable fail with pages — handoff"));

const fillSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/fill-call.ts"),
  "utf8",
);
assert.ok(fillSrc.includes("thinking_effort?:"));
assert.ok(fillSrc.includes("input.thinking_effort ?? \"high\""));
assert.ok(fillSrc.includes("PAGE_SCHEMA_FILL_MAX_TOKENS"));
assert.ok(fillSrc.includes("finish_reason") && fillSrc.includes('"length"'));
assert.ok(fillSrc.includes("fillMode: fill_mode"));
assert.ok(fillSrc.includes("mergeInventoryTokens"));
assert.ok(fillSrc.includes("priorAnchors:"));
assert.ok(fillSrc.includes("inventoryTokens:"));
assert.ok(!fillSrc.includes("compress prose pollution"));
assert.ok(fillSrc.includes("No bonus beyond 1+1"));
assert.ok(!fillSrc.includes("grantLengthBonus"));
assert.ok(!fillSrc.includes("attemptBudget = maxAttempts + 1"));
assert.ok(fillSrc.includes("attemptBudget = 1"));
assert.ok(fillSrc.includes("needs_more_fill_chunks"));
assert.ok(fillSrc.includes("runP4CompressFillOneChunk"));
assert.ok(fillSrc.includes("Quality / structural fail → hard stop"));

const routerSrc = readFileSync(resolve(__dirname, "../lib/llm/router.ts"), "utf8");
assert.ok(routerSrc.includes("delivery finish_reason anomalous"));

const finalizeSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/finalize-call.ts"),
  "utf8",
);
assert.ok(finalizeSrc.includes("finish_reason=length"));

console.log("test-segment-fill-yield-breaker: ok");
