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

/** Thick dual-track core_logic for P1 sanitize tests (must pass thickness gate ≥240 + ≥2 paras). */
const P1_PRIMARY_LOGIC =
  "你缺的不是再一轮硬扛，而是把结果权与一线救火拆开。主轨上你守住结果席：风险闸口、交付质量、只有你能撬开的节点；可训练的副手承接体力冲锋。对赞助方你仍是能逼出结果的人，但睡眠与血压不再无限补贴范围蔓延。把模糊催促写成赞助必须二选一的书面取舍——保 A 延 B，或保 B 砍 A——让边界可见、可谈、可留痕。\n\n半年窗口里，证明不是你还能扛一切，而是远程指挥加授权冲锋仍能交付。成功样貌：他们仍为结果来找你，但火线不再默认占你日历，睡眠底线守得住。这条路成立，是因为本案结构里结果权仍握在你手里，删掉这条承重锚，主轨就只剩口号。";

const P1_BACKUP_LOGIC =
  "当远程指挥谈不下来，或身体连亮红灯，就暂停主轨，走有尊严的止损：收缩范围或转入顾问席，保留话语权却卸下火线债。先冻结英雄式接锅——不再用加班证明忠诚——再安静攒战绩夹与现金缓冲，目标必须来自本案收集事实，让下一站落地而不是裸退。\n\n这不是失败叙事；它把不可或缺从体力证明，转成可带走的证据。成功样貌：火线压力离开你，睡眠与血压进入恢复，你带着有日期的证明离开或转岗，而不是被默默抽干。切换两周内做完交接清单与缓冲进度复核，避免滑回另一轮硬扛。删掉忌神与红灯承重，辅轨就变成空喊止损。";

// --- sanitize: truncate long judgment, no structural fail ---
{
  const long = "判".repeat(400);
  const r = sanitizePageJson("direct_answer", {
    page_title: "先谈边界再谈冲锋",
    page_subtitle: "主轨攻坚 vs 辅轨止损",
    core_judgment: long,
    primary: {
      name: "在位重谈边界",
      core_logic: P1_PRIMARY_LOGIC,
      why: "因为杠杆还在",
      when: "睡眠回升时",
      chart_anchors: ["用神·水"],
      leverage_chip: "交付质量账本",
      dims: { body: "中", mind: "高", field: "mid" },
    },
    backup: {
      name: "安静止损准备",
      logic: P1_BACKUP_LOGIC,
      why: "赞助沉默",
      when: "两盏红灯",
      chart_anchors: ["忌神·火"],
      dims: { body: "low" },
    },
  });
  assert.equal(r.ok, true, r.ok ? "" : r.reason);
  if (r.ok) {
    assert.ok(r.page.page === "direct_answer");
    if (r.page.page === "direct_answer") {
      assert.ok(r.page.core_judgment.length <= 220);
      assert.equal(r.page.primary.dims.mind, "high");
      assert.equal(r.page.primary.dims.body, "mid");
      assert.ok(r.page.primary.core_logic.length >= 240);
      assert.equal(r.page.backup.core_logic.includes("英雄"), true);
      assert.equal(r.page.primary.leverage_chip, "交付质量账本");
    }
    assert.equal(r.truncated, true);
  }
  console.log("ok sanitize truncate dims map");
}

// --- P1 quality gates: thin / placeholder / empty anchors refuse ---
{
  const thin = sanitizePageJson("direct_answer", {
    page_title: "先谈边界再谈冲锋",
    page_subtitle: "主轨攻坚 vs 辅轨止损",
    core_judgment: "先谈边界。",
    primary: {
      name: "在位重谈边界",
      core_logic: "一两句电报不够厚。",
      why: "杠杆还在",
      when: "睡眠回升",
      chart_anchors: ["用神·水"],
    },
    backup: {
      name: "安静止损准备",
      core_logic: P1_BACKUP_LOGIC,
      why: "赞助沉默",
      when: "两盏红灯",
      chart_anchors: ["忌神·火"],
    },
  });
  assert.equal(thin.ok, false);
  if (!thin.ok) assert.equal(thin.reason, "p1_core_logic_too_thin");

  const dash = sanitizePageJson("direct_answer", {
    page_title: "先谈边界再谈冲锋",
    page_subtitle: "主轨攻坚 vs 辅轨止损",
    core_judgment: "先谈边界。",
    primary: {
      name: "Primary path",
      core_logic: P1_PRIMARY_LOGIC,
      why: "—",
      when: "—",
      chart_anchors: ["用神·水"],
    },
    backup: {
      name: "安静止损准备",
      core_logic: P1_BACKUP_LOGIC,
      why: "赞助沉默",
      when: "两盏红灯",
      chart_anchors: ["忌神·火"],
    },
  });
  assert.equal(dash.ok, false);
  if (!dash.ok) assert.equal(dash.reason, "p1_track_placeholder");

  const noAnchor = sanitizePageJson("direct_answer", {
    page_title: "先谈边界再谈冲锋",
    page_subtitle: "主轨攻坚 vs 辅轨止损",
    core_judgment: "先谈边界。",
    primary: {
      name: "在位重谈边界",
      core_logic: P1_PRIMARY_LOGIC,
      why: "杠杆还在",
      when: "睡眠回升",
      chart_anchors: [],
    },
    backup: {
      name: "安静止损准备",
      core_logic: P1_BACKUP_LOGIC,
      why: "赞助沉默",
      when: "两盏红灯",
      chart_anchors: ["忌神·火"],
    },
  });
  assert.equal(noAnchor.ok, false);
  if (!noAnchor.ok) assert.equal(noAnchor.reason, "p1_missing_chart_anchors");
  console.log("ok P1 quality gates refuse thin/placeholder/empty-anchor");
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
    page_title: "科学杠杆工具箱",
    page_subtitle: "主轨手段 vs 辅轨止损",
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
    page_title: "科学杠杆工具箱",
    page_subtitle: "主轨手段 vs 辅轨止损",
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

  // P5/P6 unlock without waiting on P2 foundation (ActionBrief deps only).
  const withoutP2 = filterTasksToCurrentWave(all.slice(4), new Set([
    "direct_answer",
    "science_action",
    "metaphysics_action",
  ]));
  assert.deepEqual(
    withoutP2.map((t) => t.paths[0]).sort(),
    ["risk_guard", "signals_close"].sort(),
    "Wave B does not wait on foundation",
  );
  // P1+P3 unlock Wave B even without P4 (fuse feed can brake on P3 alone).
  const withoutP4 = filterTasksToCurrentWave(all.slice(4), new Set([
    "direct_answer",
    "foundation",
    "science_action",
  ]));
  assert.deepEqual(
    withoutP4.map((t) => t.paths[0]).sort(),
    ["risk_guard", "signals_close"].sort(),
    "Wave B unlocks without P4",
  );
  const stillBlocked = filterTasksToCurrentWave(all.slice(4), new Set([
    "direct_answer",
    "foundation",
  ]));
  assert.deepEqual(stillBlocked.map((t) => t.paths[0]), [], "missing P3 still blocks Wave B");

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
  if (!r.ok) assert.ok(r.reason.includes("day7") || r.reason.includes("identity") || r.structural);
  console.log("ok sanitize day7_micro_actions required");
}

