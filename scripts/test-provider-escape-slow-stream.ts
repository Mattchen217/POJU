/**
 * Provider escape + slow-stream abort regressions.
 * Run: pnpm exec tsx scripts/test-provider-escape-slow-stream.ts
 */
import assert from "node:assert/strict";
import {
  isProviderEscapeFailClass,
  isV3LabTransportSupplyFail,
} from "@/lib/llm/pro/delivery/dispatch/provider-escape";
import {
  shouldAbortSlowStream,
  shouldFailSkippedDeliveryReasoning,
  SLOW_STREAM_MIN_ELAPSED_MS,
  SLOW_STREAM_MIN_CONTENT_CHARS,
  SLOW_STREAM_MIN_CHARS_PER_SEC,
} from "@/lib/llm/openrouter-slow-stream";

assert.equal(isProviderEscapeFailClass("write_chunk:llm_timeout"), true);
assert.equal(isProviderEscapeFailClass("slow_throughput"), true);
assert.equal(isProviderEscapeFailClass("write_chunk:slow_throughput"), true);
assert.equal(isProviderEscapeFailClass("midstream_disconnect"), true);
assert.equal(isProviderEscapeFailClass("p4_coach_pm_means"), false);
assert.equal(isProviderEscapeFailClass("parse_fail"), true);
assert.equal(isProviderEscapeFailClass("reasoning_skipped"), true);
assert.equal(isV3LabTransportSupplyFail("reasoning_skipped"), true);
assert.equal(isV3LabTransportSupplyFail("reasoning_loop"), true);

assert.equal(
  shouldAbortSlowStream({
    elapsed_ms: SLOW_STREAM_MIN_ELAPSED_MS - 1,
    content_chars: 500,
  }),
  false,
  "too early",
);
assert.equal(
  shouldAbortSlowStream({
    elapsed_ms: SLOW_STREAM_MIN_ELAPSED_MS,
    content_chars: SLOW_STREAM_MIN_CONTENT_CHARS - 1,
  }),
  false,
  "too little content",
);
assert.equal(
  shouldAbortSlowStream({
    elapsed_ms: 60_000,
    content_chars: 900, // 15 chars/s exactly at floor → not abort (< floor)
  }),
  false,
  "at floor stays",
);
assert.equal(
  shouldAbortSlowStream({
    elapsed_ms: 60_000,
    content_chars: 500, // ~8.3 chars/s < 15
  }),
  true,
  "stalled stream aborts",
);
assert.equal(
  shouldAbortSlowStream({
    elapsed_ms: 258_000,
    content_chars: 2510, // ~9.7 chars/s — the Lab case
  }),
  true,
  "9.7-class stall aborts",
);
assert.ok(SLOW_STREAM_MIN_CHARS_PER_SEC >= 12);

// Segment2 Lab case: ~839 content chars / 60s ≈ 14 cps would abort if content-only;
// with reasoning counted as progress (caller-side), same elapsed stays live.
assert.equal(
  shouldAbortSlowStream({
    elapsed_ms: 60_000,
    content_chars: 839 + 4000, // content + reasoning
  }),
  false,
  "reasoning+content progress must not trip 15cps floor",
);

// #25: high effort + ~47 reasoning tokens + plan-only CoT → supply fail.
assert.equal(
  shouldFailSkippedDeliveryReasoning({
    effort: "high",
    reasoning_tokens: 47,
    reasoning_text:
      "我们按要求一步步来。先读懂每条body和evidence，然后在推理里写草稿，自检，最后输出JSON。",
    require_bookmark_draft: true,
  }),
  true,
  "skipped CoT must fail",
);
assert.equal(
  shouldFailSkippedDeliveryReasoning({
    effort: "high",
    reasoning_tokens: 2455,
    reasoning_text: "草稿：⟦w:大运壬午⟧这一环，⟦w:壬水⟧会消耗⟦w:用神金⟧。自检：输入15个书签 / 草稿15个书签。",
    require_bookmark_draft: true,
  }),
  false,
  "healthy high CoT with bookmark draft passes",
);
assert.equal(
  shouldFailSkippedDeliveryReasoning({
    effort: "medium",
    reasoning_tokens: 20,
    reasoning_text: "short",
    require_bookmark_draft: true,
  }),
  false,
  "medium effort has no skip floor",
);
// Long CoT that never drafts bookmarks → fail.
assert.equal(
  shouldFailSkippedDeliveryReasoning({
    effort: "high",
    reasoning_tokens: 500,
    reasoning_text: "a".repeat(400) + "先写草稿再自检再输出JSON，但实际没写书签。",
    require_bookmark_draft: true,
  }),
  true,
  "plan-only long CoT without ⟦w: fails",
);

console.log("test-provider-escape-slow-stream: ok", {
  min_elapsed_ms: SLOW_STREAM_MIN_ELAPSED_MS,
  min_chars: SLOW_STREAM_MIN_CONTENT_CHARS,
  min_cps: SLOW_STREAM_MIN_CHARS_PER_SEC,
});
