/**
 * Deep-write timeout policy smoke.
 * Run: pnpm exec tsx scripts/test-deep-write-timeout-policy.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS } from "../lib/llm/pro/delivery/delivery-tasks";
import { SEGMENT_DEEP_WRITE_MIN_INVOKE_MS } from "../lib/llm/pro/delivery/run-segment-chain";
import { isDeliverySoftWallRetryableFail } from "../lib/llm/pro/delivery/delivery-retry-policy";

assert.equal(PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS, 200_000);
assert.equal(SEGMENT_DEEP_WRITE_MIN_INVOKE_MS, 200_000);
assert.ok(isDeliverySoftWallRetryableFail("deep_evidence:write_chunk:llm_timeout:chunk1"));
assert.ok(isDeliverySoftWallRetryableFail("deep_evidence:insufficient_budget_for_write"));

const callSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/deep-evidence-call.ts"),
  "utf8",
);
assert.ok(!callSrc.includes("Math.min(input.timeout_ms ?? 100_000, 100_000)"));
assert.ok(callSrc.includes("PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS"));
assert.ok(callSrc.includes("insufficient_budget_for_write"));
assert.ok(callSrc.includes("isTransportFailReason"));

const writeSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/deep-evidence-write.ts"),
  "utf8",
);
assert.ok(writeSrc.includes('lastReason === "llm_timeout"'));
assert.ok(writeSrc.includes("PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS"));

console.log("ok: deep-write timeout policy");
