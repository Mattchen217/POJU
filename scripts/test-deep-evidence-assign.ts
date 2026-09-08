/**
 * Unit tests: deep-evidence assign distribution + binding parse + compress dump (no LLM).
 * Run: pnpm exec tsx scripts/test-deep-evidence-assign.ts
 */
import assert from "node:assert/strict";
import {
  anchorsServeMoatClass,
  applyPreferBindingLocks,
  chunkPaths,
  distributeP4MoatTargets,
  parseAssignPathHintsFromFeed,
  parseDeepEvidenceAssignment,
  planDeepEvidenceSlots,
  resolveDeepEvidenceUnitCount,
  seedPlannedBindings,
  validateAssignmentAnchorDiversity,
  validateAssignmentMoatAnchors,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import {
  buildScienceAssignPathHints,
  buildScienceMeansFeedBlock,
} from "../lib/llm/pro/delivery/science-means-feed";
import {
  buildFoundationAssignPathHints,
  buildFoundationSurfaceFeedBlock,
  collectFoundationSurfaceCandidates,
} from "../lib/llm/pro/delivery/foundation-surface-feed";
import { buildMetaphysicsMoatFeedBlock } from "../lib/llm/pro/delivery/metaphysics-moat-feed";
import { buildRiskFuseFeedBlock } from "../lib/llm/pro/delivery/risk-fuse-feed";
import { buildCloseRitualFeedBlock } from "../lib/llm/pro/delivery/close-ritual-feed";
import { formatDeepEvidencePlanForCompress } from "../lib/llm/pro/delivery/page-schema/deep-evidence-call";
import {
  DEEP_EVIDENCE_ANCHOR_JACCARD_MAX,
  maxAssignmentAnchorJaccard,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import type { BreakthroughCore } from "../lib/poju/agent-state";
import type { CategoryTokenSets } from "../lib/llm/pro/delivery/page-schema/anchor-category-tally";
import type { P5ActionBrief } from "../lib/llm/pro/delivery/page-schema/types";

{
  const targets = distributeP4MoatTargets(new Set(["polarity", "archetype"]), 4);
  assert.equal(targets.length, 4);
  assert.ok(targets.includes("polarity"));
  assert.ok(targets.includes("archetype"));
  assert.equal(targets[0], "polarity");
  assert.equal(targets[1], "archetype");
}

{
  const n = resolveDeepEvidenceUnitCount("metaphysics_action", 2);
  assert.ok(n >= 3 && n <= 6);
  const planned = planDeepEvidenceSlots(
    "metaphysics_action",
    "yong: 水\npack_polarity: yong=水 ji=火\ncurrent_da_yun_cycle: 甲子\ntiming_ripeness: 中\n【十神语义】正印",
  );
  assert.ok(planned.length >= 2);
  const moats = new Set(planned.map((p) => p.moat_class).filter(Boolean));
  assert.ok(moats.size >= 1, "at least one moat assigned");
}

{
  const p5 = planDeepEvidenceSlots("risk_guard");
  assert.equal(p5.length, 6);
  assert.equal(p5[0]!.path, "red_lights[0]");
  assert.equal(p5[3]!.path, "switch_to_backup");
}

{
  const chunks = chunkPaths([1, 2, 3, 4, 5, 6], 2);
  assert.deepEqual(chunks, [
    [1, 2],
    [3, 4],
    [5, 6],
  ]);
}

{
  const planned = [
    { path: "dimensions[0]", moat_class: "polarity" as const },
    { path: "dimensions[1]", moat_class: "archetype" as const },
  ];
  // Missing binding fields → null
  assert.equal(
    parseDeepEvidenceAssignment(
      "metaphysics_action",
      {
        page: "metaphysics_action",
        units: [
          { path: "dimensions[0]", chart_anchors: ["用神"] },
          { path: "dimensions[1]", chart_anchors: ["正印"] },
        ],
      },
      planned,
    ),
    null,
  );

  const parsed = parseDeepEvidenceAssignment(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      units: [
        {
          path: "dimensions[0]",
          chart_anchors: ["用神水", "身弱"],
          calc_cite: "用神属水，身弱见官杀耗泄",
          means_candidate_ref: "极性候选1",
          unit_claim: "须以用水补泻稳住职场高压，而非硬扛",
        },
        {
          path: "dimensions[1]",
          chart_anchors: ["正印"],
          calc_cite: "正印为用，托底可守",
          means_candidate_ref: "角色候选1",
          unit_claim: "正印角色是本案可借的托底位",
        },
      ],
    },
    planned,
  );
  assert.ok(parsed);
  assert.equal(parsed!.units[0]!.moat_class, "polarity");
  assert.equal(parsed!.units[0]!.calc_cite.includes("用神"), true);
  assert.equal(parsed!.units[1]!.chart_anchors[0], "正印");
  assert.equal(parsed!.units[1]!.means_candidate_ref, "角色候选1");
  assert.equal(validateAssignmentMoatAnchors(parsed!), null);
}

{
  const planned = [
    { path: "dimensions[0]", moat_class: "polarity" as const },
    { path: "dimensions[1]", moat_class: "timing" as const },
  ];
  const bad = parseDeepEvidenceAssignment(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      units: [
        {
          path: "dimensions[0]",
          chart_anchors: ["用神水"],
          calc_cite: "用神水补身",
          means_candidate_ref: "极性候选1",
          unit_claim: "补水稳住消耗",
        },
        {
          path: "dimensions[1]",
          chart_anchors: ["食神", "用神水"],
          calc_cite: "食神出路需水平衡",
          means_candidate_ref: "时机候选1",
          unit_claim: "表达窗口须等水势",
        },
      ],
    },
    planned,
  );
  assert.ok(bad);
  assert.equal(anchorsServeMoatClass(["食神", "用神水"], "timing"), false);
  assert.equal(anchorsServeMoatClass(["大运", "食神"], "timing"), true);
  assert.equal(
    validateAssignmentMoatAnchors(bad!),
    "moat_anchor_mismatch:dimensions[1]:timing",
  );
  const good = parseDeepEvidenceAssignment(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      units: [
        {
          path: "dimensions[0]",
          chart_anchors: ["用神水", "身弱"],
          calc_cite: "身弱需用水补",
          means_candidate_ref: "极性候选1",
          unit_claim: "补水稳住身弱耗泄",
        },
        {
          path: "dimensions[1]",
          chart_anchors: ["大运", "气候交织"],
          calc_cite: "大运丁酉气候交织，金局加强",
          means_candidate_ref: "时机候选2",
          unit_claim: "大运窗口宜攻守切换而非硬冲",
        },
      ],
    },
    planned,
  );
  assert.ok(good);
  assert.equal(validateAssignmentMoatAnchors(good!), null);
}

