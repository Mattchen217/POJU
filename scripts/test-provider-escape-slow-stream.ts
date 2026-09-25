/**
 * Provider escape + slow-stream abort regressions.
 * Run: pnpm exec tsx scripts/test-provider-escape-slow-stream.ts
 */
import assert from "node:assert/strict";
import { isProviderEscapeFailClass } from "@/lib/llm/pro/delivery/dispatch/provider-escape";
import {
  shouldAbortSlowStream,
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

console.log("test-provider-escape-slow-stream: ok", {
  min_elapsed_ms: SLOW_STREAM_MIN_ELAPSED_MS,
  min_chars: SLOW_STREAM_MIN_CONTENT_CHARS,
  min_cps: SLOW_STREAM_MIN_CHARS_PER_SEC,
});
