/**
 * Smoke: delivery quality layer (dedup / roadmap / scan / gantt week labels).
 * Run: pnpm exec tsx scripts/test-delivery-quality-layer.ts
 */
import assert from "node:assert/strict";
import {
  detectDeliveryDedupIssues,
  softDemoteNurtureRepetition,
} from "../lib/llm/pro/delivery/delivery-dedup";
import {
  buildPageScanCardFromModel,
  buildPageScanCardStruct,
  buildSegmentStructureMarkdown,
  buildThirtyDayGanttFromModel,
  buildThirtyDayGanttStruct,
  buildThreePhaseRoadmapStruct,
  encodePageScanMarkdown,
  encodeThirtyDayGanttMarkdown,
  localizePageScanCardLabels,
  localizeThirtyDayGanttLabels,
  normalizePageScanCardStruct,
  normalizePageScanItems,
  parsePojuStructPayloads,
  stripPojuStructFences,
  stripRenderedStructFallbacks,
} from "../lib/llm/pro/delivery/poju-struct-blocks";
import type { BreakthroughCore } from "../lib/poju/agent-state";
import { attachMetaphysicsPackToBreakthroughCore } from "../lib/poju/attach-metaphysics-pack";

const core = {
  energy_structure: "test",
  situation_conclusion: "先养状态",
  key_crossroads: {
    real_fork: "fork",
    path_costs: "costs",
    decision_traits: "traits",
    structural_basis: "basis",
    needs_validation: "v",
  },
  modern_action_frames: [
    {
      direction: "通过兴趣拓展社交",
      why_fits: "w",
      structural_basis: "b",
      needs_validation: "n",
      status: "hypothesis" as const,
    },
    {
      direction: "建立独处滋养仪式",
      why_fits: "w",
      structural_basis: "b",
      needs_validation: "n",
      status: "hypothesis" as const,
    },
    {
      direction: "渐进式信任练习",
      why_fits: "w",
      structural_basis: "b",
      needs_validation: "n",
      status: "hypothesis" as const,
    },
  ],
  rhythm_frame: {
    phase1_observe: "观察",
    phase2_adjust: "调整",
    phase3_consolidate: "巩固",
    phase4_review: "复盘",
  },
} as unknown as BreakthroughCore;

function testDedup() {
  const md = `## A

把自己活成小森林。
## B

养好自己的根。
## C

宜守不宜攻，向内积累。
## D

先养根再待缘。`;
  const findings = detectDeliveryDedupIssues(md);
  assert.ok(findings.some((f) => f.kind === "nurture_axis" && f.count >= 3));
  const demoted = softDemoteNurtureRepetition(md);
  assert.ok(demoted.length <= md.length);
  console.log("ok dedup");
}

function testRoadmapAndGantt() {
  const roadmap = buildThreePhaseRoadmapStruct(core, "zh");
  assert.equal(roadmap.phases.length, 3);
  assert.ok(roadmap.phases[0]!.current);
  assert.match(roadmap.phases[0]!.window, /1–3/);

  // Code extraction removed.
  assert.equal(buildThirtyDayGanttStruct(core, "zh"), null);

  const gantt = buildThirtyDayGanttFromModel(
    {
      weeks: [
        {
          week: 1,
          phase_label: "第一周：观察能量波动",
          science: ["通过共同兴趣自然拓展社交"],
          alignment: ["推荐方位：正北 / 正西 / 西北"],
        },
        {
          week: 2,
          phase_label: "第二周：低压力社交试探",
          science: ["先建立自我安全感系统"],
          alignment: ["高频时段：夜间 21:00–01:00"],
        },
        {
          week: 3,
          phase_label: "第三周：渐进式信任",
          science: ["在关系中练习渐进式信任"],
          alignment: ["开运色彩/视觉锚点：深蓝、黑色"],
        },
        {
          week: 4,
          phase_label: "第四周：复盘安全情境",
          science: ["回顾哪些情境让你感到安全"],
          alignment: ["协同人群：具备平静与适应力的伙伴"],
        },
      ],
    },
    "zh",
  );
  assert.ok(gantt);
  assert.equal(gantt!.weeks.length, 4);
  assert.equal(gantt!.labels.metaphysics_col, "环境与时区调频");
  assert.notEqual(gantt!.weeks[1]!.phase_label, gantt!.weeks[2]!.phase_label);
  assert.ok(!/朝向适配|精力高频|互补协同|玄学适配/.test(
    gantt!.weeks.map((w) => w.metaphysics.join("")).join(""),
  ));
  const en = localizeThirtyDayGanttLabels(gantt!, "en");
  assert.equal(en.labels.metaphysics_col, "Environmental Alignment");
  console.log("ok roadmap + gantt");
}