{
  const dump = formatDeepEvidencePlanForCompress({
    page: "metaphysics_action",
    units: [
      {
        path: "dimensions[0]",
        chart_anchors: ["用神"],
        evidence: "⟦w:用神⟧ 补泄机制。第二句落到本案题。",
        moat_class: "polarity",
        calc_cite: "用神属水",
        means_candidate_ref: "极性候选1",
        unit_claim: "须补水稳住高压",
        mechanism_tag: "approach_avoid",
      },
      {
        path: "dimensions[1]",
        chart_anchors: ["正印"],
        evidence: "⟦w:正印⟧ 角色定位。第二句落到本案题。",
        moat_class: "archetype",
        calc_cite: "正印为用",
        means_candidate_ref: "角色候选1",
        unit_claim: "正印是托底角色",
        mechanism_tag: "role_stance",
      },
    ],
  });
  assert.ok(dump.includes("moat_class=polarity"), "compress dump polarity lock");
  assert.ok(dump.includes("moat_class=archetype"), "compress dump archetype lock");
  assert.ok(dump.includes('type="archetype"'), "compress dump means type hint");
  assert.ok(dump.includes("绑定摘要"), "compress dump binding digest");
  assert.ok(dump.includes("unit_claim"), "compress dump unit_claim");
  assert.ok(dump.includes("means_candidate_ref"), "compress dump candidate ref");
  assert.ok(dump.includes("mechanism_tag"), "compress dump mechanism_tag");
  assert.ok(dump.includes("极性候选1"), "compress dump candidate value");
}

