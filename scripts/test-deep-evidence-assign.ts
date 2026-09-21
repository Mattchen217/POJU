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
  forceDiversifyChartAnchors,
  isThinAssignCite,
  parseAssignPathHintsFromFeed,
  parseDeepEvidenceAssignment,
  planDeepEvidenceSlots,
  resolveAssignCalcCite,
  resolveDeepEvidenceUnitCount,
  seedPlannedBindings,
  slimSharedAuxAnchors,
  softRepairDeepEvidencePlanPrimaryReuse,
  softRepairAssignmentAnchorDiversity,
  validateAssignmentAnchorDiversity,
  validateAssignmentMoatAnchors,
  parsePrimaryBackupNamesFromFeed,
  alignPrimaryBackupTrackProse,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import { buildRiskFuseFeedBlock } from "../lib/llm/pro/delivery/risk-fuse-feed";
import {
  buildCloseAssignPathHints,
  buildCloseRitualFeedBlock,
  normalizeNear7DayStem,
} from "../lib/llm/pro/delivery/close-ritual-feed";
import { buildMetaphysicsMoatFeedBlock } from "../lib/llm/pro/delivery/metaphysics-moat-feed";
import {
  buildFoundationAssignPathHints,
  buildFoundationSurfaceFeedBlock,
  collectFoundationSurfaceCandidates,
} from "../lib/llm/pro/delivery/foundation-surface-feed";
import {
  buildScienceAssignPathHints,
  buildScienceMeansFeedBlock,
} from "../lib/llm/pro/delivery/science-means-feed";
import { formatDeepEvidencePlanForCompress } from "../lib/llm/pro/delivery/page-schema/deep-evidence-call";
import {
  DEEP_EVIDENCE_ANCHOR_JACCARD_MAX,
  maxAssignmentAnchorJaccard,
  softStripUnmatchedDeepEvidenceAnchors,
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
  assert.equal(anchorsServeMoatClass(["丁酉"], "timing"), true);
  assert.equal(anchorsServeMoatClass(["丙午"], "timing"), true);
  assert.equal(anchorsServeMoatClass(["金"], "timing"), false);
  assert.equal(anchorsServeMoatClass(["土"], "polarity"), true);
  assert.equal(anchorsServeMoatClass(["水"], "polarity"), true);
  assert.equal(anchorsServeMoatClass(["木"], "polarity"), true);
  assert.equal(anchorsServeMoatClass(["身弱"], "polarity"), true);
  assert.equal(anchorsServeMoatClass(["土"], "timing"), false);
  assert.equal(anchorsServeMoatClass(["水"], "timing"), false);
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
  } as unknown as BreakthroughCore;

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

  // Signals already carry unique prefer_primary → parse projects diverse anchors;
  // lock still thickens thin cite/claim/ref.
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
        necessary_signals: [
          {
            slug: p.prefer_primary!,
            role: `主承重${p.prefer_primary}`,
            why_needed: `去掉此信号无法解释本单元结构缺口`,
            dimension_id: "expression_creativity",
            inference_zh: `${p.prefer_primary}为本单元主张承重`,
          },
        ],
      })),
    },
    planned,
  );
  assert.ok(clonedAssign);
  assert.equal(validateAssignmentAnchorDiversity(clonedAssign!), null);
  const locked = applyPreferBindingLocks(clonedAssign!, planned);
  assert.equal(locked.units[0]!.chart_anchors[0], "食神");
  assert.equal(locked.units[1]!.chart_anchors[0], "正印");
  assert.equal(locked.units[3]!.chart_anchors[0], "伤官");
  assert.ok(
    locked.units[0]!.calc_cite.length >= 12 || Boolean(planned[0]!.prefer_cite),
  );
  assert.equal(validateAssignmentAnchorDiversity(locked), null);
}