function testEnergyBaseStructs() {
  const md = buildSegmentStructureMarkdown("foundation", "zh", core);
  const payloads = parsePojuStructPayloads(md);
  assert.ok(payloads.some((p) => p.kind === "energy_dashboard"));
  assert.ok(payloads.some((p) => p.kind === "three_phase_roadmap"));
  const stripped = stripRenderedStructFallbacks(stripPojuStructFences(md), payloads, "zh");
  assert.ok(!/能量仪表盘/.test(stripped), "dashboard fallback stripped for UI");
  assert.ok(!/三阶段路线图/.test(stripped), "roadmap fallback stripped for UI");

  assert.equal(buildSegmentStructureMarkdown("thirty_day", "zh", core), "");
  const modelGantt = buildThirtyDayGanttFromModel(
    {
      weeks: [1, 2, 3, 4].map((week) => ({
        week,
        phase_label: `第${week}周：节奏推进`,
        science: [`第${week}周可执行动作`],
        alignment: [`推荐方位：正北（周${week}）`],
      })),
    },
    "zh",
  );
  assert.ok(modelGantt);
  const ganttMd = encodeThirtyDayGanttMarkdown(modelGantt!, "zh");
  const ganttPayloads = parsePojuStructPayloads(ganttMd);
  assert.ok(ganttPayloads.some((p) => p.kind === "thirty_day_gantt"));
  const ganttBody = stripRenderedStructFallbacks(
    stripPojuStructFences(ganttMd),
    ganttPayloads,
    "zh",
  );
  assert.ok(!/双轨节奏/.test(ganttBody), "gantt fallback stripped for UI");
  console.log("ok foundation structs");
}

function testScanModel() {
  // Heuristic extraction removed.
  assert.equal(buildPageScanCardStruct("### x\n\nbody", "zh"), null);

  const model = buildPageScanCardFromModel(
    {
      items: [
        { label: "一眼结论", value: "直觉是你的天赋，也是你的盾牌。" },
        { label: "本周动作", value: "试着分辨真正的危险和旧日阴影。" },
        { label: "边界提醒", value: "压力交织时先护住自己的觉察节奏。" },
      ],
    },
    "zh",
  );
  assert.ok(model);
  assert.equal(model!.items.length, 3);
  assert.equal(model!.labels.title, "核心速览");
  assert.ok(!/⟦t:/.test(model!.items.map((i) => i.value).join("")));

  const withMarker = buildPageScanCardFromModel(
    {
      items: [
        { label: "重点", value: "你身上的⟦t:shang_guan|锋锐|那股锋利劲⟧要收一收。" },
        { label: "动作", value: "先把日常过稳。" },
      ],
    },
    "zh",
  );
  assert.ok(withMarker);
  assert.ok(!/⟦|t:shang_guan/.test(withMarker!.items.map((i) => i.value).join("")));

  const legacy = normalizePageScanCardStruct(
    {
      kind: "page_scan_card",
      strategy: "宜守不宜攻",
      homework: "每周去一次读书会。",
      key: "北边放一杯清水。",
      labels: {
        title: "核心速览",
        strategy: "当前策略",
        homework: "核心功课",
        key: "破局钥匙",
      },
    },
    "zh",
  );
  assert.ok(legacy);
  assert.equal(normalizePageScanItems(legacy!).length, 3);

  const md = encodePageScanMarkdown(model!, "zh");
  const parsed = parsePojuStructPayloads(md);
  assert.equal(parsed[0]?.kind, "page_scan_card");
  const localized = localizePageScanCardLabels(parsed[0] as never, "en");
  assert.equal(localized.labels.title, "Key Takeaways");
  console.log("ok scan model", model!.items.map((i) => i.label).join(" / "));
}

function testAttachUpgradeEmpty() {
  const emptyPack = {
    version: "metaphysics_pack_v1" as const,
    generated_at: new Date().toISOString(),
    yong_shen: {
      primary_yong_shen: "water" as const,
      ji_shen: ["fire" as const],
    },
    element_scores: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
    element_scores_source: "empty" as const,
    dashboard: { output_capacity: 0, sustain_capacity: 0, resistance_load: 0 },
    directions: {
      yong_shen: {
        primary_yong_shen: "water" as const,
        ji_shen: ["fire" as const],
      },
      current_hour: {
        branch: "子",
        element: "water" as const,
        period: "23:00-01:00",
      },
      validity: { valid_until: new Date().toISOString(), is_current_zhi_shi: true },
      cells: [],
      preferred: [],
    },
    favorable_hours: [],
    color: {
      element: "water" as const,
      labels_en: [],
      labels_zh: [],
      hex_hints: [],
      usage: "visual_energy_anchor" as const,
    },
    career: {
      element: "water" as const,
      themes_en: [],
      themes_zh: [],
      mechanism_en: [],
      mechanism_zh: [],
      framing: "energy_domain_hint_not_job_title" as const,
    },
    noble: { instances: [], theoretical_slots: [] },
  };

  const emptyCore = {
    ...core,
    metaphysics_pack: emptyPack,
  } as unknown as BreakthroughCore;

  const ba = {
    structured: {
      day_master: "乙木",
      pattern: "p",
      yong_shen: "water",
      xi_shen: ["wood"],
      ji_shen: ["fire"],
      strength: "weak",
      four_pillars: { year: "a", month: "b", day: "c", hour: "d" },
    },
    element_scores_raw: {
      木: { 分值: 20 },
      火: { 分值: 30 },
      土: { 分值: 15 },
      金: { 分值: 10 },
      水: { 分值: 25 },
      日主五行: "木",
    },
  };

  const upgraded = attachMetaphysicsPackToBreakthroughCore(emptyCore, ba);
  assert.equal(upgraded.metaphysics_pack?.element_scores_source, "chart");
  console.log("ok attach upgrade empty→chart", upgraded.metaphysics_pack?.dashboard);
}

testDedup();
testRoadmapAndGantt();
testEnergyBaseStructs();
testScanModel();
testAttachUpgradeEmpty();
console.log("\nAll delivery-quality smoke checks passed.");