{
  const planned = [
    { path: "dimensions[0]", moat_class: "polarity" as const },
    { path: "dimensions[1]", moat_class: "timing" as const },
    { path: "dimensions[2]", moat_class: "archetype" as const },
  ];
  const cloned = parseDeepEvidenceAssignment(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      units: [
        {
          path: "dimensions[0]",
          chart_anchors: ["用神水", "身弱"],
          calc_cite: "身弱需用水补",
          means_candidate_ref: "极性候选1",
          unit_claim: "补水稳住身弱耗泄",
        },
        {
          path: "dimensions[1]",
          chart_anchors: ["用神水", "身弱"],
          calc_cite: "大运丁酉气候交织",
          means_candidate_ref: "时机候选1",
          unit_claim: "窗口亦须补水节奏",
        },
        {
          path: "dimensions[2]",
          chart_anchors: ["正印"],
          calc_cite: "正印为用",
          means_candidate_ref: "角色候选1",
          unit_claim: "正印托底角色",
        },
      ],
    },
    planned,
  );
  assert.ok(cloned);
  // Missing 大运 on timing moat
  assert.ok(validateAssignmentMoatAnchors(cloned!)?.startsWith("moat_anchor_mismatch"));
  // Fix timing anchors but keep clone reuse
  const reused = parseDeepEvidenceAssignment(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      units: [
        {
          path: "dimensions[0]",
          chart_anchors: ["用神水", "身弱"],
          calc_cite: "身弱需用水补",
          means_candidate_ref: "极性候选1",
          unit_claim: "补水稳住身弱耗泄",
        },
        {
          path: "dimensions[1]",
          chart_anchors: ["用神水", "身弱"],
          calc_cite: "大运丁酉气候交织",
          means_candidate_ref: "时机候选1",
          unit_claim: "窗口亦须补水节奏",
        },
        {
          path: "dimensions[2]",
          chart_anchors: ["正印"],
          calc_cite: "正印为用",
          means_candidate_ref: "角色候选1",
          unit_claim: "正印托底角色",
        },
      ],
    },
    [
      { path: "dimensions[0]", moat_class: null },
      { path: "dimensions[1]", moat_class: null },
      { path: "dimensions[2]", moat_class: null },
    ],
  );
  assert.ok(reused);
  assert.ok(maxAssignmentAnchorJaccard(reused!.units) >= DEEP_EVIDENCE_ANCHOR_JACCARD_MAX);
  assert.ok(validateAssignmentAnchorDiversity(reused!)?.startsWith("anchor_reuse_jaccard"));

  const diverse = parseDeepEvidenceAssignment(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      units: [
        {
          path: "dimensions[0]",
          chart_anchors: ["用神水", "身弱"],
          calc_cite: "身弱需用水补",
          means_candidate_ref: "极性候选1",
          unit_claim: "补水稳住身弱耗泄",
        },
        {
          path: "dimensions[1]",
          chart_anchors: ["大运", "气候交织"],
          calc_cite: "大运丁酉气候交织",
          means_candidate_ref: "时机候选1",
          unit_claim: "大运窗口宜切换攻守",
        },
        {
          path: "dimensions[2]",
          chart_anchors: ["正印", "寡宿"],
          calc_cite: "正印为用寡宿自守",
          means_candidate_ref: "角色候选1",
          unit_claim: "正印托底角色",
        },
      ],
    },
    planned,
  );
  assert.ok(diverse);
  assert.equal(validateAssignmentMoatAnchors(diverse!), null);
  assert.equal(validateAssignmentAnchorDiversity(diverse!), null);
}

