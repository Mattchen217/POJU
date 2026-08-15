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
      core_logic: "把模糊催促写成赞助必须二选一的书面取舍，用结果权换清边界。",
      why: "因为杠杆还在",
      when: "睡眠回升时",
      leverage_chip: "交付质量账本",
      dims: { body: "中", mind: "高", field: "mid" },
    },
    backup: {
      name: "辅",
      logic: "停掉英雄式接锅，先攒证明与跑道。",
      why: "赞助沉默",
      when: "两盏红灯",
      dims: { body: "low" },
    },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(r.page.page === "direct_answer");
    if (r.page.page === "direct_answer") {
      assert.ok(r.page.core_judgment.length <= 220);
      assert.equal(r.page.primary.dims.mind, "high");
      assert.equal(r.page.primary.dims.body, "mid");
      assert.ok(r.page.primary.core_logic.length > 10);
      assert.equal(r.page.backup.core_logic.includes("英雄"), true);
      assert.equal(r.page.primary.leverage_chip, "交付质量账本");
    }
    assert.equal(r.truncated, true);
  }
  console.log("ok sanitize truncate dims map");
}

// --- sanitize: missing backup → structural ---
{
  const r = sanitizePageJson("direct_answer", {
    core_judgment: "stay",
    primary: { name: "主", core_logic: "打法一段", why: "w", when: "t" },
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.structural, true);
  console.log("ok sanitize structural missing backup");
}

// --- sanitize: missing core_logic → structural ---
{
  const r = sanitizePageJson("direct_answer", {
    core_judgment: "stay",
    primary: { name: "主", why: "w", when: "t" },
    backup: { name: "辅", core_logic: "辅打法", why: "w", when: "t" },
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.reason.includes("missing") || r.structural);
  console.log("ok sanitize structural missing core_logic");
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

// --- P3: 1 means per angle is OK (no invented means≥3 rule) ---
{
  const angle = (name: string) => ({
    name,
    strategy: `${name} strategy body explaining how this dim serves the track goal.`,
    means: [`${name} corresponding action`],
  });
  const r = sanitizePageJson("science_action", {
    primary_toolkit: {
      title: "主",
      angles: [angle("a1"), angle("a2"), angle("a3")],
    },
    backup_toolkit: {
      title: "辅",
      angles: [angle("b1"), angle("b2"), angle("b3")],
    },
  });
  assert.equal(r.ok, true);
  if (r.ok && r.page.page === "science_action") {
    assert.equal(r.page.primary_toolkit.angles[0]!.means.length, 1);
  }
  console.log("ok sanitize P3 means count flexible");
}

// --- P3 angles: legacy single strategy upgrades then fails min(3) ---
{
  const r = sanitizePageJson("science_action", {
    primary_toolkit: {
      title: "主",
      strategy: "边界",
      steps: ["发邮件"],
    },
    backup_toolkit: {
      title: "辅",
      strategy: "退出",
      steps: ["导出"],
    },
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.reason.includes("toolkit") || r.structural);
  console.log("ok sanitize structural angles_lt_3");
}

// --- P3 angles: full multi-dim strategy+means ok ---
{
  const angle = (name: string) => ({
    name,
    strategy: `${name} strategy explaining how this dim lands the track.`,
    exact_script: `${name} optional opening line.`,
    means: [`${name} action`],
    hard_metrics: [`${name} done when X`],
  });
  const r = sanitizePageJson("science_action", {
    primary_toolkit: {
      title: "主轨",
      angles: [angle("a1"), angle("a2"), angle("a3")],
    },
    backup_toolkit: {
      title: "辅轨",
      angles: [angle("b1"), angle("b2"), angle("b3")],
    },
  });
  assert.equal(r.ok, true);
  if (r.ok && r.page.page === "science_action") {
    assert.equal(r.page.primary_toolkit.angles.length, 3);
    assert.ok(r.page.primary_toolkit.angles[0]!.strategy.length > 20);
  }
  console.log("ok sanitize P3 angles>=3 multi-dim");
}

// --- Action Extractor brief ---
{
  const brief = extractP5ActionBrief({
    p1: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.direct_answer!,
    p3: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.science_action!,
    p4: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.metaphysics_action!,
  });
  assert.equal(brief.primary_name, "Renegotiate in place");
  assert.ok(brief.p3_primary_steps.length >= 3);
  assert.ok(brief.p4_primary_means.length >= 1);
  const text = formatP5ActionBriefForPrompt(brief);
  assert.ok(text.includes("P5ActionBrief"));
  assert.ok(text.includes("flattened angles"));
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
    afterB.map((t) => t.paths[0]).sort(),
    ["risk_guard", "signals_close"].sort(),
  );
  assert.ok(!afterB.some((t) => t.paths[0] === "thirty_day"));

  const unlockB = unlockedKeysThroughWave("B");
  assert.ok(unlockB.has("foundation"));
  assert.ok(!unlockB.has("risk_guard"));
  assert.ok(!unlockB.has("thirty_day"));
  const unlockC = unlockedKeysThroughWave("C");
  assert.ok(unlockC.has("signals_close"));
  console.log("ok wave gate");
}

// --- sanitize P6 close requires day7_micro_actions ---
{
  const r = sanitizePageJson("signals_close", {
    identity_before: "before",
    identity_after: "after",
    quote: "quote",
    immediate_action: "tonight draft",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.reason.includes("day7") || r.structural);
  console.log("ok sanitize day7_micro_actions required");
}

// --- page chrome: title/subtitle required (fallback to tag) ---
{
  for (const key of [
    "direct_answer",
    "foundation",
    "science_action",
    "metaphysics_action",
    "risk_guard",
    "signals_close",
  ] as const) {
    const mock = DELIVERY_PAGE_SCHEMA_MOCK_V1.pages[key];
    assert.ok(mock);
    const r = sanitizePageJson(key, mock);
    assert.equal(r.ok, true, `chrome mock ${key}`);
    if (r.ok) {
      assert.ok("page_title" in r.page && r.page.page_title.trim().length > 0);
      assert.ok("page_subtitle" in r.page);
    }
  }
  const bare = sanitizePageJson("direct_answer", {
    core_judgment: "先谈边界再谈冲锋。",
    primary: {
      name: "主",
      core_logic: "把模糊催促写成赞助必须二选一的书面取舍，用结果权换清边界。",
      why: "杠杆还在",
      when: "睡眠回升",
      dims: { body: "mid", mind: "high", field: "mid" },
    },
    backup: {
      name: "辅",
      core_logic: "停掉英雄式接锅，先攒证明与跑道。",
      why: "赞助沉默",
      when: "两盏红灯",
      dims: { body: "low", mind: "mid", field: "low" },
    },
  });
  assert.equal(bare.ok, true);
  if (bare.ok && bare.page.page === "direct_answer") {
    assert.equal(bare.page.page_title, "核心直答");
    assert.equal(bare.page.page_subtitle, "");
  }
  console.log("ok page chrome title/subtitle");
}

console.log("\nAll page-schema tests passed.");