{
  // 方案 A #5：仅一条 backup_path + 不足 6 帧 → 辅轨三角 claim 必须两两不同
  const thinCore = {
    modern_action_frames: [
      {
        direction: "顾问试水",
        why_fits: "低风险验证",
        needs_validation: "现金流",
        chart_anchors: ["食神"],
        status: "hypothesis",
      },
      {
        direction: "内部再定位",
        why_fits: "重建影响力",
        needs_validation: "跨部门口",
        chart_anchors: ["劫财"],
        status: "hypothesis",
      },
      {
        direction: "蓄水决策",
        why_fits: "先补能量",
        needs_validation: "睡眠",
        chart_anchors: ["正官"],
        status: "hypothesis",
      },
    ],
    primary_path: {
      direction: "渐进试水",
      why_fits: "主轨说明",
      chart_anchors: ["食神"],
    },
    backup_path: {
      direction: "以守为进，构建小生态并伺机跳槽，新能源长期观察",
      why_fits: "辅轨共用说明",
      chart_anchors: ["正印", "伤官", "丙午"],
    },
    multi_dimension_reckoning: [],
  } as unknown as BreakthroughCore;

  const backupHints = buildScienceAssignPathHints(thinCore);
  assert.equal(backupHints.length, 6);
  const backupClaims = backupHints.slice(3).map((h) => h.prefer_claim ?? "");
  assert.equal(new Set(backupClaims).size, 3, `backup claims must differ: ${backupClaims.join(" | ")}`);
  assert.ok(backupClaims.every((c) => /辅角·/.test(c)), String(backupClaims));
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
  assert.ok(
    p2hints.every((h) => !/^此表象说明结构上/.test(h.prefer_claim ?? "")),
    "方案A#1/#2 禁 cite 粘贴铅 claim",
  );
  const p2feed = buildFoundationSurfaceFeedBlock(
    [{ label: "现状", answer: "连续加班导致注意力崩" }],
    {
      original_question: "要不要换赛道",
      desired_outcome: "三个月内稳住收入",
      real_fork: "留下 vs 离开",
      situation_conclusion: "结构上主辅可立",
    },
  );
  assert.ok(p2feed.includes("处境材料"));
  assert.ok(!p2feed.includes("派工绑定建议表"));
  const p2plan = planDeepEvidenceSlots("foundation", {
    key: "foundation",
    foundation_surface_feed: p2feed,
    assign_path_hints: buildFoundationAssignPathHints(candidates, 5),
  });
  assert.ok(p2plan.length >= 4);
  assert.ok(p2plan.every((p) => p.prefer_candidate_ref?.startsWith("表象候选")));
}