{
  // Science: code-stagger primaries even when frames share first anchor
  const core = {
    modern_action_frames: [
      {
        direction: "主轨交付物对齐会",
        why_fits: "食神泄秀适合出方案而不硬扛",
        structural_basis: "s",
        needs_validation: "n",
        chart_anchors: ["食神", "偏财"],
      },
      {
        direction: "边界说明书今晚可交",
        why_fits: "正印托底可守节奏再谈扩展",
        structural_basis: "s",
        needs_validation: "n",
        chart_anchors: ["食神", "正印"],
      },
      {
        direction: "降范围保交付",
        why_fits: "七杀压力需先收口再冲",
        structural_basis: "s",
        needs_validation: "n",
        chart_anchors: ["食神", "七杀"],
      },
      {
        direction: "辅轨表达出口",
        why_fits: "伤官喜见公开反馈通道",
        structural_basis: "s",
        needs_validation: "n",
        chart_anchors: ["伤官"],
      },
      {
        direction: "协作分摊负荷",
        why_fits: "劫财宜借力不宜独扛",
        structural_basis: "s",
        needs_validation: "n",
        chart_anchors: ["劫财"],
      },
      {
        direction: "资源回血节奏",
        why_fits: "偏印需防过耗先补输入",
        structural_basis: "s",
        needs_validation: "n",
        chart_anchors: ["偏印"],
      },
    ],
    multi_dimension_reckoning: [
      { dimension: "大运", chart_basis: "甲子大运、流年", judgment: "窗口" },
    ],
  } as BreakthroughCore;

  const hints = buildScienceAssignPathHints(core);
  assert.equal(hints.length, 6);
  const primaries = hints.map((h) => h.prefer_primary);
  assert.deepEqual(primaries, ["食神", "正印", "七杀", "伤官", "劫财", "偏印"]);
  assert.equal(new Set(primaries).size, 6, "primaries must be unique");
  assert.ok(hints.every((h) => (h.prefer_cite?.length ?? 0) >= 1), "P3 cite seeded");
  assert.ok(hints.every((h) => (h.prefer_claim?.length ?? 0) >= 6), "P3 claim seeded");

  const feed = buildScienceMeansFeedBlock(core, []);
  assert.ok(feed.includes("派工绑定建议表"));
  assert.ok(feed.includes("primary=食神"));
  assert.ok(feed.includes("cite="));
  assert.ok(feed.includes("claim="));

  const parsedHints = parseAssignPathHintsFromFeed(feed);
  assert.equal(parsedHints.length, 6);
  assert.equal(parsedHints[0]!.prefer_primary, "食神");
  assert.ok(parsedHints[0]!.prefer_cite);
  assert.ok(parsedHints[0]!.prefer_claim);

  const planned = planDeepEvidenceSlots("science_action", {
    key: "science_action",
    science_means_feed: feed,
  });
  assert.equal(planned.length, 6);
  assert.equal(planned[0]!.prefer_primary, "食神");
  assert.equal(planned[1]!.prefer_primary, "正印");
  assert.ok(planned.every((p) => p.prefer_primary), "all paths seeded");
  assert.ok(planned.every((p) => p.prefer_cite && p.prefer_claim), "cite+claim on plan");
  assert.equal(
    new Set(planned.map((p) => p.prefer_primary)).size,
    6,
    "seeded primaries unique",
  );

  // Model returns cloned anchors + thin cite — lock restores diversity + thickness
  const clonedAssign = parseDeepEvidenceAssignment(
    "science_action",
    {
      page: "science_action",
      units: planned.map((p) => ({
        path: p.path,
        chart_anchors: ["食神", "偏财"],
        calc_cite: "短",
        means_candidate_ref: "x",
        unit_claim: "短句",
      })),
    },
    planned,
  );
  assert.ok(clonedAssign);
  assert.ok(validateAssignmentAnchorDiversity(clonedAssign!)?.startsWith("anchor_reuse"));
  const locked = applyPreferBindingLocks(clonedAssign!, planned);
  assert.equal(locked.units[0]!.chart_anchors[0], "食神");
  assert.equal(locked.units[1]!.chart_anchors[0], "正印");
  assert.equal(locked.units[3]!.chart_anchors[0], "伤官");
  assert.ok(locked.units[0]!.calc_cite.length >= 12 || planned[0]!.prefer_cite);
  assert.equal(validateAssignmentAnchorDiversity(locked), null);
}

