/**
 * Unit tests: deep-evidence assign distribution + binding parse + compress dump (no LLM).
 * Run: pnpm exec tsx scripts/test-deep-evidence-assign.ts
 */
import assert from "node:assert/strict";
import {
  anchorsServeMoatClass,
  chunkPaths,
  distributeP4MoatTargets,
  parseDeepEvidenceAssignment,
  planDeepEvidenceSlots,
  resolveDeepEvidenceUnitCount,
  validateAssignmentMoatAnchors,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import { formatDeepEvidencePlanForCompress } from "../lib/llm/pro/delivery/page-schema/deep-evidence-call";

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
  assert.ok(src.includes("calc_cite"), "assign requires calc_cite");
  assert.ok(src.includes("unit_claim"), "assign requires unit_claim");
}