{
  // 方案 A #3：厚错误 model cite 不得盖掉配对 prefer_cite
  const crossed = collectFoundationSurfaceCandidates(
    [
      { label: "焦虑面", answer: "男友否定让我整夜睡不着" },
      { label: "工作面", answer: "连续加班导致注意力崩" },
    ],
    { situation_conclusion: "结构上主辅可立" },
  );
  const hints = buildFoundationAssignPathHints(crossed, 4);
  const anxietyHint = hints.find((h) => (h.prefer_cite ?? "").includes("焦虑面"));
  assert.ok(anxietyHint, "anxiety surface seeded");
  const wrongLocked = applyPreferBindingLocks(
    {
      page: "foundation",
      units: [
        {
          path: anxietyHint!.path,
          chart_anchors: ["比肩"],
          calc_cite: "连续加班导致注意力崩，周末也在回邮件",
          means_candidate_ref: anxietyHint!.prefer_candidate_ref ?? "表象候选1",
          unit_claim: "短",
          necessary_signals: [
            {
              slug: "比肩",
              role: "解释",
              why_needed: "去掉此信号无法解释焦虑",
              dimension_id: "interpersonal_pattern",
              inference_zh: "比肩同辈压力",
            },
          ],
        },
      ],
    },
    [
      {
        path: anxietyHint!.path,
        prefer_cite: anxietyHint!.prefer_cite,
        prefer_claim: anxietyHint!.prefer_claim,
        prefer_candidate_ref: anxietyHint!.prefer_candidate_ref,
      },
    ],
  );
  assert.ok(
    (wrongLocked.units[0]!.calc_cite ?? "").includes("焦虑") ||
      (wrongLocked.units[0]!.calc_cite ?? "").includes("男友"),
    `cite must stay paired: ${wrongLocked.units[0]!.calc_cite}`,
  );
  assert.ok(!(wrongLocked.units[0]!.calc_cite ?? "").includes("加班"));
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
  } as unknown as BreakthroughCore;
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
  } as unknown as P5ActionBrief;

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
  // P6：rhythm 月表腔压成近7日
  const monthCore = {
    rhythm_frame: {
      phase1_observe: "第1-10天：暂停重大决定并记录能量",
      phase2_adjust: "第11-20天：小步调整内部沟通",
      phase3_consolidate: "第21-30天：巩固新节奏",
    },
    self_check_signals: [],
  } as unknown as BreakthroughCore;
  const monthBrief = {
    primary_name: "主轨",
    backup_name: "辅轨",
    primary_when: "今晚",
    backup_when: "切辅",
    p3_primary_steps: [],
    p3_backup_steps: [],
    p3_hard_metrics: [],
    p4_primary_means: [],
    p4_avoid: [],
    p4_leverage: [],
    p4_field_matrix: [],
    p4_backup_means: [],
    source_anchors: ["土", "水", "劫财", "比肩", "正财", "六合"],
  } as unknown as P5ActionBrief;
  assert.ok(
    !/1-10|11-20|21-30/.test(
      normalizeNear7DayStem(monthCore.rhythm_frame!.phase1_observe, "observe"),
    ),
  );
  const monthHints = buildCloseAssignPathHints(monthCore, monthBrief, [], []);
  for (const h of monthHints.filter((x) => x.path.startsWith("day7"))) {
    assert.ok(
      !/1\s*[-–]\s*10|11\s*[-–]\s*20|21\s*[-–]\s*30/.test(h.prefer_cite ?? ""),
      `cite still month-band: ${h.prefer_cite}`,
    );
    assert.ok(
      !/1\s*[-–]\s*10|11\s*[-–]\s*20|21\s*[-–]\s*30/.test(h.prefer_claim ?? ""),
      `claim still month-band: ${h.prefer_claim}`,
    );
  }
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

{
  // slimSharedAux + forceDiversify: shared aux stacks must not trip Jaccard
  const stacked = [
    { path: "a", chart_anchors: ["食神", "偏财", "用神水", "身弱"] },
    { path: "b", chart_anchors: ["正印", "偏财", "用神水", "身弱"] },
    { path: "c", chart_anchors: ["七杀", "偏财", "用神水", "身弱"] },
  ];
  const slimmed = slimSharedAuxAnchors(stacked);
  assert.equal(slimmed[0]!.chart_anchors[0], "食神");
  assert.ok(slimmed[0]!.chart_anchors.length <= 2);
  assert.ok(maxAssignmentAnchorJaccard(slimmed) < DEEP_EVIDENCE_ANCHOR_JACCARD_MAX);

  const cloned = [
    { path: "a", chart_anchors: ["食神", "偏财"] },
    { path: "b", chart_anchors: ["食神", "偏财"] },
    { path: "c", chart_anchors: ["食神", "偏财"] },
  ];
  assert.ok(maxAssignmentAnchorJaccard(cloned) >= DEEP_EVIDENCE_ANCHOR_JACCARD_MAX);
  const forced = forceDiversifyChartAnchors(cloned, ["正印", "七杀", "伤官", "劫财"]);
  assert.equal(new Set(forced.map((u) => u.chart_anchors[0])).size, 3);
  assert.ok(maxAssignmentAnchorJaccard(forced) < DEEP_EVIDENCE_ANCHOR_JACCARD_MAX);
}