{
  // P2 foundation: distinct candidate refs
  const candidates = collectFoundationSurfaceCandidates(
    [{ label: "现状", answer: "连续加班导致注意力崩" }],
    {
      original_question: "要不要换赛道",
      desired_outcome: "三个月内稳住收入",
      real_fork: "留下 vs 离开",
      situation_conclusion: "结构上主辅可立",
    },
  );
  assert.ok(candidates.length >= 4);
  const p2hints = buildFoundationAssignPathHints(candidates, 4);
  assert.equal(p2hints.length, 4);
  const refs = p2hints.map((h) => h.prefer_candidate_ref);
  assert.equal(new Set(refs).size, refs.length, "P2 refs distinct");
  assert.ok(p2hints.every((h) => h.prefer_claim && h.prefer_cite));
  const p2feed = buildFoundationSurfaceFeedBlock(
    [{ label: "现状", answer: "连续加班导致注意力崩" }],
    {
      original_question: "要不要换赛道",
      desired_outcome: "三个月内稳住收入",
      real_fork: "留下 vs 离开",
      situation_conclusion: "结构上主辅可立",
    },
  );
  assert.ok(p2feed.includes("派工绑定建议表"));
  const p2plan = planDeepEvidenceSlots("foundation", {
    key: "foundation",
    foundation_surface_feed: p2feed,
  });
  assert.ok(p2plan.length >= 4);
  assert.ok(p2plan.every((p) => p.prefer_candidate_ref?.startsWith("表象候选")));
}

{
  // P4: moat-aligned refs + thin lock fill
  const coreP4 = {
    metaphysics_pack: {
      yong_shen: { primary_yong_shen: "水", ji_shen: ["火"] },
      dashboard: { resistance_load: 1, sustain_capacity: 1, output_capacity: 1 },
    },
    energy_retune_frame: {
      direction_fit: "x",
      timing_ripeness: "大运窗口中",
      daily_retune: "y",
      complementary: "z",
      structural_basis: "甲子大运",
      needs_validation: "n",
    },
    multi_dimension_reckoning: [
      { dimension: "十神格局", chart_basis: "正印", judgment: "正印托底" },
    ],
  } as BreakthroughCore;
  const { block, eligible } = buildMetaphysicsMoatFeedBlock(coreP4, []);
  assert.ok(eligible.length >= 2);
  assert.ok(block.includes("派工绑定建议表"));
  const p4plan = planDeepEvidenceSlots("metaphysics_action", {
    key: "metaphysics_action",
    eastern_calc_slice: block,
    metaphysics_moat_feed: block,
  });
  assert.ok(p4plan.length >= 3);
  for (const slot of p4plan) {
    if (!slot.moat_class || !slot.prefer_candidate_ref) continue;
    if (slot.moat_class === "timing") {
      assert.ok(slot.prefer_candidate_ref.startsWith("时机"));
    }
    if (slot.moat_class === "polarity") {
      assert.ok(slot.prefer_candidate_ref.startsWith("极性"));
    }
    if (slot.moat_class === "archetype") {
      assert.ok(slot.prefer_candidate_ref.startsWith("角色"));
    }
  }
  const thin = parseDeepEvidenceAssignment(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      units: p4plan.map((p) => ({
        path: p.path,
        chart_anchors: p.prefer_primary ? [p.prefer_primary] : ["用神水"],
        calc_cite: "短",
        means_candidate_ref: "x",
        unit_claim: "短句",
      })),
    },
    p4plan,
  );
  assert.ok(thin);
  const filled = applyPreferBindingLocks(thin!, p4plan);
  assert.ok(filled.units.every((u) => u.calc_cite.length >= 4));
  assert.ok(filled.units.every((u) => u.unit_claim.length >= 6));
}

