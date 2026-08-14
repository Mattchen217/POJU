/**
 * Unit tests: page_schema sanitize + Action Extractor + wave gate.
 * Run: pnpm exec tsx scripts/test-delivery-page-schema.ts
 */

import assert from "node:assert/strict";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";
import {
  extractP5ActionBrief,
  formatP5ActionBriefForPrompt,
} from "../lib/llm/pro/delivery/page-schema/action-extractor";
import { filterTasksToCurrentWave } from "../lib/llm/pro/delivery/page-schema/upstream";
import { DELIVERY_PAGE_SCHEMA_MOCK_V1 } from "../lib/llm/pro/delivery/page-schema/mock-fixture";
import { unlockedKeysThroughWave } from "../lib/llm/pro/delivery/page-schema/waves";
import type { DeliverySegmentKey } from "../lib/llm/pro/delivery/delivery-schema";

function task(key: DeliverySegmentKey) {
  return { name: `deliver_${key}`, paths: [key] as const };
}

// --- sanitize: truncate long judgment, no structural fail ---
{
  const long = "判".repeat(400);
  const r = sanitizePageJson("direct_answer", {
    core_judgment: long,
    primary: {
      name: "主",
      why: "因为杠杆还在",
      when: "睡眠回升时",
      dims: { body: "中", mind: "高", field: "mid" },
    },
    backup: { name: "辅", why: "赞助沉默", when: "两盏红灯", dims: { body: "low" } },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(r.page.page === "direct_answer");
    if (r.page.page === "direct_answer") {
      assert.ok(r.page.core_judgment.length <= 220);
      assert.equal(r.page.primary.dims.mind, "high");
      assert.equal(r.page.primary.dims.body, "mid");
    }
    assert.equal(r.truncated, true);
  }
  console.log("ok sanitize truncate dims map");
}

// --- sanitize: missing backup → structural ---
{
  const r = sanitizePageJson("direct_answer", {
    core_judgment: "stay",
    primary: { name: "主", why: "w", when: "t" },
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.structural, true);
  console.log("ok sanitize structural missing backup");
}

// --- mock fixture validates ---
{
  for (const [key, page] of Object.entries(DELIVERY_PAGE_SCHEMA_MOCK_V1.pages)) {
    assert.ok(page);
    const r = sanitizePageJson(key as DeliverySegmentKey, page);
    assert.equal(r.ok, true, `mock ${key} should sanitize ok`);
  }
  console.log("ok mock fixture all pages");
}

// --- Action Extractor brief ---
{
  const brief = extractP5ActionBrief({
    p1: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.direct_answer!,
    p3: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.science_action!,
    p4: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.metaphysics_action!,
  });
  assert.equal(brief.primary_name, "Renegotiate in place");
  assert.ok(brief.p3_primary_steps.length >= 1);
  const text = formatP5ActionBriefForPrompt(brief);
  assert.ok(text.includes("P5ActionBrief"));
  assert.ok(!text.includes('"why_cards"'));
  console.log("ok action extractor brief");
}

// --- wave gate ---
{
  const all = [
    task("direct_answer"),
    task("foundation"),
    task("science_action"),
    task("metaphysics_action"),
    task("thirty_day"),
    task("risk_guard"),
    task("signals_close"),
  ];
  const none = filterTasksToCurrentWave(all, new Set());
  assert.deepEqual(
    none.map((t) => t.paths[0]),
    ["direct_answer"],
  );

  const afterA = filterTasksToCurrentWave(all.slice(1), new Set(["direct_answer"]));
  assert.deepEqual(
    afterA.map((t) => t.paths[0]).sort(),
    ["foundation", "metaphysics_action", "science_action"].sort(),
  );

  const afterB = filterTasksToCurrentWave(all.slice(4), new Set([
    "direct_answer",
    "foundation",
    "science_action",
    "metaphysics_action",
  ]));
  assert.deepEqual(
    afterB.map((t) => t.paths[0]),
    ["thirty_day"],
  );

  const unlockB = unlockedKeysThroughWave("B");
  assert.ok(unlockB.has("foundation"));
  assert.ok(!unlockB.has("thirty_day"));
  console.log("ok wave gate");
}

console.log("\nAll page-schema tests passed.");