{
  // softRepairAssignmentAnchorDiversity: identical single-anchor sets → diversify without LLM
  const colliding = {
    page: "foundation" as const,
    units: [
      {
        path: "why_cards[0]",
        chart_anchors: ["食神"],
        calc_cite: "安全垫薄",
        means_candidate_ref: "表象候选1",
        unit_claim: "食神生财难积蓄",
        necessary_signals: [
          {
            slug: "食神",
            dimension_id: "expression_creativity",
            inference_zh: "食神生财但财不显",
            role: "解释安全垫",
            why_needed: "去掉此信号无法解释安全垫薄",
          },
        ],
      },
      {
        path: "why_cards[1]",
        chart_anchors: ["身弱", "正官"],
        calc_cite: "话语权弱",
        means_candidate_ref: "表象候选2",
        unit_claim: "身弱从属",
        necessary_signals: [
          {
            slug: "身弱",
            dimension_id: "day_master_strength",
            inference_zh: "身弱倾向跟随",
            role: "解释被动",
            why_needed: "去掉此信号无法解释从属",
          },
          {
            slug: "正官",
            dimension_id: "interpersonal_pattern",
            inference_zh: "正官服从惯性",
            role: "解释服从",
            why_needed: "去掉此信号无法解释人际从属",
          },
        ],
      },
      {
        path: "why_cards[2]",
        chart_anchors: ["食神"],
        calc_cite: "精力紧张",
        means_candidate_ref: "表象候选3",
        unit_claim: "食神泄身",
        necessary_signals: [
          {
            slug: "食神",
            dimension_id: "expression_creativity",
            inference_zh: "当前大运丁酉食神当令泄身严重",
            role: "解释精力",
            why_needed: "去掉此信号无法解释精力紧张",
          },
        ],
      },
    ],
  };
  assert.ok(
    validateAssignmentAnchorDiversity(colliding)?.startsWith("anchor_reuse_jaccard"),
  );
  const soft = softRepairAssignmentAnchorDiversity(colliding, {
    pool: ["食神", "身弱", "正官", "丁酉", "六合"],
  });
  assert.equal(soft.repaired, true);
  assert.equal(soft.still_fail, undefined);
  assert.equal(validateAssignmentAnchorDiversity(soft.assignment), null);
  assert.notEqual(
    soft.assignment.units[0]!.chart_anchors[0],
    soft.assignment.units[2]!.chart_anchors[0],
  );
}

