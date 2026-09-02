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
import { pageSchemaToArgumentBodies } from "../lib/llm/pro/delivery/page-schema/render";
import { filterTasksToCurrentWave, prioritizeBootstrapSegmentTasks } from "../lib/llm/pro/delivery/page-schema/upstream";
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
    chart_anchors: ["用神·水", "食伤显"],
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
    chart_anchors: ["用神·水", "官杀显"],
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
  assert.ok(Array.isArray(brief.source_anchors));
  const text = formatP5ActionBriefForPrompt(brief);
  assert.ok(text.includes("P5ActionBrief"));
  assert.ok(text.includes("flattened angles"));
  assert.ok(!text.includes('"why_cards"'));
  console.log("ok action extractor brief");
}

// --- P5 risk_guard: one RiskItem = one evidence argument ---
{
  const page = DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.risk_guard!;
  const args = pageSchemaToArgumentBodies(page);
  const expected =
    page.red_lights.length +
    page.traps.length +
    1 +
    page.protection_rules.length;
  assert.equal(args.length, expected, "P5 arguments 1:1 with RiskItems");
  assert.ok(args.every((a) => a.body.includes("###")));
  console.log("ok P5 risk item evidence granularity");
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
    none.map((t) => t.paths[0]).sort(),
    ["direct_answer", "foundation", "metaphysics_action", "science_action"].sort(),
  );

  const bootOnly = prioritizeBootstrapSegmentTasks(none);
  assert.deepEqual(
    bootOnly.map((t) => t.paths[0]),
    ["direct_answer"],
    "bootstrap-first clamps wave to P1 until ready",
  );
  assert.deepEqual(
    prioritizeBootstrapSegmentTasks(all.slice(1)).map((t) => t.paths[0]).sort(),
    all.slice(1).map((t) => t.paths[0]).sort(),
    "no bootstrap → leave gated list unchanged",
  );

  const afterP1 = filterTasksToCurrentWave(all.slice(1), new Set(["direct_answer"]));
  assert.deepEqual(
    afterP1.map((t) => t.paths[0]).sort(),
    ["foundation", "metaphysics_action", "science_action"].sort(),
  );

  const afterContent = filterTasksToCurrentWave(all.slice(4), new Set([
    "direct_answer",
    "foundation",
    "science_action",
    "metaphysics_action",
  ]));
  assert.deepEqual(
    afterContent.map((t) => t.paths[0]).sort(),
    ["risk_guard", "signals_close"].sort(),
  );
  assert.ok(!afterContent.some((t) => t.paths[0] === "thirty_day"));

  const unlockA = unlockedKeysThroughWave("A");
  assert.ok(unlockA.has("foundation"));
  assert.ok(!unlockA.has("risk_guard"));
  assert.ok(!unlockA.has("thirty_day"));
  const unlockB = unlockedKeysThroughWave("B");
  assert.ok(unlockB.has("signals_close"));
  assert.ok(unlockB.has("risk_guard"));
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
        essence:
          "恢复缓冲长期偏薄，高压竞争把神经系统锁在警戒档，休息无法真正降频；这不是意志力差，而是能量底座缺位后的保护性过载，必须先夺回可恢复窗口。",
        chart_anchors: ["用神·水", "身弱见财"],
      },
      {
        title: "卡2",
        surface: "接怕崩、不接怕边缘化。",
        essence:
          "两股相反期待同时压在同一条职业轨道上，判断被外部节奏绑架；不是看不清选项，而是从未把边界写成可协商的交换条件，所以主辅路径才需要同时成立。",
        chart_anchors: ["忌神·火", "官杀显"],
      },
      {
        title: "卡3",
        surface: "深夜消息不断，白天仍要硬撑决策。",
        essence:
          "注意力被碎片化切割，深度恢复窗口被持续打断；长期如此会把判断质量与身体信号一起拖垮，形成越忙越错的负循环，必须先夺回可保护的恢复时段。",
        chart_anchors: ["用神·水"],
      },
      {
        title: "卡4",
        surface: "想独立咨询却恐惧收入不确定。",
        essence:
          "安全感需求与独立路径正面相撞，辅路径因此成立：先保留决策权与可验证成果，再分步释放前线火力，而不是一次性全押把跑道烧穿。",
        chart_anchors: ["用神·水", "官杀显"],
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
          chart_anchors: ["用神·水", "食伤显"],
          exact_script:
            "成本降了X%，差错率Y%。这样比亲征能省下Z%的差旅和决策风险。",
        },
        {
          name: "授权",
          strategy: "书面责权边界，小成果证据链。",
          means: ["书面两行划清你留什么、他扛什么"],
          chart_anchors: ["比劫显", "官杀显"],
        },
        {
          name: "红线",
          strategy: "把睡眠写成项目风险指标。",
          means: ["睡眠不足则改期硬谈"],
          chart_anchors: ["忌神·火", "大运偏耗泄"],
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
          chart_anchors: ["食伤显", "用神·水"],
        },
        {
          name: "缓冲",
          strategy: "现金缓冲闸门。",
          means: ["算两个月生活费目标"],
          chart_anchors: ["财星显", "身弱见财"],
        },
        {
          name: "网络",
          strategy: "暖联系铺垫。",
          means: ["每周更新一位可信联系人"],
          chart_anchors: ["比劫显", "用神·水"],
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

// --- P4: case-anchored dims + gateway name/prose scrub ---
{
  const r = sanitizePageJson("metaphysics_action", {
    page_title: "东方场域杠杆与用神调频",
    page_subtitle: "色/向/时与风水避忌",
    question_anchor: "这份工作还要不要硬扛一线？",
    desired_outcome: "保结果权、降损耗。",
    dimensions: [
      {
        name: "色彩与着装锚定",
        strategy: "按用神补水气，关键场合穿深蓝，避开忌神火场硬冲。",
        means: [
          "关键硬推后固定睡眠与独处降档",
          "冲突先不硬顶再回场",
          "深蓝外层仅作感官偏好",
        ],
        chart_anchors: ["用神·水", "忌神·火"],
      },
      {
        name: "方位与空间朝向",
        strategy: "工位朝高适配侧，是空间效能不是八字报幕。",
        means: [
          "深工时段放在清醒峰，谷段只归档",
          "先说结论再铺细节",
          "高适配侧桌角仅作次要场域偏好",
        ],
        chart_anchors: ["用神·水", "大运补给偏顺"],
      },
    ],
  });
  assert.equal(r.ok, true);
  if (r.ok && r.page.page === "metaphysics_action") {
    assert.ok(!/用神|风水|东方场域|东方维/.test(r.page.page_title), r.page.page_title);
    assert.ok(!/色\s*[\/、]\s*向|风水/.test(r.page.page_subtitle), r.page.page_subtitle);
    assert.equal(r.page.dimensions[0]?.name, "视觉心理 · 权威气场与色彩阻尼");
    assert.equal(r.page.dimensions[1]?.name, "空间心理 · 专注场域与采光阻尼");
    const body = `${r.page.dimensions[0]?.strategy} ${r.page.dimensions[0]?.means.join(" ")}`;
    assert.ok(!/用神|忌神|风水/.test(body), body);
    assert.ok(/关键气场锚|损耗源|空间布局/.test(body), body);
  }
  console.log("ok P4 gateway name+prose scrub");
}

console.log("\nAll page-schema tests passed.");
