/**
 * Effort-downgrade observability wiring (static smoke).
 * Run: pnpm exec tsx scripts/test-effort-downgrade-observability.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyEffortDowngradeReason,
  logEffortDowngrade,
  type EffortDowngradeEvent,
} from "../lib/llm/pro/delivery/effort-downgrade-log";

// --- helper API ---
{
  const events: EffortDowngradeEvent[] = [];
  const orig = console.warn;
  console.warn = ((...args: unknown[]) => {
    if (args[0] === "[delivery/effort-downgrade]" && args[1] && typeof args[1] === "object") {
      events.push(args[1] as EffortDowngradeEvent);
    }
  }) as typeof console.warn;
  try {
    logEffortDowngrade({
      call_site: "deep_evidence",
      key: "risk_guard",
      from_effort: "xhigh",
      to_effort: "high",
      reason: "timeout",
      attempt: 1,
      elapsed_ms: 180_000,
      timeout_ms_used: 200_000,
    });
  } finally {
    console.warn = orig;
  }
  assert.equal(events.length, 1);
  assert.equal(events[0]!.call_site, "deep_evidence");
  assert.ok(
    String((events[0] as EffortDowngradeEvent & { summary?: string }).summary).includes(
      "xhigh → high",
    ),
  );
}

assert.equal(classifyEffortDowngradeReason(new Error("Request timeout")), "timeout");
assert.equal(classifyEffortDowngradeReason(Object.assign(new Error("x"), { name: "AbortError" })), "abort");
assert.equal(classifyEffortDowngradeReason(new Error("parse blew up")), "llm_error");

const logSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/effort-downgrade-log.ts"),
  "utf8",
);
assert.ok(logSrc.includes("[delivery/effort-downgrade]"));

const deepSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/deep-evidence-call.ts"),
  "utf8",
);
assert.ok(deepSrc.includes('call_site: "deep_evidence"'));
assert.ok(deepSrc.includes('currentEffort: "xhigh" | "high" = "xhigh"'));
assert.ok(deepSrc.includes("logEffortDowngrade"));
assert.ok(deepSrc.includes("thinking_effort: currentEffort"));

const chainSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/run-segment-chain.ts"),
  "utf8",
);
assert.ok(chainSrc.includes('call_site: "deep_evidence_to_full_fill"'));
assert.ok(chainSrc.includes('to_effort: "full_fill_fallback"'));
assert.ok(chainSrc.includes('call_site: "compress_fill_to_narrative_fallback"'));
assert.ok(chainSrc.includes("logEffortDowngrade"));

const xhighSrc = readFileSync(
  resolve(__dirname, "../lib/poju/xhigh-job-runner.ts"),
  "utf8",
);
assert.ok(xhighSrc.includes('call_site: "segment2_multi_dim"'));
assert.ok(xhighSrc.includes("logEffortDowngrade"));
assert.ok(xhighSrc.includes('runOnce("high"'));

console.log("ok: effort-downgrade observability wiring");