{
  assert.equal(isThinAssignCite("主手段"), true);
  assert.equal(isThinAssignCite("熔断候选1"), true);
  assert.equal(isThinAssignCite("推进本案主路径时结构过耗须停"), false);
  assert.equal(
    resolveAssignCalcCite({
      model_cite: "主手段",
      prefer_cite: "主手段",
      unit_claim: "做「主手段」若出现红灯须立即停",
      inference_zh: "木为喜神，代表你的生长与突破力。",
    }),
    "做「主手段」若出现红灯须立即停",
  );
  const locked = applyPreferBindingLocks(
    {
      page: "risk_guard",
      units: [
        {
          path: "red_lights[0]",
          chart_anchors: ["木"],
          calc_cite: "主手段",
          means_candidate_ref: "熔断候选1",
          unit_claim: "做「主手段」若出现红灯须立即停",
          necessary_signals: [
            {
              slug: "木",
              dimension_id: "favor_avoid_tuning",
              inference_zh: "木为喜神，喜神受阻时主手段失去生长力。",
              role: "喜神木被压制",
              why_needed: "去掉此信号则无法解释为何喜神受阻时须立即停。",
            },
          ],
        },
      ],
    },
    [
      {
        path: "red_lights[0]",
        prefer_cite: "主手段",
        prefer_claim: "做「主手段」若出现红灯须立即停",
        prefer_candidate_ref: "熔断候选1",
      },
    ],
  );
  assert.notEqual(locked.units[0]!.calc_cite, "主手段");
  assert.ok(
    locked.units[0]!.calc_cite.length >= 12,
    `cite soft-filled: ${locked.units[0]!.calc_cite}`,
  );
  const riskParsed = parseDeepEvidenceAssignment(
    "risk_guard",
    {
      page: "risk_guard",
      units: [
        {
          path: "red_lights[0]",
          chart_anchors: ["木"],
          calc_cite: "主手段",
          means_candidate_ref: "熔断候选1",
          unit_claim: "做「主手段」若出现红灯须立即停",
          necessary_signals: [
            {
              slug: "木",
              dimension_id: "favor_avoid_tuning",
              inference_zh: "木为喜神，喜神受阻时主手段失去生长力。",
              role: "喜神木被压制",
              why_needed: "去掉此信号则无法解释为何喜神受阻时须立即停。",
            },
          ],
          removal_test: { passed: true, notes: "ok" },
          signal_count_rationale: "1个——派工表锁定",
        },
      ],
    },
    [
      {
        path: "red_lights[0]",
        prefer_cite: "主手段",
        prefer_claim: "做「主手段」若出现红灯须立即停",
        prefer_candidate_ref: "熔断候选1",
      },
    ],
  );
  assert.ok(riskParsed, "hollow 主手段 cite must soft-resolve at parse");
  assert.notEqual(riskParsed!.units[0]!.calc_cite, "主手段");
}

{
  // forceDiversify must not invent unmatched aux (P6 write #12 mismatch)
  const units = [
    {
      path: "identity_shift",
      chart_anchors: ["日主乙庚相合合化金", "土"],
      evidence:
        "⟦w:日主乙庚相合合化金⟧为忌神，形成对稳定假象的惯性依赖。只有通过安静时间才能切到可执行身份。",
    },
  ];
  const forced = forceDiversifyChartAnchors(units, ["土", "水", "劫财", "日主乙庚相合合化金"], {
    reuse_cap: 2,
    prior_reuse_tokens: ["日主乙庚相合合化金", "日主乙庚相合合化金"],
  });
  assert.equal(forced[0]!.chart_anchors[0], "土");
  assert.ok(
    !forced[0]!.chart_anchors.includes("日主乙庚相合合化金"),
    "must not keep prior primary as unmatched aux after diversify",
  );

  const repaired = softRepairDeepEvidencePlanPrimaryReuse(
    {
      page: "signals_close",
      units: [
        {
          path: "identity_shift",
          chart_anchors: ["日主乙庚相合合化金", "土"],
          evidence:
            "⟦w:日主乙庚相合合化金⟧为忌神，形成对稳定假象的惯性依赖。只有通过安静时间才能切到可执行身份。",
          calc_cite: "安静时间思绪清晰",
          means_candidate_ref: "身份茎",
          unit_claim: "从旧身份切到可执行身份",
        },
      ],
    },
    {
      prior_chart_anchors: ["日主乙庚相合合化金", "日主乙庚相合合化金"],
      pool: ["土", "水", "劫财"],
      reuse_cap: 2,
    },
  );
  assert.equal(repaired.repaired, true);
  assert.equal(repaired.still_fail, undefined);
  assert.equal(repaired.plan.units[0]!.chart_anchors[0], "土");
  assert.ok(
    !repaired.plan.units[0]!.chart_anchors.includes("日主乙庚相合合化金"),
    "乙庚合 aux stripped when only ⟦w:土⟧ remains",
  );
  assert.ok(repaired.plan.units[0]!.evidence.includes("⟦w:土⟧"));
}

