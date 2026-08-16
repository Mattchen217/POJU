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

// --- sanitize P6 close requires day7_micro_actions (≥4) ---
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

// --- sanitize P6 close: string day7 wide-in + thicken fields ---
{
  const r = sanitizePageJson("signals_close", {
    identity_before: "一线救火者",
    identity_after: "守决策的操盘手",
    quote: "清晰是善意。",
    immediate_action: "今晚写半页分工。",
    day7_micro_actions: [
      "守睡眠",
      "书面授权两点",
      "约老板窗口",
      "起草三要点",
    ],
  });
  assert.equal(r.ok, true, "legacy string day7 upgrades");
  if (r.ok && r.page.page === "signals_close") {
    assert.equal(r.page.day7_micro_actions.length, 4);
    assert.ok(r.page.day7_micro_actions[0]!.action.includes("睡眠"));
    assert.ok(r.page.day7_micro_actions[0]!.why.length > 0);
    assert.ok(r.page.identity_shift.length > 0);
    assert.ok(r.page.quote_use.length > 0);
    assert.ok(r.page.tonight_done_looks_like.length > 0);
    assert.ok(r.page.tonight_why.length > 0);
    assert.equal(r.page.takeaways.length, 3);
  }
  const thin = sanitizePageJson("signals_close", {
    identity_before: "a",
    identity_after: "b",
    quote: "c",
    immediate_action: "d",
    day7_micro_actions: ["one", "two", "three"],
  });
  assert.equal(thin.ok, false);
  if (!thin.ok) assert.ok(thin.reason.includes("day7") || thin.structural);
  console.log("ok sanitize P6 thicken + day7 object upgrade");
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

// --- sanitize: fake dashboard 0 · 来自仪表盘 → null ---
{
  const r = sanitizePageJson("foundation", {
    page_title: "结构卡点",
    page_subtitle: "剥表象",
    dashboard: [
      { key: "body", label: "身体负荷", score: 0, note: "来自仪表盘" },
      { key: "mind", label: "续航心力", score: 0, note: "来自仪表盘" },
      { key: "field", label: "外部阻力", score: 42, note: "来自 pack" },
    ],
    why_cards: [
      {
        title: "卡1",
        surface: "每晚睡不足四小时，身体持续报警。",
        essence: "恢复缓冲太薄，高压态难降档。",
      },
      {
        title: "卡2",
        surface: "接怕崩、不接怕边缘化。",
        essence: "两股力夹住判断，不是看不清选项。",
      },
    ],
  });
  assert.equal(r.ok, true);
  if (r.ok && r.page.page === "foundation") {
    assert.equal(r.page.dashboard[0]?.score, null);
    assert.equal(r.page.dashboard[1]?.score, null);
    assert.equal(r.page.dashboard[2]?.score, 42);
    assert.ok(r.notes.some((n) => n.includes("null_fake_dashboard")));
  }
  console.log("ok sanitize null fake dashboard zero");
}

// --- sanitize: scrub English prompt leaks + X% placeholders ---
{
  const r = sanitizePageJson("science_action", {
    opening: "Lead with risk and cost, not health complaints.",
    alert: "Do not write a full legal script here — openings only.",
    primary_toolkit: {
      title: "主",
      angles: [
        {
          name: "谈判",
          strategy: "用成本与差错对比开口，不谈苦处。",
          means: ["整理两组差旅与差错对照"],
          exact_script:
            "成本降了X%，差错率Y%。这样比亲征能省下Z%的差旅和决策风险。",
        },
        {
          name: "授权",
          strategy: "书面责权边界，小成果证据链。",
          means: ["书面两行划清你留什么、他扛什么"],
        },
        {
          name: "红线",
          strategy: "把睡眠写成项目风险指标。",
          means: ["睡眠不足则改期硬谈"],
        },
      ],
    },
    backup_toolkit: {
      title: "辅",
      angles: [
        {
          name: "资产化",
          strategy: "经验沉淀成可移交手册。",
          means: ["整理决策框架一页"],
        },
        {
          name: "缓冲",
          strategy: "现金缓冲闸门。",
          means: ["算两个月生活费目标"],
        },
        {
          name: "网络",
          strategy: "暖联系铺垫。",
          means: ["每周更新一位可信联系人"],
        },
      ],
    },
  });
  assert.equal(r.ok, true);
  if (r.ok && r.page.page === "science_action") {
    assert.equal(r.page.opening, undefined);
    assert.equal(r.page.alert, undefined);
    const means0 = r.page.primary_toolkit.angles[0]?.means ?? [];
    const joined = means0.join(" ");
    assert.ok(!/X%|Y%|Z%/.test(joined), joined);
    assert.ok(/填实测|实测口径|可复述/.test(joined), joined);
    assert.equal(r.page.primary_toolkit.angles[0]?.exact_script, undefined);
  }
  console.log("ok sanitize scrub prompt leaks");
}

console.log("\nAll page-schema tests passed.");