// --- sanitize P6 close: full fields required (no soft thicken / string invent) ---
{
  const full = sanitizePageJson("signals_close", {
    page_title: "出门仪式与近阶清单",
    page_subtitle: "身份切换 · 今晚闭环 · 近7日",
    identity_before: "一线救火者",
    identity_after: "守决策的操盘手",
    identity_shift: "主路径要守决策权，一线硬扛只会烧掉睡眠与边界。",
    identity_shift_anchors: ["正印"],
    quote: "清晰是善意。",
    quote_use: "摇摆想退回旧角色时，默念这句，再看今晚那一件事。",
    immediate_action: "今晚写半页分工。",
    tonight_done_looks_like: "半页可出示的分工草稿。",
    tonight_why: "拖过今晚会退回一线硬扛。",
    tonight_anchors: ["食伤"],
    day7_micro_actions: [
      { action: "守睡眠", why: "恢复续航", done_when: "连续三晚≥6h", chart_anchors: ["正印"] },
      { action: "书面授权两点", why: "放执行", done_when: "邮件已发", chart_anchors: ["官杀"] },
      { action: "约老板窗口", why: "对齐优先级", done_when: "日历有槽", chart_anchors: ["正印"] },
      { action: "起草三要点", why: "决策可出示", done_when: "三要点文档", chart_anchors: ["食伤"] },
    ],
    takeaways: ["守决策不硬扛", "本周只推进可勾选近阶", "红灯切辅"],
  });
  assert.equal(full.ok, true, "full P6 close passes");
  if (full.ok && full.page.page === "signals_close") {
    assert.equal(full.page.day7_micro_actions.length, 4);
    assert.ok(full.page.day7_micro_actions[0]!.action.includes("睡眠"));
    assert.ok(full.page.identity_shift.length > 0);
  }

  const stringOnly = sanitizePageJson("signals_close", {
    page_title: "出门仪式与近阶清单",
    page_subtitle: "身份切换 · 今晚闭环 · 近7日",
    identity_before: "一线救火者",
    identity_after: "守决策的操盘手",
    identity_shift: "为何切换成立。",
    quote: "清晰是善意。",
    quote_use: "摇摆时默念。",
    immediate_action: "今晚写半页分工。",
    tonight_done_looks_like: "半页草稿。",
    tonight_why: "拖过今晚会回旧惯性。",
    day7_micro_actions: ["守睡眠", "书面授权两点", "约老板窗口", "起草三要点"],
    takeaways: ["决策", "杠杆", "熔断"],
  });
  assert.equal(stringOnly.ok, false, "plain string day7 no longer soft-upgraded");
  if (!stringOnly.ok) {
    assert.ok(
      stringOnly.reason === "day7_item_incomplete" ||
        stringOnly.reason.includes("day7") ||
        stringOnly.structural,
    );
  }

  const thin = sanitizePageJson("signals_close", {
    identity_before: "a",
    identity_after: "b",
    quote: "c",
    immediate_action: "d",
    day7_micro_actions: ["one", "two", "three"],
  });
  assert.equal(thin.ok, false);
  if (!thin.ok) assert.ok(thin.reason.includes("day7") || thin.reason.includes("identity") || thin.structural);
  console.log("ok sanitize P6 full fields + refuse soft invent");
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
      name: "在位重谈边界",
      core_logic: P1_PRIMARY_LOGIC,
      why: "杠杆还在",
      when: "睡眠回升",
      chart_anchors: ["用神·水"],
      dims: { body: "mid", mind: "high", field: "mid" },
    },
    backup: {
      name: "安静止损准备",
      core_logic: P1_BACKUP_LOGIC,
      why: "赞助沉默",
      when: "两盏红灯",
      chart_anchors: ["忌神·火"],
      dims: { body: "low", mind: "mid", field: "low" },
    },
  });
  // No tag fallback — missing chrome is structural (refuse, not degrade).
  assert.equal(bare.ok, false);
  if (!bare.ok) {
    assert.ok(
      bare.reason === "missing_page_title" || bare.reason === "missing_page_subtitle",
      bare.reason,
    );
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
    page_title: "科学杠杆工具箱",
    page_subtitle: "主轨手段 vs 辅轨止损",
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