{
  const stripped = softStripUnmatchedDeepEvidenceAnchors([
    {
      path: "identity_shift",
      chart_anchors: ["土", "日主乙庚相合合化金"],
      evidence:
        "⟦w:土⟧为忌神，在你的能量结构中形成对稳定假象的惯性依赖。只有通过安静时间才能切到可执行身份。",
    },
  ]);
  assert.equal(stripped.stripped, true);
  assert.deepEqual(stripped.units[0]!.chart_anchors, ["土"]);
}

{
  const overCap = softRepairDeepEvidencePlanPrimaryReuse(
    {
      page: "signals_close",
      units: [
        {
          path: "day7_micro_actions[1]",
          chart_anchors: ["日主乙庚相合合化金"],
          evidence: "⟦w:日主乙庚相合合化金⟧ 使你与规则绑定。",
          calc_cite: "小步调整测试适应度",
          means_candidate_ref: "adjust",
          unit_claim: "近7日微动作调整内部沟通",
        },
        {
          path: "day7_micro_actions[2]",
          chart_anchors: ["巳寅相刑"],
          evidence: "⟦w:巳寅相刑⟧ 引发内耗。",
          calc_cite: "巩固新节奏外部支持",
          means_candidate_ref: "consolidate",
          unit_claim: "近7日微动作巩固节奏",
        },
        {
          path: "day7_micro_actions[3]",
          chart_anchors: ["食神"],
          evidence: "⟦w:食神⟧ 输出补给。",
          calc_cite: "切辅轨释放产出",
          means_candidate_ref: "辅轨近阶",
          unit_claim: "近7日微动作可切辅",
        },
      ],
    },
    {
      prior_chart_anchors: [
        "日主乙庚相合合化金",
        "日主乙庚相合合化金",
        "巳寅相刑",
        "巳寅相刑",
        "食神",
        "食神",
      ],
      pool: ["土", "水", "劫财", "正官", "身弱", "丁酉"],
      reuse_cap: 2,
    },
  );
  assert.equal(overCap.repaired, true);
  assert.equal(overCap.still_fail, undefined);
  for (const u of overCap.plan.units) {
    assert.ok(
      ["土", "水", "劫财", "正官", "身弱", "丁酉"].includes(u.chart_anchors[0]!),
      `swapped primary ${u.chart_anchors[0]}`,
    );
  }
}

{
  const fs = require("node:fs") as typeof import("node:fs");
  const src = fs.readFileSync(
    "lib/llm/pro/delivery/page-schema/deep-evidence-assign.ts",
    "utf8",
  );
  assert.ok(src.includes('thinking_effort: "high"'), "assign keeps high thinking (no degrade)");
  assert.ok(!src.includes('thinking_effort: "off"'), "assign must not turn thinking off");
  assert.ok(!src.includes('? "low" : "off"'), "assign must not low/off degrade path");
  assert.ok(src.includes("ASSIGN_FREE_SELECT_MAX_TOKENS = 20_000"), "assign max_tokens 20k");
  assert.ok(src.includes("validateAssignmentMoatAnchors"), "assign validates moat×anchors");
  assert.ok(src.includes("anchorsServeMoatClass"), "moat×anchors helper");
  assert.ok(src.includes("applyPreferBindingLocks"), "assign locks binding tuple");
  assert.ok(src.includes("resolveAssignCalcCite"), "hollow cite soft-resolve");
  assert.ok(src.includes("softRepairDeepEvidencePlanPrimaryReuse"), "write reuse soft-repair");
  assert.ok(src.includes("slimSharedAuxAnchors"), "assign slims shared aux");
  assert.ok(src.includes("forceDiversifyChartAnchors"), "code diversify anchors");
  assert.ok(
    src.includes("never invent one from the pool"),
    "forceDiversify must not invent unmatched aux",
  );
  assert.ok(src.includes("softRepairAssignmentAnchorDiversity"), "jaccard soft-repair");
  assert.ok(src.includes("softRepairPlannedMoatLocks"), "moat slot soft-repair");
  assert.ok(
    src.includes("assign closed-menu moat slot-swapped"),
    "logs moat slot-swap path",
  );
  assert.ok(
    src.includes("assign anchor-reuse soft-repaired"),
    "logs soft-repair path",
  );
  assert.ok(
    !src.includes("【纠错·锚点雷同】"),
    "must not LLM-retry on anchor Jaccard (rule 11)",
  );
  assert.ok(src.includes("calc_cite"), "assign requires calc_cite");
  assert.ok(src.includes("unit_claim"), "assign requires unit_claim");
}

