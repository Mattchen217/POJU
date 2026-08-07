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
  buildPageScanCardStruct,
  buildSegmentStructureMarkdown,
  buildThirtyDayGanttStruct,
  buildThreePhaseRoadmapStruct,
  parsePojuStructPayloads,
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
  energy_retune_frame: {
    direction_fit: "d",
    timing_ripeness: "t",
    daily_retune: "r",
    complementary: "c",
    structural_basis: "b",
    needs_validation: "n",
    status: "hypothesis" as const,
  },
  rhythm_frame: {
    phase1_observe: "第一周观察防备心",
    phase2_adjust: "第二三周低压力社交",
    phase3_consolidate: "第四周复盘巩固",
  },
  self_check_signals: ["正向：放松"],
} as BreakthroughCore;

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

  const gantt = buildThirtyDayGanttStruct(core, "zh");
  assert.equal(gantt.weeks.length, 4);
  assert.notEqual(gantt.weeks[1]!.phase_label, gantt.weeks[2]!.phase_label);
  assert.ok(!/待补/.test(gantt.weeks.map((w) => w.science.join("")).join("")));
  console.log("ok roadmap + gantt");
}

function testEnergyBaseStructs() {
  const md = buildSegmentStructureMarkdown("energy_base", "zh", core);
  const payloads = parsePojuStructPayloads(md);
  assert.ok(payloads.some((p) => p.kind === "energy_dashboard"));
  assert.ok(payloads.some((p) => p.kind === "three_phase_roadmap"));
  console.log("ok energy_base structs");
}

function testScan() {
  const scan = buildPageScanCardStruct(
    "### 宜守不宜攻\n\n先把生活过扎实。每周去一次读书会。北边放一杯清水。",
    "zh",
  );
  assert.ok(scan.strategy.length > 0);
  assert.equal(scan.kind, "page_scan_card");
  console.log("ok scan", scan.strategy, "|", scan.homework);
}

function testAttachUpgradeEmpty() {
  const emptyCore = {
    ...core,
    metaphysics_pack: {
      version: "metaphysics_pack_v1" as const,
      generated_at: new Date().toISOString(),
      yong_shen: {
        primary_yong_shen: "water" as const,
        ji_shen: ["fire" as const],
        xi_shen: [] as const[],
      },
      element_scores: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
      element_scores_source: "empty" as const,
      dashboard: { output_capacity: 0, sustain_capacity: 0, resistance_load: 0 },
      directions: {
        yong_shen: { primary_yong_shen: "water" as const, ji_shen: ["fire" as const] },
        current_hour: "子",
        validity: "hour",
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
        framing: "domain_affinity_not_job_title" as const,
      },
      noble: { instances: [], theoretical_slots: [] },
    },
  } as BreakthroughCore;

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
  assert.ok((upgraded.metaphysics_pack?.dashboard.sustain_capacity ?? 0) > 0);
  console.log("ok attach upgrade empty→chart", upgraded.metaphysics_pack?.dashboard);
}

function main() {
  testDedup();
  testRoadmapAndGantt();
  testEnergyBaseStructs();
  testScan();
  testAttachUpgradeEmpty();
  console.log("\nAll delivery-quality smoke checks passed.");
}

main();