{
  // P5 / P6: six paths with refs; lock fills thin cite/claim
  const brief = {
    primary_name: "主推",
    backup_name: "辅守",
    primary_when: "今晚",
    backup_when: "过冲时",
    p3_primary_steps: ["发交付物", "约对齐会", "写边界"],
    p3_backup_steps: ["降范围"],
    p3_hard_metrics: ["今晚出示一页"],
    p4_primary_means: ["补水节奏"],
    p4_avoid: ["硬冲"],
    p4_leverage: [],
    p4_field_matrix: [],
    p4_backup_means: [],
    source_anchors: ["食神", "大运", "正印", "身弱", "偏财", "七杀"],
  } as P5ActionBrief;

  const riskFeed = buildRiskFuseFeedBlock(null, brief, []);
  assert.ok(riskFeed.includes("派工绑定建议表"));
  const riskPlan = planDeepEvidenceSlots("risk_guard", {
    key: "risk_guard",
    risk_fuse_feed: riskFeed,
  });
  assert.equal(riskPlan.length, 6);
  assert.ok(riskPlan.every((p) => p.prefer_candidate_ref), "P5 refs");
  assert.ok(riskPlan.every((p) => p.prefer_cite && p.prefer_claim), "P5 cite/claim");

  const closeFeed = buildCloseRitualFeedBlock(null, brief, []);
  assert.ok(closeFeed.includes("派工绑定建议表"));
  const closePlan = planDeepEvidenceSlots("signals_close", {
    key: "signals_close",
    close_ritual_feed: closeFeed,
  });
  assert.equal(closePlan.length, 6);
  assert.ok(closePlan.every((p) => p.prefer_candidate_ref), "P6 refs");

  const thinClose = parseDeepEvidenceAssignment(
    "signals_close",
    {
      page: "signals_close",
      units: closePlan.map((p) => ({
        path: p.path,
        chart_anchors: ["食神"],
        calc_cite: "短",
        means_candidate_ref: "x",
        unit_claim: "短句",
      })),
    },
    closePlan,
  );
  assert.ok(thinClose);
  const lockedClose = applyPreferBindingLocks(thinClose!, closePlan);
  assert.ok(lockedClose.units.every((u) => u.means_candidate_ref.length >= 2));
  assert.ok(lockedClose.units.every((u) => u.calc_cite.length >= 12 || u.calc_cite.length >= 4));
}

{
  // Inventory fallback when feed has no table
  const sets: CategoryTokenSets = {
    ten_god: new Set(["比肩", "食神", "正财"]),
    shen_sha: new Set(["驿马"]),
    relation: new Set(["天克地冲"]),
    life_stage_hidden: new Set(["长生"]),
    dayun: new Set(["甲子大运"]),
    core_structure: new Set(["用神水", "身弱"]),
  };
  const seeded = seedPlannedBindings(
    [
      { path: "why_cards[0]" },
      { path: "why_cards[1]" },
      { path: "why_cards[2]" },
    ],
    { category_token_sets: sets, prior_chart_anchors: ["比肩"] },
  );
  assert.ok(seeded[0]!.prefer_primary);
  assert.ok(seeded[1]!.prefer_primary);
  assert.notEqual(seeded[0]!.prefer_primary, "比肩");
  assert.notEqual(seeded[0]!.prefer_primary, seeded[1]!.prefer_primary);
}

console.log("test-deep-evidence-assign: ok");

{
  const fs = require("node:fs") as typeof import("node:fs");
  const src = fs.readFileSync(
    "lib/llm/pro/delivery/page-schema/deep-evidence-assign.ts",
    "utf8",
  );
  assert.ok(src.includes('thinking_effort: "high"'), "assign keeps high thinking (no degrade)");
  assert.ok(!src.includes('thinking_effort: "off"'), "assign must not turn thinking off");
  assert.ok(!src.includes('? "low" : "off"'), "assign must not low/off degrade path");
  assert.ok(src.includes("ASSIGN_MAX_TOKENS = 20_000"), "assign max_tokens 20k");
  assert.ok(src.includes("validateAssignmentMoatAnchors"), "assign validates moat×anchors");
  assert.ok(src.includes("applyPreferBindingLocks"), "assign locks binding tuple");
  assert.ok(src.includes("calc_cite"), "assign requires calc_cite");
  assert.ok(src.includes("unit_claim"), "assign requires unit_claim");
}