{
  // 方案 A #14：切辅目标钉 P1 backup_name，禁把主轨写成辅
  const partnershipBrief = {
    primary_name: "兼职试水",
    backup_name: "全职硬条件",
    primary_when: "今晚备忘录",
    backup_when: "对方拒绝兼职书面化时",
    p3_primary_steps: ["观察接受度", "提兼职方案", "书面备忘", "误入主轨第四步"],
    p3_backup_steps: ["谈全职硬条件与退出条款"],
    p3_hard_metrics: [],
    p4_primary_means: [],
    p4_avoid: [],
    p4_leverage: [],
    p4_field_matrix: [],
    p4_backup_means: [],
    source_anchors: ["卯未半合", "土", "金", "午午相刑", "偏财", "午未六合"],
  } as unknown as P5ActionBrief;

  const riskFeed = buildRiskFuseFeedBlock(null, partnershipBrief, []);
  assert.ok(riskFeed.includes("切辅钉名"));
  const riskHints = parseAssignPathHintsFromFeed(riskFeed);
  const switchHint = riskHints.find((h) => h.path === "switch_to_backup");
  assert.ok(switchHint?.prefer_claim?.includes("全职硬条件"), "P5 claim → backup name");
  assert.ok(
    !switchHint?.prefer_claim?.includes("兼职试水"),
    "P5 claim must not use primary as switch dest",
  );
  assert.ok(
    !/转向「对方拒绝|转向「过冲/.test(switchHint?.prefer_claim ?? ""),
    "P5 claim must not use backup_when as dest",
  );

  const parsedNames = parsePrimaryBackupNamesFromFeed(riskFeed);
  assert.equal(parsedNames.primaryName, "兼职试水");
  assert.equal(parsedNames.backupName, "全职硬条件");

  const closeFeed = buildCloseRitualFeedBlock(null, partnershipBrief, []);
  const closeHints = buildCloseAssignPathHints(
    null,
    partnershipBrief,
    [],
    ["近阶 · 观察", "近阶 · 调整", "近阶 · 巩固", "近阶 · 误入主轨第四步"],
  );
  const day7Aux = closeHints.find((h) => h.path === "day7_micro_actions[3]");
  assert.ok(day7Aux?.prefer_claim?.includes("全职硬条件"), "P6 day7[3] nails backup");
  assert.ok(
    !day7Aux?.prefer_claim?.includes("误入主轨第四步"),
    "P6 day7[3] must not take primary stem[3]",
  );
  assert.ok(closeFeed.includes("切辅钉名"));

  const inverted = alignPrimaryBackupTrackProse(
    "停主切辅条件：转向「兼职试水」辅轨",
    {
      primaryName: "兼职试水",
      backupName: "全职硬条件",
      path: "switch_to_backup",
    },
  );
  assert.ok(inverted.includes("全职硬条件"));
  assert.ok(!inverted.includes("兼职试水"));

  const invertedDay7 = alignPrimaryBackupTrackProse(
    "近7日微动作4（可切辅）：启动辅轨切换，以兼职试水的方式保持进退空间",
    {
      primaryName: "兼职试水",
      backupName: "全职硬条件",
      path: "day7_micro_actions[3]",
    },
  );
  assert.ok(invertedDay7.includes("全职硬条件"));
  assert.ok(!/启动辅轨切换.*兼职试水/.test(invertedDay7));
}

console.log("test-deep-evidence-assign: ok");
